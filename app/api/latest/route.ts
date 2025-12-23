/**
 * API: 获取最新一条数据
 */
import { NextResponse } from 'next/server';
import { getLatestData } from '@/lib/db';

export async function GET() {
  try {
    const data = await getLatestData();
    
    if (!data) {
      return NextResponse.json({ error: '没有数据' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        collect_time: data.collect_time,
        chengdong_flow: Number(data.chengdong_flow),
        yanhu_flow: Number(data.yanhu_flow),
        yanhu_pressure: Number(data.yanhu_pressure),
        yanhu_daily_water: Number(data.yanhu_daily_water),
        yanhu_daily_power: Number(data.yanhu_daily_power),
      }
    });
  } catch (error) {
    console.error('获取最新数据失败:', error);
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    );
  }
}
