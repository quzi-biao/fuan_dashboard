/**
 * API: 福安岩湖水厂二级泵房高效节能智能调度运行分析
 *
 * 送水量：i_1072 (yanhu_daily_water) 每小时跨小时差值，单位 m³
 * 耗电量：i_1073 (yanhu_daily_power) 每小时跨小时差值，单位 kWh
 * 日总量  = 小时累加 = MAX(全天) ← 与 analyzeEfficiency (MAX) 一致
 * 排除 0:00:00 读数（该时刻保留前一天末尾值）
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

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam || getYesterday();

    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `
      SELECT
        HOUR(collect_time) AS hour,
        AVG(CASE WHEN i_1030 > 0.01 AND i_1030 < 2 THEN i_1030 END) AS avg_pressure,
        -- i_1072 = yanhu_daily_water (实为日累计电量 kWh)，排除 0:00 前一天残留读数
        MAX(CASE WHEN NOT (HOUR(collect_time) = 0 AND MINUTE(collect_time) = 0) AND i_1072 > 0 THEN i_1072 END)
          AS max_elec,
        -- i_1073 = yanhu_daily_power (实为日累计水量 m³)，排除 0:00 前一天残留读数
        MAX(CASE WHEN NOT (HOUR(collect_time) = 0 AND MINUTE(collect_time) = 0) AND i_1073 > 0 THEN i_1073 END)
          AS max_water,
        MAX(i_1049) AS max_pump1_freq,
        MAX(i_1050) AS max_pump2_freq,
        MAX(i_1051) AS max_aux_freq
      FROM fuan_data
      WHERE DATE(collect_time) = ?
      GROUP BY HOUR(collect_time)
      ORDER BY HOUR(collect_time)
      `,
      [targetDate]
    );

    const rowMap: Record<number, any> = {};
    (rows as any[]).forEach((r) => { rowMap[r.hour] = r; });

    // 跨小时差值：hour 0 直接取 MAX（计数器刚从 0 起步），hours 1-23 取 MAX(h)-MAX(h-1)
    function getHourlyDelta(field: 'max_water' | 'max_elec', hour: number): number {
      const cur = Number(rowMap[hour]?.[field] ?? 0);
      if (cur <= 0) return 0;
      if (hour === 0) return cur;  // 计数器从 0 起步，MAX 即为增量
      for (let h = hour - 1; h >= 0; h--) {
        const prev = Number(rowMap[h]?.[field] ?? 0);
        if (prev > 0) {
          const delta = cur - prev;
          return delta > 0 ? delta : 0;
        }
      }
      return cur;
    }

    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const row = rowMap[hour];
      const period = getPeriod(hour);

      // i_1073 实为水量 → 送水量； i_1072 实为电量 → 耗电量
      const flowM3   = +getHourlyDelta('max_water', hour).toFixed(1); // m³  (i_1073)
      const powerKwh = +getHourlyDelta('max_elec',  hour).toFixed(1); // kWh (i_1072)
      const pressure = row ? (Number(row.avg_pressure) || 0) : 0;

      // 千吨水电耗 (kWh/kt)
      const power1000t = flowM3 > 0 && powerKwh > 0 ? +(powerKwh * 1000 / flowM3).toFixed(2) : null;
      // 千吨水兆帕电耗 (kWh/kt/MPa)
      const power1000tMpa = pressure > 0 && power1000t ? +(power1000t / pressure).toFixed(2) : null;
      // 泵组综合效率 (%) = 0.278 × P(MPa) × 1000 / (kWh/kt) × 100
      const pumpEff = power1000t && power1000t > 0 && pressure > 0
        ? +(0.278 * pressure * 1000 / power1000t * 100).toFixed(2)
        : null;

      const pump1   = row ? (Number(row.max_pump1_freq) > 5 ? '启' : '停') : '停';
      const pump2   = row ? (Number(row.max_pump2_freq) > 5 ? '启' : '停') : '停';
      const auxPump = row ? (Number(row.max_aux_freq)   > 5 ? '启' : '停') : '停';

      return {
        hour,
        label: `${hour}:00`,
        period,
        period_name: PERIOD_NAMES[period],
        flow_m3:         flowM3,
        pressure_mpa:    +pressure.toFixed(4),
        power_kwh:       powerKwh,
        power_1000t:     power1000t,
        power_1000t_mpa: power1000tMpa,
        pump_efficiency: pumpEff,
        pump1,
        pump2,
        aux_pump: auxPump,
      };
    });

    // 日汇总
    const totalFlow = hourlyData.reduce((s, h) => s + h.flow_m3, 0);
    const totalPower = hourlyData.reduce((s, h) => s + h.power_kwh, 0);
    const pressureHours = hourlyData.filter(h => h.pressure_mpa > 0);
    const avgPressure = pressureHours.length > 0
      ? pressureHours.reduce((s, h) => s + h.pressure_mpa, 0) / pressureHours.length
      : 0;
    // 日千吨水电耗 = 总耗电 / (总送水 / 1000)
    const dailyPower1000t = totalFlow > 0 && totalPower > 0 ? totalPower * 1000 / totalFlow : null;
    // 日均泵效
    const effHours = hourlyData.filter(h => h.pump_efficiency != null && h.pump_efficiency > 0);
    const avgPumpEff = effHours.length > 0
      ? effHours.reduce((s, h) => s + (h.pump_efficiency ?? 0), 0) / effHours.length
      : null;

    const summary = {
      total_flow_m3: +totalFlow.toFixed(0),
      total_power_kwh: +totalPower.toFixed(1),
      avg_pressure_mpa: +avgPressure.toFixed(4),
      daily_power_1000t: dailyPower1000t ? +dailyPower1000t.toFixed(2) : null,
      avg_pump_efficiency: avgPumpEff ? +avgPumpEff.toFixed(2) : null,
    };

    return NextResponse.json({ success: true, date: targetDate, hourly: hourlyData, summary });
  } catch (error) {
    console.error('岩湖调度数据查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
