/**
 * 配置缓存工具
 * 用于在 localStorage 中保存和加载组件配置
 */

/**
 * 从 localStorage 加载配置
 * @param cacheKey - 缓存键名
 * @returns 缓存的配置对象，如果不存在或解析失败则返回 null
 */
export function loadConfigFromCache<T = any>(cacheKey: string): T | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error(`加载配置缓存失败 (${cacheKey}):`, e);
    return null;
  }
}

/**
 * 保存配置到 localStorage
 * @param cacheKey - 缓存键名
 * @param config - 要保存的配置对象
 */
export function saveConfigToCache(cacheKey: string, config: any): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(cacheKey, JSON.stringify(config));
  } catch (e) {
    console.error(`保存配置缓存失败 (${cacheKey}):`, e);
  }
}

/**
 * 清除指定的配置缓存
 * @param cacheKey - 缓存键名
 */
export function clearConfigCache(cacheKey: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(cacheKey);
  } catch (e) {
    console.error(`清除配置缓存失败 (${cacheKey}):`, e);
  }
}

/**
 * 清除所有配置缓存（匹配指定前缀）
 * @param prefix - 缓存键前缀，默认为空字符串（清除所有）
 */
export function clearAllConfigCache(prefix: string = ''): void {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.error('清除所有配置缓存失败:', e);
  }
}

/**
 * 获取配置缓存的过期时间版本
 * @param cacheKey - 缓存键名
 * @param expiryMs - 过期时间（毫秒）
 * @returns 缓存的配置对象，如果不存在、过期或解析失败则返回 null
 */
export function loadConfigWithExpiry<T = any>(
  cacheKey: string,
  expiryMs: number
): T | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    if (now - timestamp > expiryMs) {
      // 缓存已过期，清除它
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error(`加载带过期时间的配置缓存失败 (${cacheKey}):`, e);
    return null;
  }
}

/**
 * 保存配置到 localStorage（带过期时间）
 * @param cacheKey - 缓存键名
 * @param config - 要保存的配置对象
 */
export function saveConfigWithExpiry(cacheKey: string, config: any): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheData = {
      data: config,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (e) {
    console.error(`保存带过期时间的配置缓存失败 (${cacheKey}):`, e);
  }
}
