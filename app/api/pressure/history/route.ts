/**
 * API: 获取压力计历史数据
 */
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sn = searchParams.get('sn');
    
    if (!startDate || !endDate || !sn) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    const pool = getPool();
    const fieldName = `press_${sn.slice(-4)}`;
    
    // 查询指定时间范围内的压力数据（按分钟）
    const [rows] = await pool.query<any[]>(`
      SELECT 
        collect_time,
        ${fieldName} as pressure
      FROM fuan_data
      WHERE DATE(collect_time) >= ? 
        AND DATE(collect_time) <= ?
        AND ${fieldName} > 0
      ORDER BY collect_time
    `, [startDate, endDate]);
    
    return NextResponse.json({
      success: true,
      data: rows,
      sn: sn
    });
    
  } catch (error) {
    console.error('获取压力历史数据失败:', error);
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    );
  }
}
