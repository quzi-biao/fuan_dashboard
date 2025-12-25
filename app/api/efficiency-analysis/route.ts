/**
 * API: 岩湖水厂能效分析
 */
import { NextResponse } from 'next/server';
import { getRecentData, getDataByDateRange } from '@/lib/db';
import { analyzeEfficiency } from '@/lib/analysis';

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
    const data = rawData.map((row: any) => ({
      collect_time: new Date(row.collect_time),
      chengdong_flow: Number(row.chengdong_flow),
      yanhu_flow: Number(row.yanhu_flow),
      yanhu_pressure: row.yanhu_pressure ? Number(row.yanhu_pressure) : undefined,
      yanhu_daily_water: row.yanhu_daily_water ? Number(row.yanhu_daily_water) : undefined,
      yanhu_daily_power: row.yanhu_daily_power ? Number(row.yanhu_daily_power) : undefined,
    }));
    
    // 分析数据
    const analysis = analyzeEfficiency(data);
    
    return NextResponse.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('能效分析失败:', error);
    return NextResponse.json(
      { error: '分析失败' },
      { status: 500 }
    );
  }
}
