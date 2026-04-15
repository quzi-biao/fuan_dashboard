'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, CheckCircle2, Send } from 'lucide-react';

const INDICATOR_START = 1104;

export default function ValveSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  
  const [targetValues, setTargetValues] = useState<number[]>(Array(12).fill(0));
  const [actualValues, setActualValues] = useState<number[]>(Array(12).fill(0));
  
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // 用于让 setInterval 能访问到最新的 targetValues 避免被 useEffect 闭包卡死
  const targetValuesRef = useRef(targetValues);
  useEffect(() => {
    targetValuesRef.current = targetValues;
  }, [targetValues]);

  const fetchSettings = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch('/api/valve-settings');
      const result = await res.json();
      if (result.success && result.data) {
        // 初次加载时，才用后端的 target 也就是数据库查出来的值，覆写输入框
        // 否则后续轮询期间不要轻易覆写，以免打断用户的输入流
        if (isInitial) {
          setTargetValues(result.data.targetValues || Array(12).fill(0));
        }
        setActualValues(result.data.actualValues || Array(12).fill(0));
      } else if (isInitial) {
        setMessage({ type: 'error', text: result.error || '获取数据失败' });
      }
    } catch (error) {
      console.error(error);
      if (isInitial) {
        setMessage({ type: 'error', text: '请求网络错误，无法加载当前开度数据' });
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    // 首次获取
    fetchSettings(true);
    
    // 定时轮询，每10秒更新一次（仅静默更新真机实际值 actualValues）
    const interval = setInterval(() => {
      fetchSettings(false);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const handleValueChange = (index: number, val: string) => {
    const num = Number(val);
    const newValues = [...targetValues];
    newValues[index] = isNaN(num) ? 0 : num;
    setTargetValues(newValues);
  };

  const handlePublish = async (index: number) => {
    try {
      setSavingIndex(index);
      setMessage(null);

      const res = await fetch('/api/valve-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index, value: targetValues[index] }),
      });
      const result = await res.json();

      if (result.success) {
        setMessage({ type: 'success', text: `时段 ${index + 1} (VD${200 + index * 4}) 开度下发并且存入数据库成功！` });
        setTimeout(() => setMessage(null), 3000); // 成功后3秒通知消失
        // 发送完立即主动抓一次实际值以期加速状态更新
        fetchSettings(false);
      } else {
        setMessage({ type: 'error', text: result.error || '下发发布失败' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: '请求下发失败，请检查网络或服务端日志' });
    } finally {
      setSavingIndex(null);
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
              <p className="text-sm text-gray-500 mt-1">控制周期阀门开闭参数，支持按需独立发布并将配置值记录至数据库中永久存储。</p>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* 核心设定区块 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {targetValues.map((val, idx) => {
              const actualMatch = val === actualValues[idx];
              
              return (
                <div key={idx} className="flex flex-col p-4 bg-gray-50/50 rounded-xl border border-gray-100 hover:border-blue-200 transition-all shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-base font-bold text-gray-800">
                      时段 {idx + 1}
                    </label>
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-mono rounded-md font-semibold">
                      VD{200 + idx * 4}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      {/* 在类名中使用了 pr-10 避免原生光标内容挤到 % 的绝对定位下 */}
                      <input
                        type="number"
                        value={val === 0 && !actualMatch ? '' : val}
                        onChange={(e) => handleValueChange(idx, e.target.value)}
                        placeholder="0"
                        className="w-full bg-white rounded-lg pl-4 pr-10 py-2.5 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-300 font-mono text-lg text-gray-800"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                        %
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handlePublish(idx)}
                      disabled={savingIndex !== null}
                      className="flex-shrink-0 flex items-center justify-center w-12 h-[46px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      title="发布此配置"
                    >
                      {savingIndex === idx ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                  
                  <div className="mt-2 text-sm flex justify-between font-medium">
                    <span className={actualMatch ? "text-green-600" : "text-red-500"}>
                      实际值(InfluxDB): {actualValues[idx]}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 bg-blue-50/50 p-5 rounded-xl border border-blue-100 text-sm text-blue-800">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <AlertCircle size={16} /> 设备参数说明
          </p>
          <ul className="list-disc ml-5 space-y-1 text-blue-700/80">
            <li>输入框显示的为您在控制台保存过的<strong>目标开度配置</strong>（来源于 MySQL 数据库的固有记录）。</li>
            <li>表单下方跟随刷新的数值为<strong>实际回传开度</strong>（每 10 秒读取一次机器通过 MQTT 退回 InfluxDB 时序库的数据）。</li>
            <li>绿色代表目前终端已接纳最新设定并运作在此水平线，红色代表终端暂未响应新数值或正处于机器的响应延迟中。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
