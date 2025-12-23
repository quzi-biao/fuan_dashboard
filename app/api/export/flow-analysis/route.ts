/**
 * API: 导出流量数据分时段分析报表
 */
import { NextResponse } from 'next/server';
import { getRecentData, getDataByDateRange } from '@/lib/db';
import { analyzeFlowByElectricityPeriod } from '@/lib/analysis';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const days = parseInt(searchParams.get('days') || '7');
    
    // 获取数据 - 优先使用日期范围查询
    let rawData;
    if (startDate && endDate) {
      rawData = await getDataByDateRange(startDate, endDate);
    } else {
      rawData = await getRecentData(days);
    }
    
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: '没有数据' }, { status: 404 });
    }
    
    // 转换数据格式
    const data = rawData.map(row => ({
      collect_time: new Date(row.collect_time),
      chengdong_flow: Number(row.chengdong_flow),
      yanhu_flow: Number(row.yanhu_flow),
      yanhu_pressure: row.yanhu_pressure ? Number(row.yanhu_pressure) : undefined,
      yanhu_daily_water: row.yanhu_daily_water ? Number(row.yanhu_daily_water) : undefined,
      yanhu_daily_power: row.yanhu_daily_power ? Number(row.yanhu_daily_power) : undefined,
    }));
    
    // 分析数据
    const analysis = analyzeFlowByElectricityPeriod(data);
    
    // 生成CSV内容
    const csvRows = [
      ['日期', '时段', '城东平均流量(m³/h)', '岩湖平均流量(m³/h)', '城东累积流量(m³)', '岩湖累积流量(m³)', '总累积流量(m³)', '岩湖电量(kWh)'],
      ...analysis.map(row => [
        row.date,
        row.period_name,
        row.chengdong_avg_flow.toFixed(2),
        row.yanhu_avg_flow.toFixed(2),
        row.chengdong_cumulative_flow.toFixed(2),
        row.yanhu_cumulative_flow.toFixed(2),
        row.total_cumulative_flow.toFixed(2),
        row.yanhu_electricity.toFixed(2)
      ])
    ];
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM for Excel
    
    return new NextResponse(bom + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="flow-analysis-${startDate || 'recent'}-${endDate || 'now'}.csv"`
      }
    });
  } catch (error) {
    console.error('导出流量分析失败:', error);
    return NextResponse.json(
      { error: '导出失败' },
      { status: 500 }
    );
  }
}
