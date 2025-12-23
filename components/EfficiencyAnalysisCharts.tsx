/**
 * 能效分析图表组件
 */
'use client';

import React from 'react';

interface EfficiencyAnalysisData {
  date: string;
  pressure_simple_avg: number;
  pressure_weighted_avg: number;
  pressure_max: number;
  pressure_min: number;
  daily_water_supply: number;
  daily_power_consumption: number;
  power_per_1000t: number;
  power_per_pressure: number;
}

interface Props {
  data: EfficiencyAnalysisData[];
}

export function EfficiencyAnalysisCharts({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">暂无数据</div>;
  }

  // 按日期排序
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));

  // 找出各指标的最大值
  const maxPressure = Math.max(...sortedData.map(d => Math.max(d.pressure_simple_avg, d.pressure_weighted_avg, d.pressure_max)));
  const maxWater = Math.max(...sortedData.map(d => d.daily_water_supply));
  const maxPower = Math.max(...sortedData.map(d => d.daily_power_consumption));
  const maxPowerPer1000t = Math.max(...sortedData.map(d => d.power_per_1000t));
  const maxPowerPerPressure = Math.max(...sortedData.map(d => d.power_per_pressure));

  return (
    <div className="space-y-8">
      {/* 压力指标变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">压力指标变化</h3>
        <SimpleLineChart 
          data={sortedData}
          lines={[
            { key: 'pressure_simple_avg', name: '简单平均压力', color: '#3b82f6' },
            { key: 'pressure_weighted_avg', name: '加权平均压力', color: '#10b981' },
            { key: 'pressure_max', name: '最大压力', color: '#ef4444' },
            { key: 'pressure_min', name: '最小压力', color: '#eab308' }
          ]}
          yLabel="压力 (MPa)"
          maxValue={maxPressure}
        />
      </div>

      {/* 日供水量变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">日供水量变化</h3>
        <SimpleLineChart 
          data={sortedData}
          lines={[
            { key: 'daily_water_supply', name: '日供水量', color: '#3b82f6' }
          ]}
          yLabel="供水量 (m³)"
          maxValue={maxWater}
        />
      </div>

      {/* 日耗电量变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">日耗电量变化</h3>
        <SimpleLineChart 
          data={sortedData}
          lines={[
            { key: 'daily_power_consumption', name: '日耗电量', color: '#8b5cf6' }
          ]}
          yLabel="耗电量 (kWh)"
          maxValue={maxPower}
        />
      </div>

      {/* 千吨水电耗变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">千吨水电耗变化</h3>
        <SimpleLineChart 
          data={sortedData}
          lines={[
            { key: 'power_per_1000t', name: '千吨水电耗', color: '#f59e0b' }
          ]}
          yLabel="电耗"
          maxValue={maxPowerPer1000t}
        />
      </div>

      {/* 能效比变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">能效比变化</h3>
        <SimpleLineChart 
          data={sortedData}
          lines={[
            { key: 'power_per_pressure', name: '能效比', color: '#ec4899' }
          ]}
          yLabel="能效比"
          maxValue={maxPowerPerPressure}
        />
      </div>
    </div>
  );
}

// 简单折线图组件
function SimpleLineChart({ data, lines, yLabel, maxValue }: {
  data: any[];
  lines: { key: string; name: string; color: string }[];
  yLabel: string;
  maxValue: number;
}) {
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; content: string } | null>(null);
  
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 120, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xStep = chartWidth / (data.length - 1 || 1);
  const yScale = chartHeight / (maxValue * 1.1 || 1);

  return (
    <div className="overflow-x-auto relative">
      <svg width={width} height={height} className="mx-auto">
        {/* Y轴 */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="#e5e7eb"
          strokeWidth="2"
        />
        {/* X轴 */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#e5e7eb"
          strokeWidth="2"
        />

        {/* Y轴刻度和网格线 */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding.bottom - chartHeight * ratio;
          const value = (maxValue * 1.1 * ratio).toFixed(2);
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#f3f4f6"
                strokeWidth="1"
                strokeDasharray="4"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#6b7280"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* X轴标签 */}
        {data.map((d, i) => (
          <text
            key={i}
            x={padding.left + i * xStep}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fontSize="11"
            fill="#6b7280"
            transform={`rotate(-45, ${padding.left + i * xStep}, ${height - padding.bottom + 20})`}
          >
            {d.date}
          </text>
        ))}

        {/* 折线 */}
        {lines.map((line) => {
          const pointsWithIndex = data
            .map((d, i) => {
              const value = d[line.key];
              // 过滤掉无效值
              if (value === undefined || value === null || value === 0) return null;
              return {
                x: padding.left + i * xStep,
                y: height - padding.bottom - value * yScale,
                dataIndex: i
              };
            })
            .filter(p => p !== null) as { x: number; y: number; dataIndex: number }[];

          if (pointsWithIndex.length === 0) return null;

          const pathData = pointsWithIndex.map((p, i) => 
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
          ).join(' ');

          return (
            <g key={line.key}>
              <path
                d={pathData}
                fill="none"
                stroke={line.color}
                strokeWidth="2"
              />
              {pointsWithIndex.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="3"
                  fill={line.color}
                  onMouseEnter={(e) => {
                    const value = data[p.dataIndex][line.key];
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      content: `${data[p.dataIndex].date}\n${line.name}: ${value.toFixed(4)}`
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </g>
          );
        })}

        {/* 图例 */}
        {lines.map((line, i) => (
          <g key={line.key} transform={`translate(${width - padding.right + 10}, ${padding.top + i * 25})`}>
            <line x1="0" y1="0" x2="20" y2="0" stroke={line.color} strokeWidth="2" />
            <text x="25" y="4" fontSize="12" fill="#374151">{line.name}</text>
          </g>
        ))}

        {/* Y轴标签 */}
        <text
          x={padding.left - 45}
          y={height / 2}
          textAnchor="middle"
          fontSize="12"
          fill="#374151"
          transform={`rotate(-90, ${padding.left - 45}, ${height / 2})`}
        >
          {yLabel}
        </text>
      </svg>
      
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed bg-gray-800 text-white px-3 py-2 rounded shadow-lg text-sm whitespace-pre-line z-50 pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
