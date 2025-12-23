/**
 * API: 获取指标历史数据
 */
import { NextResponse } from 'next/server';
import { InfluxDB } from '@influxdata/influxdb-client';

// InfluxDB配置
const INFLUX_CONFIG = {
  url: 'http://43.139.93.159:8086',
  token: 'oPeLbhvS-3OymtJj9z_XmQa7DyvHJHkbh_l-NFYUYYhXBSFHuIElzHy4ULWizikeGLKAiu7D57rhoGEp2cVOZA==',
  org: 'watersAI',
  bucket: 'metricsData'
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const indicatorId = searchParams.get('indicatorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!indicatorId || !startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    const client = new InfluxDB({ url: INFLUX_CONFIG.url, token: INFLUX_CONFIG.token });
    const queryApi = client.getQueryApi(INFLUX_CONFIG.org);
    
    // 构建查询
    const query = `
      from(bucket: "${INFLUX_CONFIG.bucket}")
      |> range(start: ${startDate}T00:00:00Z, stop: ${endDate}T23:59:59Z)
      |> filter(fn: (r) => 
          r["_measurement"] == "plcData" and
          r["_field"] == "value" and
          r["indicator_id"] == "${indicatorId}")
      |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
    `;
    
    const data: any[] = [];
    
    await new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row: string[], tableMeta: any) {
          const o = tableMeta.toObject(row);
          if (o._value !== null && o._value !== undefined) {
            data.push({
              time: new Date(o._time).toISOString(),
              value: Number(o._value)
            });
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
    
    // 数据采样（如果数据点太多）
    let sampledData = data;
    if (data.length > 200) {
      const step = Math.ceil(data.length / 200);
      sampledData = data.filter((_, index) => index % step === 0);
    }
    
    return NextResponse.json({
      success: true,
      data: sampledData,
      total: data.length,
      sampled: sampledData.length
    });
    
  } catch (error) {
    console.error('获取历史数据失败:', error);
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    );
  }
}
