/**
 * API: 获取最新一条数据
 */
import { NextResponse } from 'next/server';
import { InfluxDB } from '@influxdata/influxdb-client';
import fs from 'fs/promises';
import path from 'path';

// InfluxDB配置
const INFLUX_CONFIG = {
  url: 'http://43.139.93.159:8086',
  token: 'oPeLbhvS-3OymtJj9z_XmQa7DyvHJHkbh_l-NFYUYYhXBSFHuIElzHy4ULWizikeGLKAiu7D57rhoGEp2cVOZA==',
  org: 'watersAI',
  bucket: 'metricsData'
};

// 指标类型定义
interface MetricConfig {
  id: string;
  name: string;
  unit: string;
  highlight?: boolean;
}

// 指标配置
const INDICATORS: {
  yanhu: { label: string; metrics: MetricConfig[] };
  chengdong: { label: string; metrics: MetricConfig[] };
} = {
  yanhu: {
    label: '岩湖水厂',
    metrics: [
      { id: '1071', name: '实时效率', unit: '', highlight: true },
      { id: '1070', name: '实时单位能耗', unit: 'kWh/m³', highlight: true },
      { id: '1069', name: '实时水电比', unit: 'kWh/m³', highlight: true },
      { id: '1074', name: '日累计水电比', unit: 'kWh/m³', highlight: true },
      { id: '1073', name: '日累计水量', unit: 'm³' },
      { id: '1072', name: '日累计电量', unit: 'kWh' },
      { id: '1035', name: '累计流量', unit: 'm³' },
      { id: '1034', name: '出水流量', unit: 'm³/h' },
      { id: '1097', name: '清水池液位', unit: 'm' },
      { id: '1031', name: '目标压力', unit: 'MPa' },
      { id: '1030', name: '出水压力', unit: 'MPa' },
    ]
  },
  chengdong: {
    label: '城东水厂',
    metrics: [
      { id: '1102', name: '瞬时流量', unit: 'm³/h' },
      { id: '1097', name: '水箱液位', unit: 'm' },
      { id: '1098', name: '阀门开度', unit: '%' },
      { id: '1130', name: '日用水量', unit: 'm³' },
      { id: '1129', name: '累计流量', unit: 'm³' },
      { id: '1128', name: '控制流量', unit: 'm³/h' },
    ]
  }
};

// 缓存配置
const CACHE_FILE = path.join(process.cwd(), 'cache', 'latest_data.json');
const CACHE_DURATION = 60 * 1000; // 60秒

// 读取缓存
async function readCache(): Promise<{ data: any; expired: boolean } | null> {
  try {
    const cacheData = await fs.readFile(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(cacheData);
    const isExpired = Date.now() - cache.timestamp >= CACHE_DURATION;
    return { data: cache.data, expired: isExpired };
  } catch (error) {
    return null;
  }
}

// 写入缓存
async function writeCache(data: any) {
  try {
    const cacheDir = path.dirname(CACHE_FILE);
    await fs.mkdir(cacheDir, { recursive: true });
    const cache = { timestamp: Date.now(), data };
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error('写入缓存失败:', error);
  }
}

// 从InfluxDB获取最新数据
async function fetchFromInfluxDB() {
  const client = new InfluxDB({ url: INFLUX_CONFIG.url, token: INFLUX_CONFIG.token });
  const queryApi = client.getQueryApi(INFLUX_CONFIG.org);
  
  // 查询最近5分钟的数据
  const allIndicators = [
    ...INDICATORS.yanhu.metrics.map(m => m.id),
    ...INDICATORS.chengdong.metrics.map(m => m.id)
  ];
  
  const query = `
    from(bucket: "${INFLUX_CONFIG.bucket}")
    |> range(start: -5m)
    |> filter(fn: (r) => 
        r["_measurement"] == "plcData" and
        r["_field"] == "value" and
        contains(value: r["indicator_id"], set: [${allIndicators.map(id => `"${id}"`).join(', ')}]))
    |> last()
  `;
  
  const results: any = {};
  
  try {
    await new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row: string[], tableMeta: any) {
          const o = tableMeta.toObject(row);
          const indicatorId = o.indicator_id;
          const value = o._value;
          const time = o._time;
          
          if (value !== null && value !== undefined) {
            results[indicatorId] = {
              value: Number(value),
              time: new Date(time).toISOString()
            };
          }
        },
        error(error: Error) {
          console.error('InfluxDB查询错误:', error);
          reject(error);
        },
        complete() {
          resolve(null);
        },
      });
    });
    
    // 组织数据
    const yanhuData = INDICATORS.yanhu.metrics.map(metric => ({
      id: metric.id,
      name: metric.name,
      unit: metric.unit,
      value: results[metric.id]?.value || 0,
      time: results[metric.id]?.time || null,
      highlight: metric.highlight || false
    }));
    
    const chengdongData = INDICATORS.chengdong.metrics.map(metric => ({
      id: metric.id,
      name: metric.name,
      unit: metric.unit,
      value: results[metric.id]?.value || 0,
      time: results[metric.id]?.time || null,
      highlight: metric.highlight || false
    }));
    
    // 获取最新时间
    const allTimes = Object.values(results)
      .map((r: any) => r.time)
      .filter(t => t);
    const latestTime = allTimes.length > 0 ? allTimes.sort().reverse()[0] : new Date().toISOString();
    
    return {
      success: true,
      collect_time: latestTime,
      data: {
        yanhu: {
          label: INDICATORS.yanhu.label,
          metrics: yanhuData
        },
        chengdong: {
          label: INDICATORS.chengdong.label,
          metrics: chengdongData
        }
      }
    };
    
  } catch (error) {
    console.error('从InfluxDB获取数据失败:', error);
    return null;
  }
}

// 异步刷新缓存
function refreshCacheAsync() {
  fetchFromInfluxDB()
    .then(result => {
      if (result) {
        writeCache(result);
        console.log('实时数据缓存已异步更新');
      }
    })
    .catch(error => {
      console.error('异步刷新实时数据缓存失败:', error);
    });
}

export async function GET() {
  try {
    // 先尝试读取缓存
    const cache = await readCache();
    
    if (cache) {
      if (!cache.expired) {
        console.log('使用有效缓存的实时数据');
        return NextResponse.json(cache.data);
      } else {
        console.log('实时数据缓存已过期，返回旧数据并异步刷新');
        refreshCacheAsync();
        return NextResponse.json(cache.data);
      }
    }
    
    // 缓存不存在，同步查询
    console.log('缓存不存在，从InfluxDB查询实时数据');
    const result = await fetchFromInfluxDB();
    
    if (!result) {
      return NextResponse.json({ error: '没有数据' }, { status: 404 });
    }
    
    await writeCache(result);
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('获取最新数据失败:', error);
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    );
  }
}
