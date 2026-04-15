/**
 * API: 福安城东水厂智能错峰调度运行分析
 * 返回指定日期（默认昨天）的：
 *   - hourly: 每小时平均供水量、平均清水池水位
 *   - valve_events: 阀门开度切换事件（从1分钟数据中检测）
 *   - level_data: 每5分钟的清水池水位折线数据
 */
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

function getPeriod(hour: number): 'valley' | 'flat' | 'peak' {
  if (hour < 8) return 'valley';
  if (hour < 10) return 'flat';
  if (hour < 12) return 'peak';
  if (hour < 15) return 'flat';
  if (hour < 20) return 'peak';
  if (hour < 21) return 'flat';
  if (hour < 22) return 'peak';
  return 'flat';
}

const PERIOD_NAMES: Record<string, string> = { valley: '谷', flat: '平', peak: '峰' };

/** 从1分钟粒度的阀门数据中检测切换事件 */
function detectValveSwitches(
  minuteRows: Array<{ hour: number; minute: number; valve: number }>
) {
  const data = minuteRows
    .filter((r) => r.valve >= 0 && r.valve <= 100)
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  if (data.length < 2) return [];

  const THRESHOLD = 3; // % 变化阈值
  const events: any[] = [];
  let settledLevel = data[0].valve;

  for (let i = 1; i < data.length; i++) {
    const change = data[i].valve - settledLevel;
    if (Math.abs(change) >= THRESHOLD) {
      // 验证：下一个读数也维持新水平（避免瞬间噪声）
      const nextVal = data[i + 1]?.valve ?? data[i].valve;
      const nextChange = Math.abs(nextVal - data[i].valve);
      if (nextChange < THRESHOLD) {
        const newLevel = Math.round(data[i].valve);
        const fromLevel = Math.round(settledLevel);
        if (Math.abs(newLevel - fromLevel) >= THRESHOLD) {
          events.push({
            timeDecimal: data[i].hour + data[i].minute / 60,
            label: `${data[i].hour}:${String(data[i].minute).padStart(2, '0')}`,
            from_pct: fromLevel,
            to_pct: newLevel,
            delta: newLevel - fromLevel,
          });
        }
        settledLevel = data[i].valve;
      }
    }
  }

  return events;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    const pool = getPool();

    let targetDate = dateParam || null;

    if (!targetDate) {
      const [recentDates] = await pool.query<any[]>(
        `
        SELECT DATE(collect_time) as d
        FROM fuan_data
        WHERE collect_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND i_1102 > 0
        GROUP BY DATE(collect_time)
        ORDER BY d DESC
        LIMIT 2
        `
      );
      if (recentDates.length >= 2) {
        targetDate = recentDates[1].d instanceof Date
          ? recentDates[1].d.toISOString().split('T')[0]
          : String(recentDates[1].d);
      } else if (recentDates.length === 1) {
        targetDate = recentDates[0].d instanceof Date
          ? recentDates[0].d.toISOString().split('T')[0]
          : String(recentDates[0].d);
      } else {
        return NextResponse.json({ error: '最近7天无供水数据' }, { status: 404 });
      }
    }

    // ① 每小时聚合：供水量 + 清水池水位
    const [hourlyRows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time) as hour,
        AVG(CASE WHEN i_1102 > 0 AND i_1102 < 10000 THEN i_1102 END) as chengdong_avg_flow,
        AVG(CASE WHEN i_1097 > 0.1 AND i_1097 < 20 THEN i_1097 END) as avg_water_level
      FROM fuan_data
      WHERE DATE(collect_time) = ?
      GROUP BY HOUR(collect_time)
      ORDER BY HOUR(collect_time)
      `,
      [targetDate]
    );

    // ② 每分钟的阀门开度（用于切换事件检测）
    const [valveMinuteRows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time)   AS hour,
        MINUTE(collect_time) AS minute,
        i_1098               AS valve
      FROM fuan_data
      WHERE DATE(collect_time) = ?
        AND i_1098 IS NOT NULL
        AND i_1098 BETWEEN 0 AND 100
      ORDER BY collect_time
      LIMIT 1500
      `,
      [targetDate]
    );

    // ③ 每5分钟清水池水位（用于折线图）
    const [levelMinuteRows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time)   AS hour,
        MINUTE(collect_time) AS minute,
        i_1097               AS water_level
      FROM fuan_data
      WHERE DATE(collect_time) = ?
        AND MINUTE(collect_time) % 5 = 0
        AND i_1097 IS NOT NULL
        AND i_1097 BETWEEN 0.1 AND 20
      ORDER BY collect_time
      LIMIT 400
      `,
      [targetDate]
    );

    const rowMap: Record<number, any> = {};
    (hourlyRows as any[]).forEach((r) => { rowMap[r.hour] = r; });

    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const row = rowMap[hour];
      const period = getPeriod(hour);
      return {
        hour,
        label: `${hour}:00`,
        chengdong_supply: row ? Math.round(row.chengdong_avg_flow || 0) : 0,
        avg_water_level: row && row.avg_water_level ? +Number(row.avg_water_level).toFixed(2) : null,
        period,
        period_name: PERIOD_NAMES[period],
      };
    });

    // 检测阀门切换事件
    const valveEvents = detectValveSwitches(
      (valveMinuteRows as any[]).map((r) => ({
        hour: Number(r.hour),
        minute: Number(r.minute),
        valve: Number(r.valve),
      }))
    );

    // 当天首个有效阀门读数（用于前端重建步进曲线的起始值）
    const sortedValveRows = (valveMinuteRows as any[])
      .filter((r) => Number(r.valve) >= 0 && Number(r.valve) <= 100)
      .sort((a, b) => Number(a.hour) * 60 + Number(a.minute) - (Number(b.hour) * 60 + Number(b.minute)));
    const initialValvePct = sortedValveRows.length > 0
      ? Math.round(Number(sortedValveRows[0].valve))
      : null;

    // 每5分钟水位折线
    const levelData = (levelMinuteRows as any[]).map((r) => ({
      timeDecimal: Number(r.hour) + Number(r.minute) / 60,
      label: `${r.hour}:${String(r.minute).padStart(2, '0')}`,
      water_level: +Number(r.water_level).toFixed(2),
    }));

    return NextResponse.json({
      success: true,
      date: targetDate,
      hourly: hourlyData,
      valve_events: valveEvents,
      initial_valve_pct: initialValvePct,
      level_data: levelData,
    });
  } catch (error) {
    console.error('城东调度数据查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
