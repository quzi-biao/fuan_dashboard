'use client';

import { useState } from 'react';
import { X, Calendar, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface DataSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DataSyncModal({ isOpen, onClose }: DataSyncModalProps) {
  const [syncType, setSyncType] = useState<'single' | 'range'>('single');
  const [date, setDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // 格式化日期为 YYYYMMDD
  const formatDateForAPI = (dateStr: string) => {
    return dateStr.replace(/-/g, '');
  };

  // 获取昨天的日期
  const getYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  const handleSync = async () => {
    setLoading(true);
    setResult(null);

    try {
      let url = '/api/data-sync?';
      
      if (syncType === 'single') {
        const syncDate = date || getYesterday();
        url += `date=${formatDateForAPI(syncDate)}`;
      } else {
        if (!startDate) {
          setResult({ success: false, message: '请选择开始日期' });
          setLoading(false);
          return;
        }
        url += `start_date=${formatDateForAPI(startDate)}`;
        if (endDate) {
          url += `&end_date=${formatDateForAPI(endDate)}`;
        }
      }

      const response = await fetch(url);
      const data = await response.json();

      setResult({
        success: data.success,
        message: data.message || (data.success ? '同步成功' : '同步失败')
      });

      // 如果成功，3秒后自动关闭
      if (data.success) {
        setTimeout(() => {
          onClose();
          setResult(null);
        }, 3000);
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '同步失败'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">数据同步</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 同步类型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              同步类型
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="single"
                  checked={syncType === 'single'}
                  onChange={(e) => setSyncType(e.target.value as 'single')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">单日同步</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="range"
                  checked={syncType === 'range'}
                  onChange={(e) => setSyncType(e.target.value as 'range')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">批量同步</span>
              </label>
            </div>
          </div>

          {/* 单日同步 */}
          {syncType === 'single' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                同步日期（留空则同步昨天）
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={getYesterday()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* 批量同步 */}
          {syncType === 'range' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  开始日期 *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={getYesterday()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  结束日期（留空则只同步开始日期）
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={getYesterday()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* 结果显示 */}
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {result.success ? (
                <CheckCircle size={20} className="flex-shrink-0" />
              ) : (
                <XCircle size={20} className="flex-shrink-0" />
              )}
              <span className="text-sm">{result.message}</span>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSync}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>同步中...</span>
              </>
            ) : (
              <>
                <Calendar size={16} />
                <span>开始同步</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
