/**
 * API: 福安城东-岩湖联合供水运行监控
 * - 小时图表数据：SQL 分钟均值 × 1小时
 * - 时段汇总卡片：直接调用 analyzeFlowByElectricityPeriod（与流量分时段分析一致）
 *   岩湖用 i_1072 水表差值方法，精度更高
 */
import { NextResponse } from 'next/server';
import { getPool, getDataByDateRange } from '@/lib/db';
import { analyzeFlowByElectricityPeriod } from '@/lib/analysis';

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
          AND (i_1102 > 0 OR i_1034 > 0)
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

    // ① 每小时聚合（用于图表柱状图）
    const [rows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time) as hour,
        AVG(CASE WHEN i_1102 > 0 AND i_1102 < 10000 THEN i_1102 END) as chengdong_avg_flow,
        AVG(CASE WHEN i_1034 > 0 AND i_1034 < 10000 THEN i_1034 END) as yanhu_avg_flow
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

    // ② 时段汇总卡片：使用 analyzeFlowByElectricityPeriod（与流量分时段分析接口一致）
    //    岩湖使用 i_1072 水表差值法，精度远高于流量均值法
    const rawData = await getDataByDateRange(targetDate, targetDate);
    const flowRecords = rawData.map((r) => ({
      collect_time: new Date(r.collect_time),
      chengdong_flow: Number(r.chengdong_flow) || 0,
      yanhu_flow: Number(r.yanhu_flow) || 0,
      yanhu_pressure: r.yanhu_pressure != null ? Number(r.yanhu_pressure) : undefined,
      yanhu_daily_water: r.yanhu_daily_water != null ? Number(r.yanhu_daily_water) : undefined,
      yanhu_daily_power: r.yanhu_daily_power != null ? Number(r.yanhu_daily_power) : undefined,
    }));
    const analysisResults = analyzeFlowByElectricityPeriod(flowRecords);

    const periodSummary = (['valley', 'flat', 'peak'] as const).map((period) => {
      const res = analysisResults.find((r) => r.period === period);
      const chengdong = res ? Math.round(res.chengdong_cumulative_flow) : 0;
      const yanhu = res ? Math.round(res.yanhu_cumulative_flow) : 0;
      return {
        period,
        period_name: PERIOD_NAMES[period],
        chengdong_total: chengdong,
        yanhu_total: yanhu,
        total: chengdong + yanhu,
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
