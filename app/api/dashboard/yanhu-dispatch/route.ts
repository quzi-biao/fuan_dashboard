/**
 * API: 福安岩湖水厂二级泵房高效节能智能调度运行分析
 *
 * 字段（i_1072/i_1073 物理含义与 joint-supply 注释一致，db.ts 标签相反）：
 *   i_1072 (yanhu_daily_water in db) = 实为日累计电量 (kWh)
 *   i_1073 (yanhu_daily_power in db) = 实为日累计水量 (m³)
 *
 * 日总量 = MAX(i_1073) / MAX(i_1072) for targetDate（与 analyzeEfficiency 完全一致）
 * 小时值 = 按比例分配日总量（保证 sum(小时) = 日总量，消除累加不一致）
 *   - 送水量权重：AVG(i_1034) 每小时瞬时流量
 *   - 耗电量权重：MAX(i_1072) - MIN(i_1072) 每小时差值（i_1072 每分钟更新）
 *   - 0:00 排除：每小时差值计算时排除，避免前一天残留读数干扰权重
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

    // ① 每小时聚合（用于权重分配 + 压力 + 泵频）
    const [rows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time) AS hour,
        AVG(CASE WHEN i_1034 > 0 AND i_1034 < 10000 THEN i_1034 END) AS avg_flow,
        AVG(CASE WHEN i_1030 > 0.01 AND i_1030 < 2   THEN i_1030 END) AS avg_pressure,
        -- i_1072 差值作为耗电量分配权重（排除 0:00 前一天残留读数）
        MAX(CASE WHEN NOT (HOUR(collect_time)=0 AND MINUTE(collect_time)=0) AND i_1072 > 0 THEN i_1072 END)
          - MIN(CASE WHEN NOT (HOUR(collect_time)=0 AND MINUTE(collect_time)=0) AND i_1072 > 0 THEN i_1072 END)
          AS hour_power_weight,
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

    // ② 日总量：MAX(i_1073)/MAX(i_1072)，与 analyzeEfficiency 完全一致
    const [totalRows] = await pool.query<any[]>(
      `
      SELECT
        MAX(CASE WHEN i_1073 > 0 THEN i_1073 END) AS daily_water,
        MAX(CASE WHEN i_1072 > 0 THEN i_1072 END) AS daily_elec
      FROM fuan_data
      WHERE DATE(collect_time) = ?
      `,
      [targetDate]
    );
    const tr = (totalRows as any[])[0] ?? {};
    const dailyTotalWater = Number(tr.daily_water) || 0; // MAX(i_1073) = 47093 m³
    const dailyTotalElec  = Number(tr.daily_elec)  || 0; // MAX(i_1072) = 6450 kWh

    const rowMap: Record<number, any> = {};
    (rows as any[]).forEach((r) => { rowMap[r.hour] = r; });

    // 权重汇总（用于比例分配）
    const flowWeights  = Array.from({ length: 24 }, (_, h) => Math.max(Number(rowMap[h]?.avg_flow)         || 0, 0));
    const powerWeights = Array.from({ length: 24 }, (_, h) => Math.max(Number(rowMap[h]?.hour_power_weight) || 0, 0));
    const totalFlowWeight  = flowWeights.reduce((s, v) => s + v, 0);
    const totalPowerWeight = powerWeights.reduce((s, v) => s + v, 0);

    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const row = rowMap[hour];
      const period = getPeriod(hour);

      // 按权重比例分配日总量 → sum(小时) = 日总量（精确）
      const flowM3   = totalFlowWeight  > 0 && dailyTotalWater > 0
        ? +(dailyTotalWater * flowWeights[hour]  / totalFlowWeight).toFixed(1)  : 0;
      const powerKwh = totalPowerWeight > 0 && dailyTotalElec  > 0
        ? +(dailyTotalElec  * powerWeights[hour] / totalPowerWeight).toFixed(1) : 0;

      const pressure = row ? (Number(row.avg_pressure) || 0) : 0;

      // 千吨水电耗 (kWh/kt)
      const power1000t    = flowM3 > 0 && powerKwh > 0 ? +(powerKwh * 1000 / flowM3).toFixed(2) : null;
      // 千吨水兆帕电耗
      const power1000tMpa = pressure > 0 && power1000t ? +(power1000t / pressure).toFixed(2) : null;
      // 泵组综合效率 (%)
      const pumpEff = power1000t && power1000t > 0 && pressure > 0
        ? +(0.278 * pressure * 1000 / power1000t * 100).toFixed(2) : null;

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
        power_kwh:       powerKwh,
        power_1000t:     power1000t,
        power_1000t_mpa: power1000tMpa,
        pump_efficiency: pumpEff,
        pump1,
        pump2,
        aux_pump:        auxPump,
      };
    });

    // 日汇总 = 小时累加（与日总量精确一致，无舍入误差之外的偏差）
    const totalFlow  = hourlyData.reduce((s, h) => s + h.flow_m3, 0);
    const totalPower = hourlyData.reduce((s, h) => s + h.power_kwh, 0);
    const pressHours = hourlyData.filter(h => h.pressure_mpa > 0);
    const avgPressure = pressHours.length > 0
      ? pressHours.reduce((s, h) => s + h.pressure_mpa, 0) / pressHours.length : 0;
    const dailyP1000t  = totalFlow > 0 && totalPower > 0 ? totalPower * 1000 / totalFlow : null;
    const effHours = hourlyData.filter(h => h.pump_efficiency != null && h.pump_efficiency > 0);
    const avgPumpEff = effHours.length > 0
      ? effHours.reduce((s, h) => s + (h.pump_efficiency ?? 0), 0) / effHours.length : null;

    return NextResponse.json({
      success: true,
      date: targetDate,
      hourly: hourlyData,
      summary: {
        total_flow_m3:       +totalFlow.toFixed(0),
        total_power_kwh:     +totalPower.toFixed(1),
        avg_pressure_mpa:    +avgPressure.toFixed(4),
        daily_power_1000t:   dailyP1000t  ? +dailyP1000t.toFixed(2)  : null,
        avg_pump_efficiency: avgPumpEff   ? +avgPumpEff.toFixed(2)   : null,
      },
    });
  } catch (error) {
    console.error('岩湖调度数据查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
