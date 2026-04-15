/**
 * API: 福安城东-岩湖联合供水运行监控
 * 返回指定日期（默认昨天）的分时段（小时）供水数据
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

    // 默认昨天，支持传入指定日期
    const yesterday = new Date(Date.now() - 86400000);
    const targetDate =
      dateParam ||
      `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const [rows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time) as hour,
        AVG(CASE WHEN i_1102 > 0 AND i_1102 < 10000 THEN i_1102 END) as chengdong_avg_flow,
        AVG(CASE WHEN i_1034 > 0 AND i_1034 < 10000 THEN i_1034 END) as yanhu_avg_flow,
        COUNT(*) as cnt
      FROM fuan_data
      WHERE DATE(collect_time) = ?
      GROUP BY HOUR(collect_time)
      ORDER BY HOUR(collect_time)
      `,
      [targetDate]
    );

    const rowMap: Record<number, any> = {};
    (rows as any[]).forEach((r) => { rowMap[r.hour] = r; });

    // 补全24小时，缺失小时填0
    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const row = rowMap[hour];
      const period = getPeriod(hour);
      const chengdong = row ? Math.round(row.chengdong_avg_flow || 0) : 0;
      const yanhu = row ? Math.round(row.yanhu_avg_flow || 0) : 0;
      return {
        hour,
        label: `${hour}:00`,
        chengdong_supply: chengdong,
        yanhu_supply: yanhu,
        total_supply: chengdong + yanhu,
        period,
        period_name: PERIOD_NAMES[period],
      };
    });

    // 按时段汇总
    const periodSummary = (['valley', 'flat', 'peak'] as const).map((period) => {
      const subset = hourlyData.filter((d) => d.period === period);
      return {
        period,
        period_name: PERIOD_NAMES[period],
        chengdong_total: subset.reduce((s, d) => s + d.chengdong_supply, 0),
        yanhu_total: subset.reduce((s, d) => s + d.yanhu_supply, 0),
        total: subset.reduce((s, d) => s + d.total_supply, 0),
      };
    });

    return NextResponse.json({
      success: true,
      date: targetDate,
      hourly: hourlyData,
      period_summary: periodSummary,
    });
  } catch (error) {
    console.error('联合供水数据查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
