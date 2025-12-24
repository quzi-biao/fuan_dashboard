'use client';

import { useState } from 'react';
import { Play, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface GroupingConfigProps {
  startDate: string;
  endDate: string;
  groupCount: number;
  loading: boolean;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onGroupCountChange: (count: number) => void;
  onPerformGrouping: () => void;
}

export function GroupingConfig({
  startDate,
  endDate,
  groupCount,
  loading,
  onStartDateChange,
  onEndDateChange,
  onGroupCountChange,
  onPerformGrouping,
}: GroupingConfigProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-lg font-semibold text-gray-900">分组配置</h2>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </div>
      
      {isExpanded && (
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">分组数量</label>
            <input
              type="number"
              min="2"
              max="100"
              value={groupCount}
              onChange={(e) => onGroupCountChange(parseInt(e.target.value) || 10)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <button
            onClick={onPerformGrouping}
            disabled={loading || !startDate || !endDate}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>分组中...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>执行分组</span>
              </>
            )}
          </button>

          {/* 分组说明 */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-xs font-semibold text-blue-900 mb-2">分组说明</h3>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>滑动窗口计算平均流量</li>
              <li>平均流量 = (最大值 - 最小值) / 窗口大小</li>
              <li>总流量 = 城东 + 岩湖</li>
              <li>按流量范围自动分组</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
