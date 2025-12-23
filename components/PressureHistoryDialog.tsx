'use client';

import React, { useState, useEffect } from 'react';
import { X, BarChart3, Table as TableIcon } from 'lucide-react';
import { CustomDatePicker } from './CustomDatePicker';

interface PressureHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sn: string;
  label: string;
}

export function PressureHistoryDialog({ isOpen, onClose, sn, label }: PressureHistoryDialogProps) {
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
      setData([]);
    }
  }, [isOpen]);
  
  const loadData = async () => {
    if (!startDate || !endDate) {
      alert('请选择日期范围');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/pressure/history?sn=${sn}&startDate=${startDate}&endDate=${endDate}`
      );
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        alert('加载数据失败');
      }
    } catch (error) {
      console.error('加载压力历史数据失败:', error);
      alert('加载数据失败');
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  // 计算图表数据
  const maxPressure = data.length > 0 ? Math.max(...data.map(d => d.pressure)) : 1;
  const minPressure = data.length > 0 ? Math.min(...data.map(d => d.pressure)) : 0;
  const pressureRange = maxPressure - minPressure;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{label} - 历史数据</h2>
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
              cacheKey={`pressureHistory_${sn}`}
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
          {data.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              {loading ? '加载中...' : '暂无数据，请选择日期范围并查询'}
            </div>
          ) : viewMode === 'chart' ? (
            <PressureChart data={data} label={label} maxPressure={maxPressure} minPressure={minPressure} />
          ) : (
            <PressureTable data={data} />
          )}
        </div>
      </div>
    </div>
  );
}

// 压力图表组件
function PressureChart({ data, label, maxPressure, minPressure }: { 
  data: any[]; 
  label: string;
  maxPressure: number;
  minPressure: number;
}) {
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; content: string } | null>(null);
  
  const width = 1000;
  const height = 400;
  const padding = { top: 20, right: 40, bottom: 80, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const pressureRange = maxPressure - minPressure || 1;
  const yScale = chartHeight / (pressureRange * 1.1);
  const xStep = chartWidth / (data.length - 1 || 1);
  
  // 采样数据以避免过多点
  const sampledData = data.length > 200 
    ? data.filter((_, i) => i % Math.ceil(data.length / 200) === 0)
    : data;
  
  const points = sampledData.map((d, i) => ({
    x: padding.left + (i / (sampledData.length - 1 || 1)) * chartWidth,
    y: height - padding.bottom - (d.pressure - minPressure) * yScale,
    pressure: d.pressure,
    time: d.collect_time,
    originalIndex: data.indexOf(d)
  }));
  
  const pathData = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');
  
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
        
        {/* Y轴刻度 */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding.bottom - chartHeight * ratio;
          const value = (minPressure + pressureRange * 1.1 * ratio).toFixed(2);
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
        
        {/* X轴标签 - 显示部分时间点 */}
        {points.filter((_, i) => i % Math.ceil(points.length / 8) === 0).map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fontSize="10"
            fill="#6b7280"
            transform={`rotate(-45, ${p.x}, ${height - padding.bottom + 20})`}
          >
            {new Date(p.time).toLocaleString('zh-CN', { 
              month: '2-digit', 
              day: '2-digit', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </text>
        ))}
        
        {/* 折线 */}
        <path
          d={pathData}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        />
        
        {/* 数据点 */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#3b82f6"
            onMouseEnter={(e) => {
              setTooltip({
                x: e.clientX,
                y: e.clientY,
                content: `${new Date(p.time).toLocaleString('zh-CN')}\n压力: ${p.pressure.toFixed(3)} MPa`
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            style={{ cursor: 'pointer' }}
          />
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
          压力 (MPa)
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

// 压力表格组件
function PressureTable({ data }: { data: any[] }) {
  return (
    <div className="max-h-[500px] overflow-y-auto border rounded">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              时间
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              压力 (MPa)
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {new Date(row.collect_time).toLocaleString('zh-CN')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {row.pressure.toFixed(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
