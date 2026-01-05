/**
 * API: 获取最新压力计数据
 */
import { NextResponse } from 'next/server';
import { InfluxDB } from '@influxdata/influxdb-client';
import fs from 'fs/promises';
import path from 'path';

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

// InfluxDB配置
const INFLUX_CONFIG = {
  url: 'http://43.139.93.159:8086',
  token: 'oPeLbhvS-3OymtJj9z_XmQa7DyvHJHkbh_l-NFYUYYhXBSFHuIElzHy4ULWizikeGLKAiu7D57rhoGEp2cVOZA==',
  org: 'watersAI',
  bucket: 'pressData'
};

// 缓存配置
const CACHE_FILE = path.join(process.cwd(), 'cache', 'pressure_latest.json');
const CACHE_DURATION = 60 * 1000; // 缓存有效期：60秒

// 读取缓存
async function readCache(): Promise<{ data: any; expired: boolean } | null> {
  try {
    const cacheData = await fs.readFile(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(cacheData);
    
    const isExpired = Date.now() - cache.timestamp >= CACHE_DURATION;
    
    return {
      data: cache.data,
      expired: isExpired
    };
  } catch (error) {
    // 缓存文件不存在或读取失败
    return null;
  }
}

// 写入缓存
async function writeCache(data: any) {
  try {
    // 确保缓存目录存在
    const cacheDir = path.dirname(CACHE_FILE);
    await fs.mkdir(cacheDir, { recursive: true });
    
    // 写入缓存
    const cache = {
      timestamp: Date.now(),
      data: data
    };
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error('写入缓存失败:', error);
  }
}

// 从InfluxDB获取最新数据
async function fetchFromInfluxDB() {
  const client = new InfluxDB({ url: INFLUX_CONFIG.url, token: INFLUX_CONFIG.token });
  const queryApi = client.getQueryApi(INFLUX_CONFIG.org);
  
  try {
    // 查询最近4小时的数据，获取每个压力计的最新记录
    const query = `
      from(bucket: "${INFLUX_CONFIG.bucket}")
        |> range(start: -4h)
        |> filter(fn: (r) => r["_measurement"] == "pressureData")
        |> filter(fn: (r) => r["_field"] == "press")
        |> group(columns: ["sn"])
        |> last()
    `;
    
    const latestByMeter = new Map<string, any>();
    
    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row: string[], tableMeta: any) {
          const record = tableMeta.toObject(row);
          const sn = record.sn;
          const press = record._value;
          const time = record._time;
          
          if (sn && press !== undefined && press > 0) {
            latestByMeter.set(sn, {
              sn,
              press,
              collect_time: new Date(time).getTime()
            });
          }
        },
        error(error: Error) {
          console.error('InfluxDB查询错误:', error);
          reject(error);
        },
        complete() {
          resolve();
        }
      });
    });
    
    if (latestByMeter.size === 0) {
      return null;
    }
    
    // 转换为压力计数组格式
    const pressureData = PRESSURE_METERS.map(meter => {
      const data = latestByMeter.get(meter.sn);
      return {
        sn: meter.sn,
        label: meter.label,
        pressure: data ? data.press : 0,
        collect_time: data ? new Date(data.collect_time).toISOString() : null
      };
    });
    
    // 获取最新的采集时间
    const latestTime = Math.max(...Array.from(latestByMeter.values()).map(d => d.collect_time));
    
    return {
      success: true,
      data: pressureData,
      collect_time: new Date(latestTime).toISOString()
    };
    
  } catch (error) {
    console.error('从InfluxDB获取压力数据失败:', error);
    return null;
  }
}

// 异步刷新缓存（不阻塞响应）
function refreshCacheAsync() {
  // 使用 Promise 异步执行，不等待结果
  fetchFromInfluxDB()
    .then(result => {
      if (result) {
        writeCache(result);
        console.log('缓存已异步更新');
      }
    })
    .catch(error => {
      console.error('异步刷新缓存失败:', error);
    });
}

export async function GET() {
  try {
    // 先尝试读取缓存
    const cache = await readCache();
    
    if (cache) {
      if (!cache.expired) {
        // 缓存未过期，直接返回
        console.log('使用有效缓存的压力数据');
        return NextResponse.json(cache.data);
      } else {
        // 缓存已过期，先返回旧数据，然后异步刷新
        console.log('缓存已过期，返回旧数据并异步刷新');
        
        // 触发异步刷新（不等待结果）
        refreshCacheAsync();
        
        // 立即返回旧缓存数据
        return NextResponse.json(cache.data);
      }
    }
    
    // 缓存不存在，同步查询InfluxDB
    console.log('缓存不存在，从InfluxDB查询压力数据');
    const result = await fetchFromInfluxDB();
    
    if (!result) {
      return NextResponse.json({ error: '没有数据' }, { status: 404 });
    }
    
    // 写入缓存
    await writeCache(result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('获取最新压力数据失败:', error);
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    );
  }
}
