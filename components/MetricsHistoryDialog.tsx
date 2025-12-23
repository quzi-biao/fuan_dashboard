'use client';

import React, { useState, useEffect } from 'react';
import { X, BarChart3, Table as TableIcon } from 'lucide-react';
import { CustomDatePicker } from './CustomDatePicker';

interface MetricsHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  indicatorId: string;
  name: string;
  unit: string;
}

export function MetricsHistoryDialog({ isOpen, onClose, indicatorId, name, unit }: MetricsHistoryDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('chart');
  
  // 初始化日期为最近7天
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const sevenDaysAgo = new Date(yesterday);
      sevenDaysAgo.setDate(yesterday.getDate() - 6);
      
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      setStartDate(formatDate(sevenDaysAgo));
      setEndDate(formatDate(yesterday));
    }
  }, [isOpen]);
  
  // 加载数据
  const loadData = async () => {
    if (!startDate || !endDate) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/metrics/history?indicatorId=${indicatorId}&startDate=${startDate}&endDate=${endDate}`
      );
      
      if (response.ok) {
        const result = await response.json();
        setData(result.data || []);
      }
    } catch (error) {
      console.error('加载历史数据失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (startDate && endDate && isOpen) {
      loadData();
    }
  }, [startDate, endDate, isOpen, indicatorId]);
  
  if (!isOpen) return null;
  
  // 图表渲染
  const renderChart = () => {
    if (data.length === 0) {
      return <div className="text-center text-gray-500 py-12">暂无数据</div>;
    }
    
    const maxValue = Math.max(...data.map(d => d.value));
    const chartData = data.map(d => ({
      time: new Date(d.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      value: d.value
    }));
    
    return (
      <SimpleLineChart 
        data={chartData}
        lines={[
          { key: 'value', name: name, color: '#3b82f6' }
        ]}
        yLabel={`${name} (${unit})`}
        maxValue={maxValue}
      />
    );
  };
  
  // 表格渲染
  const renderTable = () => {
    if (data.length === 0) {
      return <div className="text-center text-gray-500 py-12">暂无数据</div>;
    }
    
    return (
      <div className="overflow-auto max-h-96">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">数值</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm text-gray-900">
                  {new Date(row.time).toLocaleString('zh-CN')}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900">
                  {row.value.toFixed(3)} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{name} - 历史数据</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* 控制栏 */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center gap-4">
            <CustomDatePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onQuery={loadData}
              maxDays={30}
              color="blue"
              cacheKey={`metricsHistory_${indicatorId}`}
            />
            
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'chart' : 'table')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm flex-shrink-0"
            >
              {viewMode === 'table' ? (
                <><BarChart3 size={14} /> 图表</>
              ) : (
                <><TableIcon size={14} /> 表格</>
              )}
            </button>
          </div>
        </div>
        
        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : (
            viewMode === 'chart' ? renderChart() : renderTable()
          )}
        </div>
        
        {/* 底部信息 */}
        <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-600">
          共 {data.length} 条数据
        </div>
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
        {data.map((d, i) => {
          // 只显示部分标签，避免过于密集
          const showLabel = data.length <= 10 || i % Math.ceil(data.length / 10) === 0;
          if (!showLabel) return null;
          
          return (
            <text
              key={i}
              x={padding.left + i * xStep}
              y={height - padding.bottom + 20}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
              transform={`rotate(-45, ${padding.left + i * xStep}, ${height - padding.bottom + 20})`}
            >
              {d.time}
            </text>
          );
        })}

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
                      content: `${data[i].time}\n${line.name}: ${value.toFixed(3)}`
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
