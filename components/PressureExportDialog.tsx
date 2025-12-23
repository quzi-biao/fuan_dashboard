'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CustomDatePicker } from './CustomDatePicker';

interface PressureExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PressureExportDialog({ isOpen, onClose }: PressureExportDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  
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
  
  const handleExport = async () => {
    if (!startDate || !endDate) {
      alert('请选择日期范围');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/pressure/export?startDate=${startDate}&endDate=${endDate}`
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pressure_data_${startDate}_${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        onClose();
      } else {
        alert('导出失败');
      }
    } catch (error) {
      console.error('导出压力数据失败:', error);
      alert('导出失败');
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">导出压力数据</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* 内容 */}
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              选择导出时间范围
            </label>
            <CustomDatePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onQuery={() => {}}
              maxDays={30}
              color="blue"
              cacheKey="pressureExport"
              hideButtons={true}
            />
          </div>
        </div>
        
        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? '导出中...' : '确认导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
