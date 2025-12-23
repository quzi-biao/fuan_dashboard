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
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;
    
    return (
      <div className="relative h-96 bg-gray-50 rounded p-4">
        <svg className="w-full h-full">
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={data.map((d, i) => {
              const x = (i / (data.length - 1)) * 100;
              const y = 100 - ((d.value - minValue) / range) * 90;
              return `${x}%,${y}%`;
            }).join(' ')}
          />
          {data.map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = 100 - ((d.value - minValue) / range) * 90;
            return (
              <circle
                key={i}
                cx={`${x}%`}
                cy={`${y}%`}
                r="3"
                fill="#3b82f6"
              />
            );
          })}
        </svg>
        <div className="absolute top-2 left-2 text-xs text-gray-600">
          最大值: {maxValue.toFixed(2)} {unit}
        </div>
        <div className="absolute bottom-2 left-2 text-xs text-gray-600">
          最小值: {minValue.toFixed(2)} {unit}
        </div>
      </div>
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
