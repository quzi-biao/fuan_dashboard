/**
 * 福安岩湖水厂二级泵房高效节能智能调度运行分析看板
 * 图表：柱形图（送水量）+ 折线（送水压力、千吨水电耗、泵组综合效率）
 * 表格：时间为列，指标为行（转置格式）
 */
'use client';

import React, { useEffect, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceArea, ResponsiveContainer,
} from 'recharts';

interface HourlyData {
  hour: number;
  label: string;
  period: string;
  period_name: string;
  flow_m3: number;
  pressure_mpa: number;
  power_kwh: number;
  power_1000t: number | null;
  power_1000t_mpa: number | null;
  pump_efficiency: number | null;
  pump1: '启' | '停';
  pump2: '启' | '停';
  aux_pump: '启' | '停';
}

interface Summary {
  total_flow_m3: number;
  total_power_kwh: number;
  avg_pressure_mpa: number;
  daily_power_1000t: number | null;
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

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm min-w-[180px]">
      <p className="font-semibold text-gray-700 mb-2">{payload[0]?.payload?.label}</p>
      {payload.map((p: any) => {
        if (p.value == null) return null;
        const color = p.stroke || p.fill;
        const units: Record<string, string> = {
          flow_m3: ' m³',
          pressure_mpa: ' MPa',
          power_1000t: ' kWh/kt',
          pump_efficiency: '%',
        };
        const unit = units[p.dataKey] ?? '';
        return (
          <div key={p.dataKey} className="flex items-center gap-2 mt-1" style={{ color }}>
            <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ background: color }} />
            <span>
              {p.name}：<strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>{unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PumpStatus({ status }: { status: '启' | '停' }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
      style={
        status === '启'
          ? { background: '#dcfce7', color: '#15803d' }
          : { background: '#f1f5f9', color: '#94a3b8' }
      }
    >
      {status}
    </span>
  );
}

export function YanhuDispatchDashboard({ date: selectedDate }: { date?: string }) {
  const [hourly, setHourly] = useState<HourlyData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/dashboard/yanhu-dispatch${selectedDate ? `?date=${selectedDate}` : ''}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setHourly(json.hourly);
          setSummary(json.summary ?? null);
          setDate(json.date);
        } else {
          setError(json.error || '加载失败');
        }
      })
      .catch(() => setError('网络请求失败'))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
        加载中...
      </div>
    );
  }
  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>;
  }
  if (!hourly.length || !hourly.some((h) => h.flow_m3 > 0)) {
    return <div className="flex items-center justify-center h-64 text-gray-400">暂无 {date} 的送水数据</div>;
  }

  // 最大压力用于右轴范围
  const maxPressure = Math.max(...hourly.map((h) => h.pressure_mpa).filter(Boolean)) * 1.2 || 1;

  return (
    <div className="space-y-6">
      {/* 日期 + 汇总卡片 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500">
          分析日期：<span className="font-medium text-gray-700">{date}</span>
        </span>
        {summary && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: '日送水量', value: summary.total_flow_m3.toLocaleString(), unit: 'm³', color: '#4f86c6' },
              { label: '日耗电量', value: summary.total_power_kwh.toFixed(1), unit: 'kWh', color: '#8b5cf6' },
              { label: '日均压力', value: summary.avg_pressure_mpa.toFixed(4), unit: 'MPa', color: '#f97316' },
              { label: '日千吨水电耗', value: summary.daily_power_1000t?.toFixed(2) ?? '—', unit: 'kWh/kt', color: '#6b7280' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs"
                style={{ borderColor: item.color + '40', background: item.color + '0d' }}
              >
                <span className="text-gray-500">{item.label}</span>
                <span className="font-bold" style={{ color: item.color }}>{item.value}</span>
                {item.unit && <span className="text-gray-400">{item.unit}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 图表 */}
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth: 640 }}>
          <ResponsiveContainer width="100%" height={500}>
            <ComposedChart data={hourly} margin={{ top: 16, right: 80, bottom: 10, left: 60 }}>
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

              <XAxis
                dataKey="hour"
                type="number"
                domain={[-0.5, 23.5]}
                ticks={Array.from({ length: 24 }, (_, i) => i)}
                tickFormatter={(v) => `${Math.round(v)}:00`}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                angle={-45}
                textAnchor="end"
                height={40}
              />

              {/* 左轴：送水量 */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                label={{
                  value: '送水量 (m³)',
                  angle: -90,
                  position: 'insideLeft',
                  dx: -45,
                  fontSize: 11,
                  fill: '#4f86c6',
                }}
              />

              {/* 右轴：送水压力 */}
              <YAxis
                yAxisId="right-pressure"
                orientation="right"
                domain={[0, +maxPressure.toFixed(2)]}
                tick={{ fontSize: 11, fill: '#f97316' }}
                tickFormatter={(v) => `${v.toFixed(2)}`}
                label={{
                  value: '压力 (MPa)',
                  angle: 90,
                  position: 'insideRight',
                  dx: 60,
                  fontSize: 11,
                  fill: '#f97316',
                }}
              />

              {/* 隐藏轴：千吨水电耗 (auto scale) */}
              <YAxis yAxisId="right-power" orientation="right" hide />

              {/* 隐藏轴：泵组综合效率 0-200% */}
              <YAxis yAxisId="right-eff" orientation="right" domain={[0, 200]} hide />

              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
              />

              {/* 送水量柱形图 */}
              <Bar
                yAxisId="left"
                dataKey="flow_m3"
                name="送水量"
                fill="#4f86c6"
                fillOpacity={0.85}
                barSize={20}
                radius={[2, 2, 0, 0]}
              />

              {/* 送水压力曲线 */}
              <Line
                yAxisId="right-pressure"
                dataKey="pressure_mpa"
                name="送水压力"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f97316' }}
                connectNulls
                type="monotone"
              />

              {/* 千吨水电耗曲线 */}
              <Line
                yAxisId="right-power"
                dataKey="power_1000t"
                name="千吨水电耗"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 2, fill: '#8b5cf6' }}
                connectNulls
                type="monotone"
              />

              {/* 泵组综合效率曲线 */}
              <Line
                yAxisId="right-eff"
                dataKey="pump_efficiency"
                name="泵组综合效率"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 2, fill: '#10b981' }}
                connectNulls
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 时段图例 */}
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

      {/* 每小时数据表格（时间为列） */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full table-fixed text-xs border-collapse">
          <colgroup>
            <col style={{ width: 110 }} />
            {hourly.map((h) => <col key={h.hour} />)}
          </colgroup>
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left font-semibold">
                指标
              </th>
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
            {/* 送水量 */}
            <tr className="border-b border-gray-100">
              <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">送水量 (m³)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center text-gray-800">
                  {h.flow_m3 > 0 ? h.flow_m3.toLocaleString() : <span className="text-gray-300">—</span>}
                </td>
              ))}
            </tr>
            {/* 送水压力 */}
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <td className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">送水压力 (MPa)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center text-gray-800">
                  {h.pressure_mpa > 0 ? h.pressure_mpa.toFixed(4) : <span className="text-gray-300">—</span>}
                </td>
              ))}
            </tr>
            {/* 耗电量 */}
            <tr className="border-b border-gray-100">
              <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">耗电量 (kWh)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center text-gray-800">
                  {h.power_kwh > 0 ? h.power_kwh.toFixed(1) : <span className="text-gray-300">—</span>}
                </td>
              ))}
            </tr>
            {/* 千吨水电耗 */}
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <td className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">千吨水电耗 (kWh/kt)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center text-gray-800">
                  {h.power_1000t != null ? h.power_1000t.toFixed(1) : <span className="text-gray-300">—</span>}
                </td>
              ))}
            </tr>
            {/* 千吨水兆帕电耗 */}
            <tr className="border-b border-gray-100">
              <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">千吨水兆帕电耗</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center text-gray-800">
                  {h.power_1000t_mpa != null ? h.power_1000t_mpa.toFixed(1) : <span className="text-gray-300">—</span>}
                </td>
              ))}
            </tr>
            {/* 泵组综合效率 */}
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <td className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">泵组综合效率 (%)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center font-medium text-blue-700">
                  {h.pump_efficiency != null ? `${h.pump_efficiency.toFixed(1)}%` : <span className="text-gray-300">—</span>}
                </td>
              ))}
            </tr>
            {/* 泵1 */}
            <tr className="border-b border-gray-100">
              <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">泵1 (i_1049)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center">
                  <PumpStatus status={h.pump1} />
                </td>
              ))}
            </tr>
            {/* 泵2 */}
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <td className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">泵2 (i_1050)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center">
                  <PumpStatus status={h.pump2} />
                </td>
              ))}
            </tr>
            {/* 辅泵 */}
            <tr>
              <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-1.5 font-medium text-gray-700">辅泵 (i_1051)</td>
              {hourly.map((h) => (
                <td key={h.hour} className="px-2 py-1.5 text-center">
                  <PumpStatus status={h.aux_pump} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
