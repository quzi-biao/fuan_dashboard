/**
 * 福安城东水厂智能错峰调度运行分析看板
 * 图表：柱状图（城东每小时供水量）+ 折线（清水池水位）+ 折线（阀门开度）
 * 水位和阀门开度使用每分钟原始数据绘制，供水量为小时聚合
 * 双 Y 轴：左 = 供水量 (m³/h)，右 = 清水池水位 (m)，阀门开度 (%) 使用隐藏轴
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
  chengdong_supply: number;
  avg_water_level: number | null;
  avg_valve_opening: number | null;
  period: string;
  period_name: string;
}

interface MinuteData {
  timeDecimal: number;
  label: string;
  water_level: number | null;
  valve_opening: number | null;
}

interface ApiData {
  success: boolean;
  date: string;
  hourly: HourlyData[];
  minute: MinuteData[];
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

// 时段背景区间（数值型 x 轴，单位：小时）
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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  // 将 timeDecimal 转换为可读时间
  const td = typeof label === 'number' ? label : parseFloat(label);
  const hh = Math.floor(td);
  const mm = Math.round((td - hh) * 60);
  const timeLabel = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm min-w-[170px]">
      <p className="font-semibold text-gray-700 mb-2">{timeLabel}</p>
      {payload.map((p: any) => {
        if (p.value == null) return null;
        let unit = '';
        let color = p.stroke || p.fill;
        if (p.dataKey === 'chengdong_supply') unit = ' m³';
        if (p.dataKey === 'water_level') unit = ' m';
        if (p.dataKey === 'valve_opening') unit = ' %';
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

export function ChengdongDispatchDashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/chengdong-dispatch')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json);
        else setError(json.error || '加载失败');
      })
      .catch(() => setError('网络请求失败'))
      .finally(() => setLoading(false));
  }, []);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
        加载中...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">{error || '暂无数据'}</div>
    );
  }

  const { hourly, date } = data;
  const hasData = hourly.some((h) => h.chengdong_supply > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        暂无 {date} 的供水数据
      </div>
    );
  }

  // 右轴 (水位) 范围
  const levelValues = hourly.map((h) => h.avg_water_level).filter((v): v is number => v != null && v > 0);
  const maxLevel = levelValues.length > 0 ? Math.ceil(Math.max(...levelValues) * 1.2) : 12;

  // 图表数据：24个小时数据点，barSize 能正确生效；水位/阀门使用小时均值
  const chartData = hourly.map((h) => ({
    timeDecimal: h.hour,
    chengdong_supply: h.chengdong_supply,
    avg_water_level: h.avg_water_level,
    avg_valve_opening: h.avg_valve_opening,
  }));

  return (
    <div className="space-y-6">
      {/* 日期与数据说明 */}
      <div className="text-sm text-gray-500 flex flex-wrap gap-3 items-center">
        <span>
          分析日期：<span className="font-medium text-gray-700">{date}</span>
        </span>
      </div>

      {/* 图表 */}
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth: 640 }}>
          <ResponsiveContainer width="100%" height={500}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 70, bottom: 10, left: 80 }}
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
                barSize={50}
                radius={[2, 2, 0, 0]}
              />

              {/* 清水池水位折线（小时均值） */}
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

              {/* 阀门开度折线（小时均值，隐藏轴） */}
              <Line
                yAxisId="right-valve"
                dataKey="avg_valve_opening"
                name="阀门开度"
                stroke="#8b5cf6"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={{ r: 2, fill: '#8b5cf6' }}
                connectNulls={false}
                type="monotone"
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

      {/* 每小时数据表格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200" style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 text-gray-800">
              <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold">时间</th>
              <th className="border-b border-gray-200 px-3 py-2 text-center font-semibold">时段</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-semibold">供水量 (m³)</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-semibold">水位均值 (m)</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-semibold">阀门开度均值 (%)</th>
            </tr>
          </thead>
          <tbody>
            {hourly.map((row) => (
              <tr
                key={row.hour}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="px-3 py-1.5 text-gray-800">{row.label}</td>
                <td className="px-3 py-1.5 text-center">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                    style={{
                      background: PERIOD_BG[row.period],
                      color: PERIOD_COLORS[row.period],
                    }}
                  >
                    {row.period_name}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right text-gray-800">{row.chengdong_supply.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right text-gray-800">
                  {row.avg_water_level != null ? row.avg_water_level.toFixed(2) : '-'}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-800">
                  {row.avg_valve_opening != null ? row.avg_valve_opening.toFixed(1) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
