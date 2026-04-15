/**
 * API: 福安岩湖水厂二级泵房高效节能智能调度运行分析
 *
 * 字段（与 analyzeEfficiency / db.ts 一致，不做任何swap）：
 *   i_1072 = yanhu_daily_water = 日累计水量 (m³)
 *   i_1073 = yanhu_daily_power = 日累计电量 (kWh)
 *
 * 日汇总：直接取 MAX(i_1072) / MAX(i_1073)，与 analyzeEfficiency 完全一致
 * 小时耗电：MAX(i_1073) - MIN(i_1073) per hour（排除 0:00 前一天残留值）
 * 小时送水：AVG(i_1034)，与 joint-supply 路由一致
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

    // 并行查询：小时聚合 + 日累计总量
    const [[hourRows], [totalRows]] = await Promise.all([
      pool.query<any[]>(
        `
        SELECT
          HOUR(collect_time) AS hour,
          AVG(CASE WHEN i_1034 > 0 AND i_1034 < 10000 THEN i_1034 END) AS avg_flow,
          AVG(CASE WHEN i_1030 > 0.01 AND i_1030 < 2   THEN i_1030 END) AS avg_pressure,
          -- 耗电量：i_1073 日累计电量表，排除 0:00 整点前一天残留读数
          MAX(CASE WHEN NOT (HOUR(collect_time) = 0 AND MINUTE(collect_time) = 0) AND i_1073 > 0 THEN i_1073 END)
            - MIN(CASE WHEN NOT (HOUR(collect_time) = 0 AND MINUTE(collect_time) = 0) AND i_1073 > 0 THEN i_1073 END)
            AS hour_power_kwh,
          MAX(i_1049) AS max_pump1_freq,
          MAX(i_1050) AS max_pump2_freq,
          MAX(i_1051) AS max_aux_freq
        FROM fuan_data
        WHERE DATE(collect_time) = ?
        GROUP BY HOUR(collect_time)
        ORDER BY HOUR(collect_time)
        `,
        [targetDate]
      ),
      // 日汇总：与 analyzeEfficiency 完全一致，直接取 MAX
      pool.query<any[]>(
        `
        SELECT
          MAX(CASE WHEN NOT (HOUR(collect_time) = 0 AND MINUTE(collect_time) = 0) AND i_1072 > 0 THEN i_1072 END)
            AS total_water_m3,
          MAX(CASE WHEN NOT (HOUR(collect_time) = 0 AND MINUTE(collect_time) = 0) AND i_1073 > 0 THEN i_1073 END)
            AS total_power_kwh,
          AVG(CASE WHEN i_1030 > 0.01 AND i_1030 < 2 THEN i_1030 END) AS avg_pressure
        FROM fuan_data
        WHERE DATE(collect_time) = ?
        `,
        [targetDate]
      ),
    ]);

    const rowMap: Record<number, any> = {};
    (hourRows as any[]).forEach((r) => { rowMap[r.hour] = r; });

    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const row = rowMap[hour];
      const period = getPeriod(hour);

      const flowM3   = row ? Math.round(Number(row.avg_flow) || 0) : 0;
      const powerKwh = row ? Math.max(Number(row.hour_power_kwh) || 0, 0) : 0;
      const pressure = row ? (Number(row.avg_pressure) || 0) : 0;

      // 千吨水电耗 (kWh/kt) = kWh × 1000 / m³
      const power1000t    = flowM3 > 0 && powerKwh > 0 ? +(powerKwh * 1000 / flowM3).toFixed(2) : null;
      // 千吨水兆帕电耗 (kWh/kt/MPa)
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

    // 日汇总（直接用累计表最大值，与 analyzeEfficiency 方法一致）
    const tr = (totalRows as any[])[0] ?? {};
    const totalWater = Number(tr.total_water_m3) || 0;
    const totalPower = Number(tr.total_power_kwh) || 0;
    const avgPressure = Number(tr.avg_pressure) || 0;
    const dailyPower1000t = totalWater > 0 && totalPower > 0 ? totalPower * 1000 / totalWater : null;

    const effHours = hourlyData.filter(h => h.pump_efficiency != null && h.pump_efficiency > 0);
    const avgPumpEff = effHours.length > 0
      ? effHours.reduce((s, h) => s + (h.pump_efficiency ?? 0), 0) / effHours.length
      : null;

    const summary = {
      total_flow_m3:       +totalWater.toFixed(0),
      total_power_kwh:     +totalPower.toFixed(1),
      avg_pressure_mpa:    +avgPressure.toFixed(4),
      daily_power_1000t:   dailyPower1000t ? +dailyPower1000t.toFixed(2) : null,
      avg_pump_efficiency: avgPumpEff ? +avgPumpEff.toFixed(2) : null,
    };

    return NextResponse.json({ success: true, date: targetDate, hourly: hourlyData, summary });
  } catch (error) {
    console.error('岩湖调度数据查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
