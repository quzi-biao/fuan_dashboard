'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

const INDICATOR_START = 1104;

export default function ValveSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<number[]>(Array(12).fill(0));
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/valve-settings');
      const result = await res.json();
      if (result.success && result.data) {
        const fetchedValues = Array(12).fill(0);
        for (let i = 0; i < 12; i++) {
          const indicatorId = (INDICATOR_START + i).toString();
          fetchedValues[i] = result.data[indicatorId] ?? 0;
        }
        setValues(fetchedValues);
      } else {
        setMessage({ type: 'error', text: result.error || '获取数据失败' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: '请求网络错误，无法加载当前开度数据' });
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (index: number, val: string) => {
    const num = Number(val);
    const newValues = [...values];
    newValues[index] = isNaN(num) ? 0 : num;
    setValues(newValues);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch('/api/valve-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      });
      const result = await res.json();

      if (result.success) {
        setMessage({ type: 'success', text: '所有时段开度下发成功！' });
        // Optional: clear success message after short delay
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: result.error || '下发保存失败' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: '请求下发失败，请检查网络或服务端日志' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="mt-4 text-gray-600 text-sm">正在加载设备数据...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* 顶部标题与返回按钮 */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 -ml-2 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-colors"
              title="返回首页"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">时段开度设置</h1>
              <p className="text-sm text-gray-500 mt-1">控制周期阀门开闭参数，支持1至12时段独立设定。</p>
            </div>
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow font-medium transition-all disabled:opacity-60 disabled:cursor-wait"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save size={20} />
            )}
            <span>保存配置</span>
          </button>
        </div>

        {/* 提示信息 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* 核心设定区块：分成两列展示即可 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {values.map((val, idx) => (
              <div key={idx} className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1.5 ml-1">
                  时段 {idx + 1}
                  <span className="ml-2 text-xs font-normal text-gray-400 font-mono">
                    (V: {INDICATOR_START + idx})
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={val === 0 ? '' : val}
                    onChange={(e) => handleValueChange(idx, e.target.value)}
                    placeholder="0"
                    className="w-full bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-300 font-mono text-lg text-gray-800"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                    %
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-blue-50/50 p-5 rounded-xl border border-blue-100 text-sm text-blue-800">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <AlertCircle size={16} /> 设备参数说明
          </p>
          <ul className="list-disc ml-5 space-y-1 text-blue-700/80">
            <li>该页面设置将被立刻下发至终端（PLC 地址 <code>VD200</code> 至 <code>VD244</code>）。</li>
            <li>开度控制数值范围以当前设备固件配置下限为准（通常在 0 ~ 100 之间）。</li>
            <li>确保您知晓操作意图后再进行**保存配置**，保存操作将遍历 12 次 MQTT 推送覆盖全天候。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
