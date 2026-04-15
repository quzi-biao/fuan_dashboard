/**
 * API: 福安岩湖水厂二级泵房高效节能智能调度运行分析
 * 返回指定日期的每小时数据：送水量、送水压力、耗电量、千吨水电耗、千吨水兆帕电耗、泵组综合效率、泵运行状态
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

    // 每小时聚合：流量、压力、累计电表、泵频率
    const [rows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time)                                                AS hour,
        AVG(CASE WHEN i_1034 > 0 AND i_1034 < 10000 THEN i_1034 END)   AS avg_flow,
        AVG(CASE WHEN i_1030 > 0.01 AND i_1030 < 2   THEN i_1030 END)  AS avg_pressure,
        MAX(CASE WHEN i_1073 >= 0 THEN i_1073 END) - MIN(CASE WHEN i_1073 >= 0 THEN i_1073 END)
                                                                          AS hour_power_kwh,
        MAX(i_1049)                                                       AS max_pump1_freq,
        MAX(i_1050)                                                       AS max_pump2_freq,
        MAX(i_1051)                                                       AS max_aux_freq
      FROM fuan_data
      WHERE DATE(collect_time) = ?
      GROUP BY HOUR(collect_time)
      ORDER BY HOUR(collect_time)
      `,
      [targetDate]
    );

    const rowMap: Record<number, any> = {};
    (rows as any[]).forEach((r) => { rowMap[r.hour] = r; });

    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const row = rowMap[hour];
      const period = getPeriod(hour);

      const flowM3      = row ? (Number(row.avg_flow) || 0) : 0;         // m³/h avg → hourly volume
      const pressure    = row ? (Number(row.avg_pressure) || 0) : 0;     // MPa
      const powerKwh    = row ? Math.max(Number(row.hour_power_kwh) || 0, 0) : 0; // kWh

      // 千吨水电耗 = kWh / (m³ / 1000)
      const power1000t  = flowM3 > 0 && powerKwh > 0 ? +(powerKwh * 1000 / flowM3).toFixed(2) : null;
      // 千吨水兆帕电耗
      const power1000tMpa = pressure > 0 && power1000t ? +(power1000t / pressure).toFixed(2) : null;
      // 泵组综合效率 (%) = 0.278 × P [MPa] × 1000 / (kWh/kt) × 100
      const pumpEff     = power1000t && power1000t > 0 && pressure > 0
        ? +(0.278 * pressure * 1000 / power1000t * 100).toFixed(2)
        : null;

      // 泵状态 (频率 > 5Hz → 启)
      const pump1 = row ? (Number(row.max_pump1_freq) > 5 ? '启' : '停') : '停';
      const pump2 = row ? (Number(row.max_pump2_freq) > 5 ? '启' : '停') : '停';
      const auxPump = row ? (Number(row.max_aux_freq) > 5 ? '启' : '停') : '停';

      return {
        hour,
        label:          `${hour}:00`,
        period,
        period_name:    PERIOD_NAMES[period],
        flow_m3:        +flowM3.toFixed(1),
        pressure_mpa:   +pressure.toFixed(4),
        power_kwh:      +powerKwh.toFixed(1),
        power_1000t:    power1000t,
        power_1000t_mpa: power1000tMpa,
        pump_efficiency: pumpEff,
        pump1,
        pump2,
        aux_pump:       auxPump,
      };
    });

    return NextResponse.json({ success: true, date: targetDate, hourly: hourlyData });
  } catch (error) {
    console.error('岩湖调度数据查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
