/**
 * 定时任务初始化
 * 在应用启动时自动启动所有定时任务
 */

import { startDataSyncScheduler } from './dataSyncScheduler';

let isInitialized = false;

/**
 * 初始化所有定时任务
 */
export function initializeSchedulers() {
  if (isInitialized) {
    console.log('[定时任务] 已初始化，跳过重复初始化');
    return;
  }

  console.log('[定时任务] 开始初始化定时任务...');

  try {
    // 启动数据同步定时任务
    startDataSyncScheduler();
    
    isInitialized = true;
    console.log('[定时任务] 所有定时任务初始化完成');
  } catch (error) {
    console.error('[定时任务] 初始化失败:', error);
  }
}

/**
 * 检查定时任务是否已初始化
 */
export function isSchedulersInitialized(): boolean {
  return isInitialized;
}
