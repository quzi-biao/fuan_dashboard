/**
 * 数据同步定时任务
 * 每天凌晨3点执行前一天的数据同步
 */

import { spawn } from 'child_process';
import path from 'path';
import cron from 'node-cron';

const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'fuan_data_sync.py');

/**
 * 执行数据同步脚本
 * @param date 同步日期 (格式: YYYYMMDD)
 */
export async function runDataSync(date?: string): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    // 如果没有指定日期，使用昨天的日期
    const syncDate = date || getYesterdayDate();
    
    console.log(`[数据同步] 开始同步数据: ${syncDate}`);
    
    // 执行 Python 脚本
    const pythonProcess = spawn('python3', [
      PYTHON_SCRIPT_PATH,
      '--date', syncDate
    ]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.log(`[数据同步] ${message.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      console.error(`[数据同步错误] ${message.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[数据同步] 同步完成: ${syncDate}`);
        resolve({ success: true, output });
      } else {
        console.error(`[数据同步] 同步失败，退出码: ${code}`);
        resolve({ 
          success: false, 
          output, 
          error: errorOutput || `进程退出码: ${code}` 
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`[数据同步] 执行错误:`, error);
      resolve({ 
        success: false, 
        output, 
        error: error.message 
      });
    });
  });
}

/**
 * 获取昨天的日期 (YYYYMMDD格式)
 */
function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  
  return `${year}${month}${day}`;
}

/**
 * 启动定时任务
 * 每天凌晨3点执行
 */
export function startDataSyncScheduler() {
  // cron 表达式: 秒 分 时 日 月 周
  // '0 3 * * *' 表示每天凌晨3点0分
  const cronExpression = '0 3 * * *';
  
  console.log('[定时任务] 数据同步定时任务已启动，将在每天凌晨3点执行');
  
  const task = cron.schedule(cronExpression, async () => {
    console.log('[定时任务] 触发数据同步任务');
    const result = await runDataSync();
    
    if (result.success) {
      console.log('[定时任务] 数据同步成功');
    } else {
      console.error('[定时任务] 数据同步失败:', result.error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai' // 使用北京时间
  });

  // 返回任务实例，以便需要时可以停止
  return task;
}

/**
 * 手动触发数据同步（用于测试或手动补数据）
 */
export async function manualDataSync(startDate: string, endDate?: string) {
  console.log(`[手动同步] 开始同步数据: ${startDate} ${endDate ? `到 ${endDate}` : ''}`);
  
  // 如果没有结束日期，只同步单天
  if (!endDate) {
    return await runDataSync(startDate);
  }
  
  // 如果有结束日期，循环同步每一天
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const results = [];
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = formatDate(date);
    const result = await runDataSync(dateStr);
    results.push({ date: dateStr, ...result });
    
    // 避免过快执行，等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * 解析日期字符串 (YYYYMMDD)
 */
function parseDate(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));
  return new Date(year, month, day);
}

/**
 * 格式化日期为 YYYYMMDD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}
