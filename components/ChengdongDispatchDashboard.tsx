/**
 * 福安城东水厂智能错峰调度运行分析看板
 * 图表：柱状图（城东每小时供水量）+ 折线（清水池水位，每5分钟）
 *       + ReferenceLine 标注阀门切换时刻（绿色=开大，红色=关小）
 * 表格：每小时供水量与水位均值
 * 事件列表：阀门切换时刻和前后开度
 */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceArea, ReferenceLine, ResponsiveContainer,
} from 'recharts';

interface HourlyData {
  hour: number;
  label: string;
  chengdong_supply: number;
  avg_water_level: number | null;
  max_valve_opening: number | null;
  period: string;
  period_name: string;
}

interface ValveEvent {
  timeDecimal: number;
  label: string;       // e.g. "10:23"
  from_pct: number;
  to_pct: number;
  delta: number;       // positive = 开大, negative = 关小
}

interface LevelData {
  timeDecimal: number;
  label: string;
  water_level: number;
}

interface ValveSession {
  start_td: number;
  end_td: number;
  start_time: string;
  end_time: string;
  start_pct: number;
  end_pct: number;
  total_delta: number;
  duration_min: number;
  direction: 'up' | 'down';
}

interface ApiData {
  success: boolean;
  date: string;
  hourly: HourlyData[];
  valve_events: ValveEvent[];
  valve_sessions: ValveSession[];
  initial_valve_pct: number | null;
  level_data: LevelData[];
}

const PERIOD_BG: Record<string, string> = {
  valley: '#fef9c3',
  flat: '#dcfce7',
  peak: '#fee2e2',
};
const PERIOD_COLORS: Record<string, string> = {
  valley: '#a16207',
  flat: '#15803d',
  peak: '#b91c1c',
};

const PERIOD_AREAS = [
  { x1: -0.5, x2: 7.5, fill: '#fef9c3' },
  { x1: 7.5, x2: 9.5, fill: '#dcfce7' },
  { x1: 9.5, x2: 11.5, fill: '#fee2e2' },
  { x1: 11.5, x2: 14.5, fill: '#dcfce7' },
  { x1: 14.5, x2: 19.5, fill: '#fee2e2' },
  { x1: 19.5, x2: 20.5, fill: '#dcfce7' },
  { x1: 20.5, x2: 21.5, fill: '#fee2e2' },
  { x1: 21.5, x2: 23.5, fill: '#dcfce7' },
];

/** 自定义 ReferenceLine 标签，显示切换方向和新开度 */
function ValveSwitchLabel({
  viewBox,
  delta,
  toPct,
  index,
}: {
  viewBox?: { x: number; y: number; width: number; height: number };
  delta: number;
  toPct: number;
  index: number;
}) {
  if (!viewBox) return null;
  const { x, y } = viewBox;
  const isOpen = delta > 0;
  const color = isOpen ? '#15803d' : '#b91c1c';
  const arrow = isOpen ? '▲' : '▼';
  // 奇偶交替位置，避免标签密集时重叠
  const labelY = index % 2 === 0 ? y + 16 : y + 36;

  return (
    <g>
      <rect
        x={x - 18}
        y={labelY - 11}
        width={38}
        height={14}
        rx={3}
        fill={isOpen ? '#dcfce7' : '#fee2e2'}
        stroke={color}
        strokeWidth={0.8}
        opacity={0.92}
      />
      <text
        x={x + 1}
        y={labelY}
        textAnchor="middle"
        fill={color}
        fontSize={9}
        fontWeight="600"
      >
        {arrow}{toPct}%
      </text>
    </g>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const td = typeof label === 'number' ? label : parseFloat(label);
  const hh = Math.floor(td);
  const mm = Math.round((td - hh) * 60);
  const timeLabel = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{timeLabel}</p>
      {payload.map((p: any) => {
        if (p.value == null) return null;
        let unit = '';
        const color = p.stroke || p.fill;
        if (p.dataKey === 'chengdong_supply') unit = ' m³';
        if (p.dataKey === 'water_level' || p.dataKey === 'avg_water_level') unit = ' m';
        if (p.dataKey === 'valve_position') unit = ' %';
        return (
          <div key={p.dataKey} className="flex items-center gap-2 mt-1" style={{ color }}>
            <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ background: color }} />
            <span>
              {p.name}：<strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>{unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ChengdongDispatchDashboard({ date: selectedDate }: { date?: string }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/dashboard/chengdong-dispatch${selectedDate ? `?date=${selectedDate}` : ''}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json);
        else setError(json.error || '加载失败');
      })
      .catch(() => setError('网络请求失败'))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  // chartData: 24小时数据，带阀门步进位置
  const chartData = useMemo(() => {
    if (!data) return [];
    const { valve_events, initial_valve_pct, hourly } = data;
    // valve_events[0].from_pct 是 detectValveSwitches 内部跳过凌晨噪声后的真实起始稳定值
    // 比 initial_valve_pct（数据库第一条原始读数）更可靠
    const effectiveInitial = valve_events.length > 0
      ? valve_events[0].from_pct
      : initial_valve_pct;
    return hourly.map((h) => {
      // 该小时结束前最后一次切换的 to_pct
      const lastEvent = [...valve_events]
        .filter((ev) => ev.timeDecimal <= h.hour + 0.999)
        .pop();
      const valvePos = lastEvent ? lastEvent.to_pct : effectiveInitial;
      return {
        timeDecimal: h.hour,
        chengdong_supply: h.chengdong_supply,
        avg_water_level: h.avg_water_level,
        valve_position: valvePos,
      };
    });
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
        加载中...
      </div>
    );
  }
  if (error || !data) {
    return <div className="flex items-center justify-center h-64 text-red-500">{error || '暂无数据'}</div>;
  }

  const { hourly, date, valve_events } = data;
  const hasData = hourly.some((h) => h.chengdong_supply > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        暂无 {date} 的供水数据
      </div>
    );
  }

  const levelValues = hourly.map((h) => h.avg_water_level).filter((v): v is number => v != null && v > 0);
  const maxLevel = levelValues.length > 0 ? Math.ceil(Math.max(...levelValues) * 1.2) : 12;

  return (
    <div className="space-y-6">
      {/* 日期 + 阀门切换摘要 */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span>
          分析日期：<span className="font-medium text-gray-700">{date}</span>
        </span>
        {valve_events.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
            共 <span className="font-semibold text-gray-700 mx-0.5">{data.valve_sessions?.length ?? 0}</span> 次阀门调节
          </span>
        )}
      </div>

      {/* 图表 */}
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth: 640 }}>
          <ResponsiveContainer width="100%" height={500}>
            <ComposedChart
              data={chartData}
              margin={{ top: 16, right: 70, bottom: 10, left: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />

              {/* 时段背景 */}
              {PERIOD_AREAS.map((area, i) => (
                <ReferenceArea
                  key={i}
                  x1={area.x1}
                  x2={area.x2}
                  yAxisId="left"
                  fill={area.fill}
                  fillOpacity={0.25}
                  strokeOpacity={0}
                />
              ))}

              {/* 阀门调节会话：ReferenceArea 色块 + session 起点标注线 */}
              {data.valve_sessions?.map((s, i) => {
                const isUp = s.direction === 'up';
                const color = isUp ? '#16a34a' : '#dc2626';
                const bgColor = isUp ? '#dcfce7' : '#fee2e2';
                return (
                  <React.Fragment key={`session-${i}`}>
                    {/* 调节时段背景 */}
                    <ReferenceArea
                      x1={s.start_td}
                      x2={s.end_td}
                      yAxisId="left"
                      fill={bgColor}
                      fillOpacity={0.35}
                      strokeOpacity={0}
                    />
                    {/* 起点标注线 */}
                    <ReferenceLine
                      x={s.start_td}
                      yAxisId="left"
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      label={{
                        value: `${isUp ? '▲' : '▼'} ${s.start_pct}%→${s.end_pct}%`,
                        position: i % 2 === 0 ? 'insideTopRight' : 'insideBottomRight',
                        fill: color,
                        fontSize: 9,
                        fontWeight: 600,
                      }}
                    />
                  </React.Fragment>
                );
              })}

              <XAxis
                dataKey="timeDecimal"
                type="number"
                domain={[-0.5, 23.5]}
                ticks={Array.from({ length: 24 }, (_, i) => i)}
                tickFormatter={(v) => `${Math.round(v)}:00`}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                angle={-45}
                textAnchor="end"
                height={40}
              />

              {/* 左轴：供水量 */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                label={{
                  value: '供水量 (m³)',
                  angle: -90,
                  position: 'insideLeft',
                  dx: -60,
                  fontSize: 11,
                  fill: '#4f86c6',
                }}
              />

              {/* 右轴：清水池水位 (m) */}
              <YAxis
                yAxisId="right-level"
                orientation="right"
                domain={[0, maxLevel]}
                tick={{ fontSize: 11, fill: '#f97316' }}
                tickFormatter={(v) => `${v}m`}
                label={{
                  value: '水位 (m)',
                  angle: 90,
                  position: 'insideRight',
                  dx: 55,
                  fontSize: 11,
                  fill: '#f97316',
                }}
              />

              {/* 隐藏轴：阀门开度 0-100% */}
              <YAxis
                yAxisId="right-valve"
                orientation="right"
                domain={[0, 100]}
                hide
              />

              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
              />

              {/* 供水量柱状图 */}
              <Bar
                yAxisId="left"
                dataKey="chengdong_supply"
                name="城东供水量"
                fill="#4f86c6"
                fillOpacity={0.85}
                barSize={20}
                radius={[2, 2, 0, 0]}
              />

              {/* 清水池水位折线 */}
              <Line
                yAxisId="right-level"
                dataKey="avg_water_level"
                name="清水池水位"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f97316' }}
                connectNulls={false}
                type="monotone"
              />

              {/* 阀门开度折线（步进，隐藏轴） */}
              <Line
                yAxisId="right-valve"
                dataKey="valve_position"
                name="阀门开度"
                stroke="#8b5cf6"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={{ r: 2, fill: '#8b5cf6' }}
                connectNulls={false}
                type="stepAfter"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 时段图例说明 */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 justify-center">
        {[
          { color: '#fef9c3', border: '#ca8a04', label: '谷电（0-8时）' },
          { color: '#dcfce7', border: '#16a34a', label: '平电（8-10, 12-15, 20-21, 22-24时）' },
          { color: '#fee2e2', border: '#dc2626', label: '峰电（10-12, 15-20, 21-22时）' },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span
              className="inline-block w-6 h-3 rounded"
              style={{ background: item.color, border: `1px solid ${item.border}` }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {/* 阀门调节会话卡片 */}
      {(data.valve_sessions?.length ?? 0) > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">阀门调节</h4>
          <div className="flex flex-wrap gap-2">
            {data.valve_sessions.map((s, i) => {
              const isUp = s.direction === 'up';
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs"
                  style={{
                    background: isUp ? '#f0fdf4' : '#fef2f2',
                    borderColor: isUp ? '#86efac' : '#fca5a5',
                  }}
                >
                  <span className="text-base" style={{ color: isUp ? '#15803d' : '#b91c1c' }}>
                    {isUp ? '▲' : '▼'}
                  </span>
                  <div>
                    <div className="font-mono font-semibold" style={{ color: isUp ? '#15803d' : '#b91c1c' }}>
                      {s.start_time} – {s.end_time}
                    </div>
                    <div className="text-gray-600 mt-0.5">
                      {s.start_pct}% → {s.end_pct}%
                      <span className="ml-1 font-semibold" style={{ color: isUp ? '#15803d' : '#b91c1c' }}>
                        ({isUp ? '+' : ''}{s.total_delta}%)
                      </span>
                      <span className="ml-1 text-gray-400">· {s.duration_min}分钟</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 每小时数据表格（时间为列，占满宽度） */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full table-fixed text-xs border-collapse">
          {/* 列宽分配：指标列固定 90px，其余 24 列均分 */}
          <colgroup>
            <col style={{ width: 90 }} />
            {hourly.map((h) => <col key={h.hour} />)}
          </colgroup>
          {/* 表头行：指标 | 0:00 | 1:00 | … | 23:00 */}
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left font-semibold">指标</th>
              {hourly.map((h) => (
                <th
                  key={h.hour}
                  className="border-b border-gray-200 px-2 py-2 text-center font-medium min-w-[46px]"
                  style={{ background: PERIOD_BG[h.period], color: PERIOD_COLORS[h.period] }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 供水量 */}
            <tr className="border-b border-gray-100">
              <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">供水量 (m³)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center text-gray-800">
                  {h.chengdong_supply > 0 ? h.chengdong_supply.toLocaleString() : <span className="text-gray-300">—</span>}
                </td>
              ))}
            </tr>
            {/* 水位均值 */}
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <td className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">水位 (m)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center text-gray-800">
                  {h.avg_water_level != null ? h.avg_water_level.toFixed(2) : <span className="text-gray-300">—</span>}
                </td>
              ))}
            </tr>
            {/* 阀门开度最大值 */}
            <tr>
              <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">阀门开度 (%)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center text-gray-800">
                  {h.max_valve_opening != null ? h.max_valve_opening.toFixed(1) : <span className="text-gray-300">—</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}
