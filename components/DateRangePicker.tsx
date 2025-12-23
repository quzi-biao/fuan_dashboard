/**
 * 日期范围选择器组件
 * 提供更好的用户体验
 */
'use client';

import { Calendar } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onQuery: () => void;
  maxDays?: number;
  color?: 'blue' | 'green';
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onQuery,
  maxDays = 30,
  color = 'blue'
}: DateRangePickerProps) {
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const colorClasses = {
    blue: {
      button: 'bg-blue-600 hover:bg-blue-700',
      ring: 'focus:ring-blue-500',
      border: 'border-blue-500'
    },
    green: {
      button: 'bg-green-600 hover:bg-green-700',
      ring: 'focus:ring-green-500',
      border: 'border-green-500'
    }
  };

  const colors = colorClasses[color];

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '选择日期';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (startRef.current && !startRef.current.contains(event.target as Node)) {
        setShowStartPicker(false);
      }
      if (endRef.current && !endRef.current.contains(event.target as Node)) {
        setShowEndPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* 开始日期 */}
      <div className="relative" ref={startRef}>
        <button
          onClick={() => setShowStartPicker(!showStartPicker)}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm border-2 ${colors.border} rounded-lg ${colors.ring} focus:outline-none focus:ring-2 bg-white hover:shadow-md transition-all`}
        >
          <Calendar size={16} className={color === 'blue' ? 'text-blue-600' : 'text-green-600'} />
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-500">开始日期</span>
            <span className="text-sm font-semibold text-gray-900">{formatDate(startDate)}</span>
          </div>
        </button>
        {showStartPicker && (
          <div className="absolute z-50 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl p-4">
            <div className="text-xs text-gray-500 mb-2">选择开始日期</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                onStartDateChange(e.target.value);
                setShowStartPicker(false);
              }}
              className={`px-3 py-2 text-sm text-gray-900 border-2 border-gray-300 rounded-lg ${colors.ring} focus:outline-none focus:ring-2 focus:border-transparent`}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* 箭头 */}
      <div className="text-gray-400 font-bold">→</div>

      {/* 结束日期 */}
      <div className="relative" ref={endRef}>
        <button
          onClick={() => setShowEndPicker(!showEndPicker)}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm border-2 ${colors.border} rounded-lg ${colors.ring} focus:outline-none focus:ring-2 bg-white hover:shadow-md transition-all`}
        >
          <Calendar size={16} className={color === 'blue' ? 'text-blue-600' : 'text-green-600'} />
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-500">结束日期</span>
            <span className="text-sm font-semibold text-gray-900">{formatDate(endDate)}</span>
          </div>
        </button>
        {showEndPicker && (
          <div className="absolute z-50 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl p-4">
            <div className="text-xs text-gray-500 mb-2">选择结束日期</div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                onEndDateChange(e.target.value);
                setShowEndPicker(false);
              }}
              className={`px-3 py-2 text-sm text-gray-900 border-2 border-gray-300 rounded-lg ${colors.ring} focus:outline-none focus:ring-2 focus:border-transparent`}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* 查询按钮 */}
      <button
        onClick={onQuery}
        className={`px-6 py-2 ${colors.button} text-white rounded-lg transition-all text-sm font-semibold shadow-md hover:shadow-lg`}
      >
        查询数据
      </button>

      {/* 提示 */}
      <div className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full">
        <span className="text-xs text-gray-600">最多 {maxDays} 天</span>
      </div>
    </div>
  );
}
