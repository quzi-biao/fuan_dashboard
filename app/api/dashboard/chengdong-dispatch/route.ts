/**
 * API: 福安城东水厂智能错峰调度运行分析
 * 返回指定日期（默认昨天）的：
 *   - hourly: 每小时平均供水量、平均清水池水位、平均阀门开度
 *   - minute: 每5分钟的清水池水位和阀门开度原始数据（用于高精度折线）
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    const pool = getPool();

    // 优先使用传入日期，否则自动查找最近7天内有数据的最新日期
    let targetDate = dateParam || null;

    if (!targetDate) {
      const [recentDates] = await pool.query<any[]>(
        `
        SELECT DATE(collect_time) as d
        FROM fuan_data
        WHERE collect_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND i_1102 > 0
        GROUP BY DATE(collect_time)
        ORDER BY d DESC
        LIMIT 2
        `
      );
      if (recentDates.length >= 2) {
        targetDate = recentDates[1].d instanceof Date
          ? recentDates[1].d.toISOString().split('T')[0]
          : String(recentDates[1].d);
      } else if (recentDates.length === 1) {
        targetDate = recentDates[0].d instanceof Date
          ? recentDates[0].d.toISOString().split('T')[0]
          : String(recentDates[0].d);
      } else {
        return NextResponse.json({ error: '最近7天无供水数据' }, { status: 404 });
      }
    }

    // 每小时聚合：供水量 + 清水池水位 + 阀门开度
    const [hourlyRows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time) as hour,
        AVG(CASE WHEN i_1102 > 0 AND i_1102 < 10000 THEN i_1102 END) as chengdong_avg_flow,
        AVG(CASE WHEN i_1097 > 0.1 AND i_1097 < 20 THEN i_1097 END) as avg_water_level,
        MAX(CASE WHEN i_1098 >= 0 AND i_1098 <= 100 THEN i_1098 END) as max_valve_opening
      FROM fuan_data
      WHERE DATE(collect_time) = ?
      GROUP BY HOUR(collect_time)
      ORDER BY HOUR(collect_time)
      `,
      [targetDate]
    );

    // 每5分钟的原始清水池水位和阀门开度（高精度折线）
    const [minuteRows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time)   AS hour,
        MINUTE(collect_time) AS minute,
        i_1097 AS water_level,
        i_1098 AS valve_opening
      FROM fuan_data
      WHERE DATE(collect_time) = ?
        AND MINUTE(collect_time) % 5 = 0
        AND (
          (i_1097 IS NOT NULL AND i_1097 BETWEEN 0.1 AND 20)
          OR
          (i_1098 IS NOT NULL AND i_1098 BETWEEN 0 AND 100)
        )
      ORDER BY collect_time
      LIMIT 600
      `,
      [targetDate]
    );

    const rowMap: Record<number, any> = {};
    (hourlyRows as any[]).forEach((r) => { rowMap[r.hour] = r; });

    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const row = rowMap[hour];
      const period = getPeriod(hour);
      return {
        hour,
        label: `${hour}:00`,
        chengdong_supply: row ? Math.round(row.chengdong_avg_flow || 0) : 0,
        avg_water_level: row && row.avg_water_level ? +Number(row.avg_water_level).toFixed(2) : null,
        max_valve_opening: row && row.max_valve_opening != null ? +Number(row.max_valve_opening).toFixed(1) : null,
        period,
        period_name: PERIOD_NAMES[period],
      };
    });

    const minuteData = (minuteRows as any[]).map((row) => ({
      // timeDecimal: 分钟位置用于连续折线（0.0 ~ 23.999）
      timeDecimal: Number(row.hour) + Number(row.minute) / 60,
      label: `${row.hour}:${String(row.minute).padStart(2, '0')}`,
      water_level:
        row.water_level != null && row.water_level > 0.1
          ? +Number(row.water_level).toFixed(2)
          : null,
      valve_opening:
        row.valve_opening != null && row.valve_opening >= 0
          ? +Number(row.valve_opening).toFixed(1)
          : null,
    }));

    return NextResponse.json({
      success: true,
      date: targetDate,
      hourly: hourlyData,
      minute: minuteData,
    });
  } catch (error) {
    console.error('城东调度数据查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
