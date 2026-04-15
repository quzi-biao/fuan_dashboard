/**
 * API: 福安岩湖水厂二级泵房高效节能智能调度运行分析
 * 送水量：i_1072 水表跨小时差值（更准确，与flow-analysis方法一致）
 * 耗电量：i_1073 电表跨小时差值（MAX(hour h) - MAX(hour h-1)）
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

    // 查询每小时：流量均值(备用)、压力均值、水表最大值、电表最大值、泵频率
    const [rows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time)                                                AS hour,
        AVG(CASE WHEN i_1034 > 0 AND i_1034 < 10000 THEN i_1034 END)   AS avg_flow,
        AVG(CASE WHEN i_1030 > 0.01 AND i_1030 < 2   THEN i_1030 END)  AS avg_pressure,
        MAX(CASE WHEN i_1072 > 0 THEN i_1072 END)                       AS max_water_meter,
        MAX(CASE WHEN i_1073 > 0 THEN i_1073 END)                       AS max_power_meter,
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

    // 构建每小时最大水表/电表映射（含缺失小时）
    const rowMap: Record<number, any> = {};
    (rows as any[]).forEach((r) => { rowMap[r.hour] = r; });

    // 计算跨小时差值
    // MAX(hour h) - MAX(hour h-1)：水表/电表日累计，相邻最大值差 = 该小时增量
    function getHourlyDelta(
      map: Record<number, any>,
      field: 'max_water_meter' | 'max_power_meter',
      hour: number
    ): number {
      const cur = map[hour]?.[field];
      if (cur == null || Number(cur) <= 0) return 0;

      // 查找上一个有效小时
      let prevVal: number | null = null;
      for (let h = hour - 1; h >= 0; h--) {
        const v = map[h]?.[field];
        if (v != null && Number(v) > 0) { prevVal = Number(v); break; }
      }

      // 第一个有效小时：用本小时最大值 - 最小值兜底
      if (prevVal == null) {
        const row = map[hour];
        // 首小时没有前一小时参考，用 avg_flow 估算
        const avgFlow = Number(row?.avg_flow) || 0;
        return field === 'max_water_meter' ? +avgFlow.toFixed(1) : 0;
      }

      const delta = Number(cur) - prevVal;
      return delta > 0 ? +delta.toFixed(1) : 0;
    }

    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const row = rowMap[hour];
      const period = getPeriod(hour);

      const flowM3   = getHourlyDelta(rowMap, 'max_water_meter', hour);   // m³ (水表差值)
      const powerKwh = getHourlyDelta(rowMap, 'max_power_meter', hour);   // kWh (电表差值)
      const pressure = row ? (Number(row.avg_pressure) || 0) : 0;          // MPa

      // 千吨水电耗 = kWh / (m³ / 1000) = kWh·kt / m³
      const power1000t    = flowM3 > 0 && powerKwh > 0 ? +(powerKwh * 1000 / flowM3).toFixed(2) : null;
      // 千吨水兆帕电耗
      const power1000tMpa = pressure > 0 && power1000t ? +(power1000t / pressure).toFixed(2) : null;
      // 泵组综合效率 (%) = 0.278 × P [MPa] × 1000 / (kWh/kt) × 100
      const pumpEff = power1000t && power1000t > 0 && pressure > 0
        ? +(0.278 * pressure * 1000 / power1000t * 100).toFixed(2)
        : null;

      // 泵状态 (频率 > 5Hz → 启)
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

    return NextResponse.json({ success: true, date: targetDate, hourly: hourlyData });
  } catch (error) {
    console.error('岩湖调度数据查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
