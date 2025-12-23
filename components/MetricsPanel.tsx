'use client';

import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { MetricsHistoryDialog } from './MetricsHistoryDialog';

interface Metric {
  id: string;
  name: string;
  unit: string;
  value: number;
  time: string | null;
  highlight?: boolean;
}

interface PlantData {
  label: string;
  metrics: Metric[];
}

interface MetricsPanelProps {
  data: {
    yanhu: PlantData;
    chengdong: PlantData;
  };
  collectTime: string;
}

export function MetricsPanel({ data, collectTime }: MetricsPanelProps) {
  const [selectedMetric, setSelectedMetric] = useState<{ id: string; name: string; unit: string } | null>(null);
  
  const handleMetricClick = (id: string, name: string, unit: string) => {
    setSelectedMetric({ id, name, unit });
  };
  
  const getValueColor = (value: number) => {
    if (value === 0) return 'text-gray-400';
    return 'text-blue-600';
  };
  
  const formatValue = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1000) return value.toFixed(0);
    if (value >= 10) return value.toFixed(1);
    if (value >= 1) return value.toFixed(2);
    return value.toFixed(3);
  };
  
  // 计算宽度比例（基于指标数量）
  const yanhuCount = data.yanhu.metrics.length;
  const chengdongCount = data.chengdong.metrics.length;
  const totalCount = yanhuCount + chengdongCount;
  
  // 计算百分比宽度，最小30%，最大70%
  const yanhuPercent = Math.max(30, Math.min(70, (yanhuCount / totalCount) * 100));
  const chengdongPercent = 100 - yanhuPercent;
  
  return (
    <>
      <div className="bg-white rounded-lg shadow p-6 relative">
        {/* 左右布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
          {/* 岩湖水厂 */}
          <div className="relative">
            <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-600 rounded"></span>
              {data.yanhu.label}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {data.yanhu.metrics.map((metric) => (
                <button
                  key={metric.id}
                  onClick={() => handleMetricClick(metric.id, metric.name, metric.unit)}
                  className={`rounded-lg p-3 hover:shadow-lg transition-all text-left ${
                    metric.highlight 
                      ? 'bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300 hover:border-amber-400'
                      : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs ${metric.highlight ? 'font-bold' : 'font-medium'} text-gray-700`}>
                      {metric.name}
                    </span>
                    <TrendingUp size={14} className={metric.highlight ? 'text-amber-600' : 'text-blue-600'} />
                  </div>
                  
                  <div className={`text-lg font-bold ${
                    metric.value === 0 
                      ? 'text-gray-400' 
                      : metric.highlight 
                        ? 'text-amber-700' 
                        : 'text-blue-600'
                  }`}>
                    {formatValue(metric.value)}
                  </div>
                  
                  <div className="text-xs text-gray-600 mt-1">
                    {metric.unit}
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* 城东水厂 */}
          <div className="relative">
            <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-green-600 rounded"></span>
              {data.chengdong.label}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {data.chengdong.metrics.map((metric) => (
                <button
                  key={metric.id}
                  onClick={() => handleMetricClick(metric.id, metric.name, metric.unit)}
                  className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 hover:shadow-lg transition-all border border-green-200 hover:border-green-400 text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{metric.name}</span>
                    <TrendingUp size={14} className="text-green-600" />
                  </div>
                  
                  <div className={`text-lg font-bold ${getValueColor(metric.value)}`}>
                    {formatValue(metric.value)}
                  </div>
                  
                  <div className="text-xs text-gray-600 mt-1">
                    {metric.unit}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {/* 更新时间 */}
          <div className="absolute bottom-2 right-6 text-xs text-gray-400 mt-2">
            更新时间: {new Date(collectTime).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>
      
      {/* 历史数据对话框 */}
      {selectedMetric && (
        <MetricsHistoryDialog
          isOpen={!!selectedMetric}
          onClose={() => setSelectedMetric(null)}
          indicatorId={selectedMetric.id}
          name={selectedMetric.name}
          unit={selectedMetric.unit}
        />
      )}
    </>
  );
}
