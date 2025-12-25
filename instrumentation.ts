/**
 * Next.js Instrumentation
 * 在应用启动时执行初始化逻辑
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 只在 Node.js 运行时执行（服务端）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeSchedulers } = await import('./lib/scheduler');
    
    console.log('[应用启动] 初始化定时任务...');
    initializeSchedulers();
  }
}
