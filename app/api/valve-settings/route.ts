import { NextResponse } from 'next/server';
import { InfluxDB } from '@influxdata/influxdb-client';
import mqtt from 'mqtt';
import { getPool } from '@/lib/db';

// InfluxDB配置 (与 latest 保持一致)
const INFLUX_CONFIG = {
  url: 'http://43.139.93.159:8086',
  token: 'oPeLbhvS-3OymtJj9z_XmQa7DyvHJHkbh_l-NFYUYYhXBSFHuIElzHy4ULWizikeGLKAiu7D57rhoGEp2cVOZA==',
  org: 'watersAI',
  bucket: 'metricsData'
};

// 时段开度所对应的指标ID: 1104 到 1115
const VALVE_INDICATORS = Array.from({ length: 12 }, (_, i) => (1104 + i).toString());

export async function GET() {
  try {
    const client = new InfluxDB({ url: INFLUX_CONFIG.url, token: INFLUX_CONFIG.token });
    const queryApi = client.getQueryApi(INFLUX_CONFIG.org);
    
    // 1. 获取 InfluxDB 的实际下发值
    const query = `
      from(bucket: "${INFLUX_CONFIG.bucket}")
      |> range(start: -5m)
      |> filter(fn: (r) => 
          r["_measurement"] == "plcData" and
          r["_field"] == "value" and
          contains(value: r["indicator_id"], set: [${VALVE_INDICATORS.map(id => `"${id}"`).join(', ')}]))
      |> last()
    `;

    const actualValues: Record<string, number> = {};
    VALVE_INDICATORS.forEach(id => { actualValues[id] = 0; });

    const influxPromise = new Promise<void>((resolve) => {
      queryApi.queryRows(query, {
        next: (row, tableMeta) => {
          const o = tableMeta.toObject(row);
          if (o.indicator_id && o._value !== undefined) {
            actualValues[o.indicator_id] = o._value;
          }
        },
        error: (error) => {
          console.error('InfluxDB Query Error in valve-settings:', error);
          // 如果超时或出错不要崩掉整个查询，假定未变更为0或以MySQL状态为主
          resolve();
        },
        complete: () => resolve(),
      });
    });

    // 2. 获取 MySQL 中的配置目标值
    const pool = getPool();
    const dbPromise = pool.query('SELECT stage_index, setting_value FROM valve_settings');

    const [_, [dbRows]] = await Promise.all([influxPromise, dbPromise]);

    const targetValues = Array(12).fill(0);
    // @ts-ignore
    if (Array.isArray(dbRows)) {
      dbRows.forEach((row: any) => {
        if (row.stage_index >= 0 && row.stage_index < 12) {
          targetValues[row.stage_index] = row.setting_value;
        }
      });
    }

    // 映射回数组形式给前端
    const actualValuesArray = Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
       actualValuesArray[i] = actualValues[(1104 + i).toString()] || 0;
    }

    return NextResponse.json({ 
      success: true, 
      data: {
         targetValues,
         actualValues: actualValuesArray
      } 
    });
  } catch (error: any) {
    console.error('Failed to fetch valve settings:', error);
    return NextResponse.json({ success: false, error: '获取数据失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { index, value } = body;
    
    // 预期接收在 0-11 的 index 以及单个 value
    if (typeof index !== 'number' || index < 0 || index > 11 || typeof value !== 'number') {
      return NextResponse.json({ success: false, error: '无效的数据格式，需指定时段索引及开度参数' }, { status: 400 });
    }

    // 1. 同步保存到 MySQL
    const pool = getPool();
    await pool.query(
      'INSERT INTO valve_settings (stage_index, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      [index, value, value]
    );

    // 2. 发布到 MQTT
    const brokerUrl = process.env.MQTT_BROKER || 'mqtt://43.139.93.159:1883';
    const boxId = '795373b7f0ae89edc7013c43b81a107f';
    const pushTopic = 'waterdev/press/push';

    console.log(`Connecting to MQTT for dispatching index ${index}...`);
    const client = mqtt.connect(brokerUrl, {
      clientId: `fuan_dashboard_valve_${Date.now()}`,
      connectTimeout: 5000,
    });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', async () => {
        try {
          const plcAddr = `VD${200 + index * 4}`;
          const pushData = {
            cmd: 'pushPressData',
            boxId: boxId,
            plcAddr: plcAddr,
            pressure: value
          };
          
          const dataJson = JSON.stringify(pushData);
          
          await new Promise<void>((pubRes, pubRej) => {
            client.publish(pushTopic, dataJson, { qos: 1 }, (err) => {
              if (err) pubRej(err);
              else pubRes();
            });
          });
          
          console.log(`Successfully pushed to ${plcAddr}: value=${value}`);
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          client.end();
        }
      });

      client.on('error', (err) => {
        console.error('MQTT Connection Error:', err);
        reject(err);
        client.end();
      });
    });

    return NextResponse.json({ success: true, message: '开度下发并保存成功' });
  } catch (error: any) {
    console.error('Failed to dispatch valve settings:', error);
    return NextResponse.json({ success: false, error: '下发指令或保存数据库失败' }, { status: 500 });
  }
}
