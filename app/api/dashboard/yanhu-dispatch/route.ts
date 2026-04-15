/**
 * API: 福安岩湖水厂二级泵房高效节能智能调度运行分析
 *
 * 字段说明（经用户确认，与 joint-supply 路由保持一致）：
 *   i_1072 = 日累计电量 (kWh)   ← db.ts 别名 yanhu_daily_water，但实为电量
 *   i_1073 = 日累计水量 (m³)    ← db.ts 别名 yanhu_daily_power，但实为水量
 *
 * 计算方式：
 *   送水量 → i_1073 跨小时最大值差（排除 0:00 残留前一天读数）
 *   耗电量 → i_1072 跨小时最大值差（排除 0:00 残留前一天读数）
 *
 * 0:00 问题：日累计表在 0:00 瞬间仍保留前一天末尾值，需排除该分钟读数。
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

    // 查询每小时：
    //   i_1073 (水量表)、i_1072 (电量表) 的最大值
    //   —— 排除 0:00:00 整点读数，因该时刻仍保留前一天末尾值
    const [rows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time) AS hour,
        AVG(CASE WHEN i_1030 > 0.01 AND i_1030 < 2 THEN i_1030 END) AS avg_pressure,
        -- i_1073 实为日累计水量(m³)，排除 0:00 读数
        MAX(CASE
          WHEN NOT (HOUR(collect_time) = 0 AND MINUTE(collect_time) = 0)
            AND i_1073 > 0
          THEN i_1073
        END) AS max_water_meter,
        -- i_1072 实为日累计电量(kWh)，排除 0:00 读数
        MAX(CASE
          WHEN NOT (HOUR(collect_time) = 0 AND MINUTE(collect_time) = 0)
            AND i_1072 > 0
          THEN i_1072
        END) AS max_power_meter,
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

    const rowMap: Record<number, any> = {};
    (rows as any[]).forEach((r) => { rowMap[r.hour] = r; });

    // 计算跨小时差值：MAX(hour h) - MAX(hour h-1)
    // hour 0：累计表从 0 起，直接取 MAX(hour 0) 作为该小时增量
    function getHourlyDelta(
      map: Record<number, any>,
      field: 'max_water_meter' | 'max_power_meter',
      hour: number
    ): number {
      const cur = Number(map[hour]?.[field] ?? 0);
      if (cur <= 0) return 0;

      if (hour === 0) {
        // 第 0 小时：累计从 0 开始，MAX 即为该小时累计增量
        return +cur.toFixed(1);
      }

      // 找上一个有效小时的 MAX 值（可能有缺失小时，向前搜索）
      for (let h = hour - 1; h >= 0; h--) {
        const prev = Number(map[h]?.[field] ?? 0);
        if (prev > 0) {
          const delta = cur - prev;
          return delta > 0 ? +delta.toFixed(1) : 0;
        }
      }

      // 没找到有效前一小时，直接用当前值
      return +cur.toFixed(1);
    }

    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const row = rowMap[hour];
      const period = getPeriod(hour);

      const flowM3   = getHourlyDelta(rowMap, 'max_water_meter', hour); // m³
      const powerKwh = getHourlyDelta(rowMap, 'max_power_meter', hour); // kWh
      const pressure = row ? (Number(row.avg_pressure) || 0) : 0;

      // 千吨水电耗 (kWh/kt)
      const power1000t     = flowM3 > 0 && powerKwh > 0 ? +(powerKwh * 1000 / flowM3).toFixed(2) : null;
      // 千吨水兆帕电耗 (kWh/kt/MPa)
      const power1000tMpa  = pressure > 0 && power1000t ? +(power1000t / pressure).toFixed(2) : null;
      // 泵组综合效率 (%) = 0.278 × P(MPa) × 1000 / (kWh/kt) × 100
      const pumpEff        = power1000t && power1000t > 0 && pressure > 0
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
