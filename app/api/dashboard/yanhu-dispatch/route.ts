/**
 * API: 福安岩湖水厂二级泵房高效节能智能调度运行分析
 *
 * 字段（与 joint-supply/analyzeFlowByElectricityPeriod 完全一致）：
 *   i_1072 (yanhu_daily_water in db) = 实为日累计电量 (kWh)
 *   i_1073 (yanhu_daily_power in db) = 实为日累计水量 (m³)
 *
 * 送水量 (m³)：
 *   日总量 = MAX(i_1073) - MIN(i_1073)（与 analyzeFlowByElectricityPeriod 一致）
 *   各小时按 AVG(i_1034) 流量比例分配（i_1073 更新频率低，直接差值会有0值空洞）
 *   → 小时累加 = 日总量 ✓
 *
 * 耗电量 (kWh)：
 *   各小时 = MAX(i_1072) - MIN(i_1072)（i_1072 每分钟更新，差值可靠）
 *   排除 0:00:00 前一天残留读数
 *   → 小时累加 ≈ 日总量 ✓
 */
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

function getPeriod(hour: number): 'valley' | 'flat' | 'peak' {
  if (hour < 8) return 'valley';
  if (hour < 10) return 'flat';
  if (hour < 12) return 'peak';
  if (hour < 15) return 'flat';
  if (hour < 20) return 'peak';
  if (hour < 21) return 'flat';
  if (hour < 22) return 'peak';
  return 'flat';
}

const PERIOD_NAMES: Record<string, string> = { valley: '谷', flat: '平', peak: '峰' };

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam || getYesterday();

    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time) AS hour,
        AVG(CASE WHEN i_1034 > 0 AND i_1034 < 10000 THEN i_1034 END) AS avg_flow,
        AVG(CASE WHEN i_1030 > 0.01 AND i_1030 < 2   THEN i_1030 END) AS avg_pressure,
        -- i_1072 (实为电量表)：每分钟更新，小时差值可靠
        MAX(CASE WHEN NOT (HOUR(collect_time)=0 AND MINUTE(collect_time)=0) AND i_1072 > 0 THEN i_1072 END)
          - MIN(CASE WHEN NOT (HOUR(collect_time)=0 AND MINUTE(collect_time)=0) AND i_1072 > 0 THEN i_1072 END)
          AS hour_power_kwh,
        -- i_1073 (实为水量表)：更新频率低，仅用于日总量计算
        MAX(CASE WHEN NOT (HOUR(collect_time)=0 AND MINUTE(collect_time)=0) AND i_1073 > 0 THEN i_1073 END)
          AS max_water,
        MIN(CASE WHEN NOT (HOUR(collect_time)=0 AND MINUTE(collect_time)=0) AND i_1073 > 0 THEN i_1073 END)
          AS min_water,
        MAX(i_1049) AS max_pump1_freq,
        MAX(i_1050) AS max_pump2_freq,
        MAX(i_1051) AS max_aux_freq
      FROM fuan_data
      WHERE DATE(collect_time) = ?
      GROUP BY HOUR(collect_time)
      ORDER BY HOUR(collect_time)
      `,
      [targetDate]
    );

    // 参照 analyzeEfficiency 的 Python shift(-1) 逻辑：
    // 日累计表的最终值在次日 0:00 被读取（carry-over），使用次日 0:00 读数作为当天日总量
    const nextDate = (() => {
      const d = new Date(targetDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      return toDateStr(d);
    })();
    const [nextRows] = await pool.query<any[]>(
      `SELECT
        MAX(CASE WHEN i_1073 > 0 THEN i_1073 END) AS next_max_water,
        MAX(CASE WHEN i_1072 > 0 THEN i_1072 END) AS next_max_elec
       FROM fuan_data
       WHERE DATE(collect_time) = ? AND HOUR(collect_time) = 0 AND MINUTE(collect_time) = 0`,
      [nextDate]
    );
    const nextRow = (nextRows as any[])[0] ?? {};
    const nextMaxWater = Number(nextRow.next_max_water) || 0; // 今天水量在次日 0:00 的读数
    const nextMaxElec  = Number(nextRow.next_max_elec)  || 0; // 今天电量在次日 0:00 的读数

    const rowMap: Record<number, any> = {};
    (rows as any[]).forEach((r) => { rowMap[r.hour] = r; });

    // 日总水量：优先使用次日 0:00 读数（与 analyzeEfficiency shift(-1) 一致）
    //            备选：当天各小时 MAX-MIN 累加
    const allMaxWater = (rows as any[]).map(r => Number(r.max_water) || 0).filter(v => v > 0);
    const allMinWater = (rows as any[]).map(r => Number(r.min_water) || 0).filter(v => v > 0);
    const globalMaxWater = allMaxWater.length > 0 ? Math.max(...allMaxWater) : 0;
    const globalMinWater = allMinWater.length > 0 ? Math.min(...allMinWater) : 0;
    const dailyTotalWaterFallback = globalMaxWater > globalMinWater ? globalMaxWater - globalMinWater : 0;
    // 次日 0:00 读数包含当天最终累计值，与 analyzeEfficiency 的 MAX(nextDay) 一致
    const dailyTotalWater = nextMaxWater > 0 ? nextMaxWater : dailyTotalWaterFallback;


    // 各小时 i_1034 均值，用于按比例分配水量
    const hourlyAvgFlow = Array.from({ length: 24 }, (_, h) => Number(rowMap[h]?.avg_flow) || 0);
    const totalAvgFlow = hourlyAvgFlow.reduce((s, v) => s + v, 0);

    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const row = rowMap[hour];
      const period = getPeriod(hour);

      // 每小时水量 = 日总量 × (本小时流量 / 全天流量总和)
      const avgFlow = hourlyAvgFlow[hour];
      const flowM3 = totalAvgFlow > 0 && dailyTotalWater > 0
        ? +(dailyTotalWater * avgFlow / totalAvgFlow).toFixed(1)
        : 0;

      const powerKwh = row ? Math.max(Number(row.hour_power_kwh) || 0, 0) : 0;
      const pressure  = row ? (Number(row.avg_pressure) || 0) : 0;

      // 千吨水电耗 (kWh/kt)
      const power1000t    = flowM3 > 0 && powerKwh > 0 ? +(powerKwh * 1000 / flowM3).toFixed(2) : null;
      // 千吨水兆帕电耗
      const power1000tMpa = pressure > 0 && power1000t ? +(power1000t / pressure).toFixed(2) : null;
      // 泵组综合效率 (%) = 0.278 × P(MPa) × 1000 / (kWh/kt) × 100
      const pumpEff = power1000t && power1000t > 0 && pressure > 0
        ? +(0.278 * pressure * 1000 / power1000t * 100).toFixed(2)
        : null;

      const pump1   = row ? (Number(row.max_pump1_freq) > 5 ? '启' : '停') : '停';
      const pump2   = row ? (Number(row.max_pump2_freq) > 5 ? '启' : '停') : '停';
      const auxPump = row ? (Number(row.max_aux_freq)   > 5 ? '启' : '停') : '停';

      return {
        hour,
        label:           `${hour}:00`,
        period,
        period_name:     PERIOD_NAMES[period],
        flow_m3:         flowM3,
        pressure_mpa:    +pressure.toFixed(4),
        power_kwh:       +powerKwh.toFixed(1),
        power_1000t:     power1000t,
        power_1000t_mpa: power1000tMpa,
        pump_efficiency: pumpEff,
        pump1,
        pump2,
        aux_pump:        auxPump,
      };
    });

    // 日电量总量：优先使用次日 0:00 读数（与 analyzeEfficiency 的 MAX(nextDay) 一致）
    const totalPowerFallback = hourlyData.reduce((s, h) => s + h.power_kwh, 0);
    const dailyTotalPower = nextMaxElec > 0 ? nextMaxElec : totalPowerFallback;

    // 日总量（小时累加）
    const totalFlow  = hourlyData.reduce((s, h) => s + h.flow_m3, 0);
    const totalPower = dailyTotalPower;
    const pressHours = hourlyData.filter(h => h.pressure_mpa > 0);
    const avgPressure = pressHours.length > 0
      ? pressHours.reduce((s, h) => s + h.pressure_mpa, 0) / pressHours.length : 0;
    const dailyP1000t = totalFlow > 0 && totalPower > 0 ? totalPower * 1000 / totalFlow : null;
    const effHours = hourlyData.filter(h => h.pump_efficiency != null && h.pump_efficiency > 0);
    const avgPumpEff = effHours.length > 0
      ? effHours.reduce((s, h) => s + (h.pump_efficiency ?? 0), 0) / effHours.length : null;

    const summary = {
      total_flow_m3:       +totalFlow.toFixed(0),
      total_power_kwh:     +totalPower.toFixed(1),
      avg_pressure_mpa:    +avgPressure.toFixed(4),
      daily_power_1000t:   dailyP1000t ? +dailyP1000t.toFixed(2) : null,
      avg_pump_efficiency: avgPumpEff  ? +avgPumpEff.toFixed(2)  : null,
    };

    return NextResponse.json({ success: true, date: targetDate, hourly: hourlyData, summary });
  } catch (error) {
    console.error('岩湖调度数据查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
