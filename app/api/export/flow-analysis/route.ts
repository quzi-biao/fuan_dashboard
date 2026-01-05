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
    
    // 验证日期范围
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // 检查日期是否有效
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: '无效的日期格式' },
          { status: 400 }
        );
      }
      
      // 检查开始日期不能晚于结束日期
      if (start > end) {
        return NextResponse.json(
          { error: '开始日期不能晚于结束日期' },
          { status: 400 }
        );
      }
    }
    
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
    
    // 按日期分组
    const groupedByDate = analysis.reduce((acc, row) => {
      if (!acc[row.date]) {
        acc[row.date] = {};
      }
      acc[row.date][row.period] = row;
      return acc;
    }, {} as Record<string, Record<string, any>>);
    
    // 生成CSV内容 - 每个日期一行，包含所有时段
    const csvRows = [
      [
        '日期',
        '谷电城东流量(m³)', '谷电岩湖电量(kWh)', '谷电岩湖流量(m³)',
        '平电城东流量(m³)', '平电岩湖电量(kWh)', '平电岩湖流量(m³)',
        '峰电城东流量(m³)', '峰电岩湖电量(kWh)', '峰电岩湖流量(m³)',
        '总计城东流量(m³)', '总计岩湖电量(kWh)', '总计岩湖流量(m³)', '总供水量(m³)'
      ]
    ];
    
    // 按日期降序排序
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));
    
    sortedDates.forEach(date => {
      const dayData = groupedByDate[date];
      const valley = dayData['valley'] || {};
      const flat = dayData['flat'] || {};
      const peak = dayData['peak'] || {};
      const total = dayData['total'] || {};
      
      csvRows.push([
        date,
        (valley.chengdong_cumulative_flow || 0).toFixed(1),
        (valley.yanhu_cumulative_flow || 0).toFixed(1),
        (valley.yanhu_electricity || 0).toFixed(1),
        (flat.chengdong_cumulative_flow || 0).toFixed(1),
        (flat.yanhu_cumulative_flow || 0).toFixed(1),
        (flat.yanhu_electricity || 0).toFixed(1),
        (peak.chengdong_cumulative_flow || 0).toFixed(1),
        (peak.yanhu_cumulative_flow || 0).toFixed(1),
        (peak.yanhu_electricity || 0).toFixed(1),
        (total.chengdong_cumulative_flow || 0).toFixed(1),
        (total.yanhu_cumulative_flow || 0).toFixed(1),
        (total.yanhu_electricity || 0).toFixed(1),
        (total.total_cumulative_flow || 0).toFixed(1)
      ]);
    });
    
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
