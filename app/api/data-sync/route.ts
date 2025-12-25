/**
 * 数据同步 API
 * 支持手动触发数据同步任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDataSync, manualDataSync } from '@/lib/scheduler/dataSyncScheduler';

/**
 * GET /api/data-sync
 * 手动触发数据同步
 * 
 * 查询参数:
 * - date: 同步日期 (YYYYMMDD格式，可选，默认为昨天)
 * - start_date: 开始日期 (YYYYMMDD格式，批量同步时使用)
 * - end_date: 结束日期 (YYYYMMDD格式，批量同步时使用)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // 批量同步
    if (startDate) {
      console.log(`[API] 批量数据同步请求: ${startDate} - ${endDate || startDate}`);
      const results = await manualDataSync(startDate, endDate || undefined);
      
      const successCount = Array.isArray(results) 
        ? results.filter(r => r.success).length 
        : (results.success ? 1 : 0);
      
      const totalCount = Array.isArray(results) ? results.length : 1;
      
      return NextResponse.json({
        success: successCount === totalCount,
        message: `同步完成: ${successCount}/${totalCount} 成功`,
        results
      });
    }

    // 单日同步
    console.log(`[API] 单日数据同步请求: ${date || '昨天'}`);
    const result = await runDataSync(date || undefined);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: '数据同步成功',
        output: result.output
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '数据同步失败',
        error: result.error,
        output: result.output
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[API] 数据同步错误:', error);
    return NextResponse.json({
      success: false,
      message: '数据同步异常',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * POST /api/data-sync
 * 手动触发数据同步（支持请求体）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, start_date, end_date } = body;

    // 批量同步
    if (start_date) {
      console.log(`[API] 批量数据同步请求: ${start_date} - ${end_date || start_date}`);
      const results = await manualDataSync(start_date, end_date);
      
      const successCount = Array.isArray(results) 
        ? results.filter(r => r.success).length 
        : (results.success ? 1 : 0);
      
      const totalCount = Array.isArray(results) ? results.length : 1;
      
      return NextResponse.json({
        success: successCount === totalCount,
        message: `同步完成: ${successCount}/${totalCount} 成功`,
        results
      });
    }

    // 单日同步
    console.log(`[API] 单日数据同步请求: ${date || '昨天'}`);
    const result = await runDataSync(date);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: '数据同步成功',
        output: result.output
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '数据同步失败',
        error: result.error,
        output: result.output
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[API] 数据同步错误:', error);
    return NextResponse.json({
      success: false,
      message: '数据同步异常',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
