/**
 * 自定义日历选择器
 * 真正的日历视图，不使用原生 input
 */
'use client';

import { Calendar, ChevronLeft, ChevronRight, Search, CalendarDays } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface CustomDatePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onQuery: () => void;
  maxDays?: number;
  color?: 'blue' | 'green';
  cacheKey?: string;
  hideButtons?: boolean; // 隐藏查询和快捷按钮
}

export function CustomDatePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onQuery,
  maxDays = 30,
  color = 'blue',
  cacheKey = 'dateRange',
  hideButtons = false
}: CustomDatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectingType, setSelectingType] = useState<'start' | 'end'>('start');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [isMounted, setIsMounted] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // 标记组件已挂载（客户端）
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 缓存日期到 localStorage
  useEffect(() => {
    if (startDate && endDate) {
      localStorage.setItem(cacheKey, JSON.stringify({ startDate, endDate }));
    }
  }, [startDate, endDate, cacheKey]);

  const colorClasses = {
    blue: {
      button: 'bg-blue-600 hover:bg-blue-700',
      selected: 'bg-blue-600 text-white',
      hover: 'hover:bg-blue-100',
      border: 'border-blue-500'
    },
    green: {
      button: 'bg-green-600 hover:bg-green-700',
      selected: 'bg-green-600 text-white',
      hover: 'hover:bg-green-100',
      border: 'border-green-500'
    }
  };

  const colors = colorClasses[color];

  // 格式化日期显示（完整版）
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '选择日期';
    // 避免水合错误：仅在客户端格式化日期
    if (!isMounted) return '选择日期';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 格式化日期显示（简短版，用于小屏幕）
  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '日期';
    if (!isMounted) return '日期';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatFullDate = (dateStr: string) => {
    if (!dateStr) return '未选择';
    if (!isMounted) return '未选择';
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 生成日历数据
  const generateCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];
    
    // 填充前面的空白
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // 填充日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const handleDateClick = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (selectingType === 'start') {
      // 检查开始日期不能晚于结束日期
      if (endDate && dateStr > endDate) {
        alert('开始日期不能晚于结束日期');
        return;
      }
      onStartDateChange(dateStr);
      setSelectingType('end');
    } else {
      // 检查结束日期不能早于开始日期
      if (startDate && dateStr < startDate) {
        alert('结束日期不能早于开始日期');
        return;
      }
      onEndDateChange(dateStr);
      setShowCalendar(false);
    }
  };

  const isDateSelected = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === startDate || dateStr === endDate;
  };

  const isDateInRange = (day: number) => {
    if (!startDate || !endDate) return false;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr > startDate && dateStr < endDate;
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const openCalendar = (type: 'start' | 'end') => {
    setSelectingType(type);
    setShowCalendar(true);
    // 设置当前月份为已选日期的月份
    const dateToShow = type === 'start' ? startDate : endDate;
    if (dateToShow) {
      setCurrentMonth(new Date(dateToShow));
    }
  };

  // 快捷选择最近7天（不包含今天）
  const selectLast7Days = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sevenDaysAgo = new Date(yesterday);
    sevenDaysAgo.setDate(yesterday.getDate() - 6); // 昨天往前推6天，共7天
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    onStartDateChange(formatDate(sevenDaysAgo));
    onEndDateChange(formatDate(yesterday)); // 结束日期为昨天
    onQuery();
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const calendarDays = generateCalendar();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* 日期范围显示 */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => openCalendar('start')}
          className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition text-sm"
          title={`开始: ${formatDate(startDate)}`}
        >
          <Calendar size={14} />
          <span className="hidden md:inline">{formatDate(startDate)}</span>
        </button>

        <span className="text-gray-400 text-xs">→</span>

        <button
          onClick={() => openCalendar('end')}
          className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition text-sm"
          title={`结束: ${formatDate(endDate)}`}
        >
          <Calendar size={14} />
          <span className="hidden md:inline">{formatDate(endDate)}</span>
        </button>
      </div>

      {/* 日历弹窗 */}
      {showCalendar && (
        <div ref={calendarRef} className="absolute z-50 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl p-4 w-80">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
              <ChevronLeft size={20} className="text-gray-900" />
            </button>
            <div className="text-lg font-bold text-gray-900">
              {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
            </div>
            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
              <ChevronRight size={20} className="text-gray-900" />
            </button>
          </div>

          {/* 提示 */}
          <div className="text-sm text-gray-700 font-medium mb-3">
            {selectingType === 'start' ? '选择开始日期' : '选择结束日期'}
          </div>

          {/* 星期标题 */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-semibold text-gray-700 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <div key={index}>
                {day ? (
                  <button
                    onClick={() => handleDateClick(day)}
                    className={`w-full aspect-square flex items-center justify-center text-sm font-medium rounded-lg transition-all
                      ${isDateSelected(day) ? colors.selected : 
                        isDateInRange(day) ? 'bg-gray-100 text-gray-900' : 
                        `${colors.hover} text-gray-900`}
                    `}
                  >
                    {day}
                  </button>
                ) : (
                  <div className="w-full aspect-square" />
                )}
              </div>
            ))}
          </div>

          {/* 当前选择 */}
          <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-800">
            <div className="font-medium">开始: {formatFullDate(startDate)}</div>
            <div className="font-medium">结束: {formatFullDate(endDate)}</div>
          </div>
        </div>
      )}
      
      {!hideButtons && (
        <>
          {/* 查询按钮 */}
          <button
            onClick={onQuery}
            className={`flex items-center gap-1.5 px-3 py-1.5 ${colors.button} text-white rounded hover:${color === 'blue' ? 'bg-blue-700' : 'bg-green-700'} transition text-sm`}
            title="查询数据"
          >
            <Search size={14} />
            <span className="hidden sm:inline">查询数据</span>
          </button>

          {/* 最近7天按钮 */}
          <button
            onClick={selectLast7Days}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm"
            title="最近7天"
          >
            <CalendarDays size={14} />
            <span className="hidden sm:inline">最近7天</span>
          </button>
        </>
      )}
    </div>
  );
}
