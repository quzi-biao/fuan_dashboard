/**
 * API: 导出压力计数据
 */
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// 压力计配置
const PRESSURE_METERS = [
  { sn: '862006079084137', label: '一中新校区' },
  { sn: '862006079089300', label: '农垦人花苑' },
  { sn: '862006078962366', label: '涧里小区' },
  { sn: '862006078966540', label: '天马山庄' },
  { sn: '862006078965385', label: '农校' },
  { sn: '862006079083873', label: '阳头小学外墙' },
  { sn: '862006078961665', label: '老干新村' }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    const pool = getPool();
    
    // 查询所有压力计数据
    const [rows] = await pool.query<any[]>(`
      SELECT 
        collect_time,
        press_4137,
        press_9300,
        press_2366,
        press_6540,
        press_5385,
        press_3873,
        press_1665
      FROM fuan_data
      WHERE DATE(collect_time) >= ? 
        AND DATE(collect_time) <= ?
      ORDER BY collect_time
    `, [startDate, endDate]);
    
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: '没有数据' }, { status: 404 });
    }
    
    // 生成CSV内容
    const headers = ['时间', ...PRESSURE_METERS.map(m => m.label)];
    const csvRows = [headers.join(',')];
    
    rows.forEach(row => {
      const time = new Date(row.collect_time).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const values = [
        time,
        row.press_4137 || 0,
        row.press_9300 || 0,
        row.press_2366 || 0,
        row.press_6540 || 0,
        row.press_5385 || 0,
        row.press_3873 || 0,
        row.press_1665 || 0
      ];
      
      csvRows.push(values.join(','));
    });
    
    const csv = csvRows.join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM
    
    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pressure_data_${startDate}_${endDate}.csv"`
      }
    });
    
  } catch (error) {
    console.error('导出压力数据失败:', error);
    return NextResponse.json(
      { error: '导出数据失败' },
      { status: 500 }
    );
  }
}
