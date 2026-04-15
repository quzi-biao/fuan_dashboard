import { NextResponse } from 'next/server';
import { InfluxDB } from '@influxdata/influxdb-client';
import mqtt from 'mqtt';

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
    
    // 查询指定指标最新记录，避免时序断层可适当放宽时间范围，这里用 -30d 作为后备
    const query = `
      from(bucket: "${INFLUX_CONFIG.bucket}")
      |> range(start: -30d)
      |> filter(fn: (r) => 
          r["_measurement"] == "plcData" and
          r["_field"] == "value" and
          contains(value: r["indicator_id"], set: [${VALVE_INDICATORS.map(id => `"${id}"`).join(', ')}]))
      |> last()
    `;

    const results: Record<string, number> = {};
    // 初始化默认值
    VALVE_INDICATORS.forEach(id => {
      results[id] = 0;
    });

    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(query, {
        next: (row, tableMeta) => {
          const o = tableMeta.toObject(row);
          if (o.indicator_id && o._value !== undefined) {
            results[o.indicator_id] = o._value;
          }
        },
        error: (error) => {
          console.error('InfluxDB Query Error in valve-settings:', error);
          reject(error);
        },
        complete: () => resolve(),
      });
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Failed to fetch valve settings:', error);
    return NextResponse.json({ success: false, error: '获取数据失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { values } = body;
    
    // 预期接收一个长度为 12 的数组，依次对应时段 1 到时段 12，即 VD200..VD244
    if (!Array.isArray(values) || values.length !== 12) {
      return NextResponse.json({ success: false, error: '无效的数据格式，需包含12个开度参数' }, { status: 400 });
    }

    const brokerUrl = process.env.MQTT_BROKER || 'mqtt://43.139.93.159:1883';
    const boxId = '795373b7f0ae89edc7013c43b81a107f';
    const pushTopic = 'waterdev/press/push';

    console.log('Connecting to MQTT for valve settings dispatch...');
    const client = mqtt.connect(brokerUrl, {
      clientId: `fuan_dashboard_valve_${Date.now()}`,
      connectTimeout: 5000,
    });

    // 保证推送任务在连接稳定后完成再返回请求
    await new Promise<void>((resolve, reject) => {
      client.on('connect', async () => {
        try {
          for (let i = 0; i < 12; i++) {
            const plcAddr = `VD${200 + i * 4}`;
            const pressure = Number(values[i]);
            
            const pushData = {
              cmd: 'pushPressData',
              boxId: boxId,
              plcAddr: plcAddr,
              pressure: pressure
            };
            
            const dataJson = JSON.stringify(pushData);
            
            // 同步发布，确保各路指令有序到达 MQTT 队列（QoS=1）
            await new Promise<void>((pubRes, pubRej) => {
              client.publish(pushTopic, dataJson, { qos: 1 }, (err) => {
                if (err) pubRej(err);
                else pubRes();
              });
            });
            
            console.log(`Successfully pushed to ${plcAddr}: value=${pressure}`);
          }
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

    return NextResponse.json({ success: true, message: '开度下发成功' });
  } catch (error: any) {
    console.error('Failed to dispatch valve settings:', error);
    return NextResponse.json({ success: false, error: '下发指令失败' }, { status: 500 });
  }
}
