/**
 * 流量数据分时段分析图表组件
 */
'use client';

import React from 'react';

interface FlowAnalysisData {
  date: string;
  period: string;
  period_name: string;
  chengdong_avg_flow: number;
  yanhu_avg_flow: number;
  chengdong_cumulative_flow: number;
  yanhu_cumulative_flow: number;
  yanhu_electricity: number;
  total_cumulative_flow: number;
  is_total?: boolean;
}

interface Props {
  data: FlowAnalysisData[];
}

export function FlowAnalysisCharts({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">暂无数据</div>;
  }

  // 按日期分组
  const groupedByDate = data.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = {};
    }
    acc[item.date][item.period] = item;
    return acc;
  }, {} as Record<string, Record<string, FlowAnalysisData>>);

  // 按日期排序
  const sortedDates = Object.keys(groupedByDate).sort();

  // 准备图表数据
  const chartData = sortedDates.map(date => {
    const dayData = groupedByDate[date];
    return {
      date,
      valley_chengdong: dayData['valley']?.chengdong_cumulative_flow || 0,
      flat_chengdong: dayData['flat']?.chengdong_cumulative_flow || 0,
      peak_chengdong: dayData['peak']?.chengdong_cumulative_flow || 0,
      valley_yanhu: dayData['valley']?.yanhu_cumulative_flow || 0,
      flat_yanhu: dayData['flat']?.yanhu_cumulative_flow || 0,
      peak_yanhu: dayData['peak']?.yanhu_cumulative_flow || 0,
      valley_electricity: dayData['valley']?.yanhu_electricity || 0,
      flat_electricity: dayData['flat']?.yanhu_electricity || 0,
      peak_electricity: dayData['peak']?.yanhu_electricity || 0,
      total_chengdong: dayData['total']?.chengdong_cumulative_flow || 0,
      total_yanhu: dayData['total']?.yanhu_cumulative_flow || 0,
      total_electricity: dayData['total']?.yanhu_electricity || 0,
      total_supply: dayData['total']?.total_cumulative_flow || 0,
    };
  });

  // 找出最大值用于设置Y轴范围
  const maxFlow = Math.max(...chartData.flatMap(d => [
    d.valley_chengdong, d.flat_chengdong, d.peak_chengdong,
    d.valley_yanhu, d.flat_yanhu, d.peak_yanhu
  ]));
  const maxElectricity = Math.max(...chartData.flatMap(d => [
    d.valley_electricity, d.flat_electricity, d.peak_electricity
  ]));
  const maxTotalElectricity = Math.max(...chartData.map(d => d.total_electricity));
  const maxTotal = Math.max(...chartData.map(d => d.total_supply));

  return (
    <div className="space-y-8">
      {/* 城东谷平峰流量对比变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">城东谷平峰流量对比变化</h3>
        <SimpleLineChart 
          data={chartData}
          lines={[
            { key: 'valley_chengdong', name: '谷电', color: '#3b82f6' },
            { key: 'flat_chengdong', name: '平电', color: '#eab308' },
            { key: 'peak_chengdong', name: '峰电', color: '#ef4444' }
          ]}
          yLabel="流量 (m³)"
          maxValue={maxFlow}
        />
      </div>

      {/* 岩湖谷平峰流量对比变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">岩湖谷平峰流量对比变化</h3>
        <SimpleLineChart 
          data={chartData}
          lines={[
            { key: 'valley_yanhu', name: '谷电', color: '#3b82f6' },
            { key: 'flat_yanhu', name: '平电', color: '#eab308' },
            { key: 'peak_yanhu', name: '峰电', color: '#ef4444' }
          ]}
          yLabel="流量 (m³)"
          maxValue={maxFlow}
        />
      </div>

      {/* 岩湖谷平峰电量对比变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">岩湖谷平峰电量对比变化</h3>
        <SimpleLineChart 
          data={chartData}
          lines={[
            { key: 'valley_electricity', name: '谷电', color: '#3b82f6' },
            { key: 'flat_electricity', name: '平电', color: '#eab308' },
            { key: 'peak_electricity', name: '峰电', color: '#ef4444' }
          ]}
          yLabel="电量 (kWh)"
          maxValue={maxElectricity}
        />
      </div>

      {/* 谷平峰总供水量对比变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">谷平峰总供水量对比变化</h3>
        <SimpleLineChart 
          data={chartData}
          lines={[
            { key: 'valley_chengdong', name: '谷电城东', color: '#3b82f6' },
            { key: 'valley_yanhu', name: '谷电岩湖', color: '#60a5fa' },
            { key: 'flat_chengdong', name: '平电城东', color: '#eab308' },
            { key: 'flat_yanhu', name: '平电岩湖', color: '#fde047' },
            { key: 'peak_chengdong', name: '峰电城东', color: '#ef4444' },
            { key: 'peak_yanhu', name: '峰电岩湖', color: '#fca5a5' }
          ]}
          yLabel="流量 (m³)"
          maxValue={maxFlow}
        />
      </div>

      {/* 城东总流量变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">城东总流量变化</h3>
        <SimpleLineChart 
          data={chartData}
          lines={[
            { key: 'total_chengdong', name: '城东总流量', color: '#3b82f6' }
          ]}
          yLabel="流量 (m³)"
          maxValue={maxTotal}
        />
      </div>

      {/* 岩湖总流量变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">岩湖总流量变化</h3>
        <SimpleLineChart 
          data={chartData}
          lines={[
            { key: 'total_yanhu', name: '岩湖总流量', color: '#10b981' }
          ]}
          yLabel="流量 (m³)"
          maxValue={maxTotal}
        />
      </div>

      {/* 岩湖总电量变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">岩湖总电量变化</h3>
        <SimpleLineChart 
          data={chartData}
          lines={[
            { key: 'total_electricity', name: '岩湖总电量', color: '#8b5cf6' }
          ]}
          yLabel="电量 (kWh)"
          maxValue={maxTotalElectricity}
        />
      </div>

      {/* 总供水量变化图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">总供水量变化</h3>
        <SimpleLineChart 
          data={chartData}
          lines={[
            { key: 'total_supply', name: '总供水量', color: '#f59e0b' }
          ]}
          yLabel="流量 (m³)"
          maxValue={maxTotal}
        />
      </div>

      {/* 城东岩湖总供水柱状图 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">城东岩湖总供水对比</h3>
        <SimpleBarChart 
          data={chartData}
          bars={[
            { key: 'total_chengdong', name: '城东', color: '#3b82f6' },
            { key: 'total_yanhu', name: '岩湖', color: '#10b981' }
          ]}
          yLabel="流量 (m³)"
          maxValue={maxTotal}
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
          const value = (maxValue * 1.1 * ratio).toFixed(0);
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
          const points = data.map((d, i) => ({
            x: padding.left + i * xStep,
            y: height - padding.bottom - d[line.key] * yScale
          }));
          const pathData = points.map((p, i) => 
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
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="3"
                  fill={line.color}
                  onMouseEnter={(e) => {
                    const value = data[i][line.key];
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      content: `${data[i].date}\n${line.name}: ${value.toFixed(2)}`
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

// 简单柱状图组件
function SimpleBarChart({ data, bars, yLabel, maxValue }: {
  data: any[];
  bars: { key: string; name: string; color: string }[];
  yLabel: string;
  maxValue: number;
}) {
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; content: string } | null>(null);
  
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 120, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const groupWidth = chartWidth / data.length;
  const barWidth = groupWidth / (bars.length + 1);
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
          const value = (maxValue * 1.1 * ratio).toFixed(0);
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

        {/* 柱状图 */}
        {data.map((d, i) => (
          <g key={i}>
            {bars.map((bar, j) => {
              const x = padding.left + i * groupWidth + j * barWidth + barWidth / 2;
              const barHeight = d[bar.key] * yScale;
              const y = height - padding.bottom - barHeight;
              
              return (
                <rect
                  key={bar.key}
                  x={x}
                  y={y}
                  width={barWidth * 0.8}
                  height={barHeight}
                  fill={bar.color}
                  opacity="0.8"
                  onMouseEnter={(e) => {
                    const value = d[bar.key];
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      content: `${d.date}\n${bar.name}: ${value.toFixed(2)}`
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}
            {/* X轴标签 */}
            <text
              x={padding.left + i * groupWidth + groupWidth / 2}
              y={height - padding.bottom + 20}
              textAnchor="middle"
              fontSize="11"
              fill="#6b7280"
              transform={`rotate(-45, ${padding.left + i * groupWidth + groupWidth / 2}, ${height - padding.bottom + 20})`}
            >
              {d.date}
            </text>
          </g>
        ))}

        {/* 图例 */}
        {bars.map((bar, i) => (
          <g key={bar.key} transform={`translate(${width - padding.right + 10}, ${padding.top + i * 25})`}>
            <rect x="0" y="-8" width="20" height="12" fill={bar.color} opacity="0.8" />
            <text x="25" y="4" fontSize="12" fill="#374151">{bar.name}</text>
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
