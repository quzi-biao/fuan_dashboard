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
      // 过滤凌晨 0 点前 3 分钟的初始化假信号
      if (data[i].hour === 0 && data[i].minute < 3) {
        settledLevel = data[i].valve;
        continue;
      }
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

/**
 * 将同向连续切换事件合并为调节会话
 * 规则：同方向 + 时间间隔 <= MAX_GAP_MIN 分钟 → 同一 session
 */
function buildValveSessions(events: any[]) {
  if (events.length === 0) return [];

  const MAX_GAP_MIN = 15;
  const sessions: any[] = [];

  let sStart = events[0];
  let sEnd = events[0];
  let sDir = Math.sign(events[0].delta); // 1=up, -1=down

  const pushSession = () => {
    const durationMin = Math.round((sEnd.timeDecimal - sStart.timeDecimal) * 60);
    sessions.push({
      start_td: sStart.timeDecimal,
      end_td: sEnd.timeDecimal,
      start_time: sStart.label,
      end_time: sEnd.label,
      start_pct: sStart.from_pct,
      end_pct: sEnd.to_pct,
      total_delta: sEnd.to_pct - sStart.from_pct,
      duration_min: durationMin,
      direction: sDir > 0 ? 'up' : 'down',
    });
  };

  for (let i = 1; i < events.length; i++) {
    const ev = events[i];
    const gapMin = (ev.timeDecimal - sEnd.timeDecimal) * 60;
    const dir = Math.sign(ev.delta);

    if (dir === sDir && gapMin <= MAX_GAP_MIN) {
      sEnd = ev; // 延伸当前 session
    } else {
      pushSession();
      sStart = ev;
      sEnd = ev;
      sDir = dir;
    }
  }
  pushSession(); // 最后一个 session

  return sessions;
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
        AVG(CASE WHEN i_1097 > 0.1 AND i_1097 < 20 THEN i_1097 END) as avg_water_level,
        MAX(CASE WHEN i_1098 >= 0 AND i_1098 <= 100 THEN i_1098 END) as max_valve_opening
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
        max_valve_opening: row && row.max_valve_opening != null ? +Number(row.max_valve_opening).toFixed(1) : null,
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

    // 当天首个稳定阀门读数（跳过 0:00~0:02 的初始化噪声，与 detectValveSwitches 逻辑一致）
    const sortedValveRows = (valveMinuteRows as any[])
      .filter((r) => Number(r.valve) >= 0 && Number(r.valve) <= 100)
      .sort((a, b) => Number(a.hour) * 60 + Number(a.minute) - (Number(b.hour) * 60 + Number(b.minute)));
    // 优先取 0:03 以后的第一条，不存在则退到最早一条
    const firstStable = sortedValveRows.find(
      (r) => !(Number(r.hour) === 0 && Number(r.minute) < 3)
    ) ?? sortedValveRows[0];
    const initialValvePct = firstStable ? Math.round(Number(firstStable.valve)) : null;

    // 每5分钟水位折线
    const levelData = (levelMinuteRows as any[]).map((r) => ({
      timeDecimal: Number(r.hour) + Number(r.minute) / 60,
      label: `${r.hour}:${String(r.minute).padStart(2, '0')}`,
      water_level: +Number(r.water_level).toFixed(2),
    }));

    // 合并同向连续事件为调节会话
    const valveSessions = buildValveSessions(valveEvents);

    return NextResponse.json({
      success: true,
      date: targetDate,
      hourly: hourlyData,
      valve_events: valveEvents,
      valve_sessions: valveSessions,
      initial_valve_pct: initialValvePct,
      level_data: levelData,
    });
  } catch (error) {
    console.error('城东调度数据查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
