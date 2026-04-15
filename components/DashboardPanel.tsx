/**
 * 运行看板容器组件
 * 使用 Tab 切换不同的运行分析看板，右侧含日期前/后导航
 */
'use client';

import React, { useState } from 'react';
import { JointSupplyDashboard } from './JointSupplyDashboard';
import { ChengdongDispatchDashboard } from './ChengdongDispatchDashboard';
import { YanhuDispatchDashboard } from './YanhuDispatchDashboard';
import { BarChart2, Activity, Gauge, ChevronLeft, ChevronRight } from 'lucide-react';

// ---- 日期工具 ----
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplay(dateStr: string): string {
  const [, m, day] = dateStr.split('-');
  return `${Number(m)}月${Number(day)}日`;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

// 默认前天
function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return toDateStr(d);
}

export function DashboardPanel() {
  const [activeTab, setActiveTab] = useState<'joint-supply' | 'chengdong-dispatch' | 'yanhu-dispatch'>('joint-supply');
  const [selectedDate, setSelectedDate] = useState<string>(getYesterday());

  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toDateStr(d); })();
  const isNextDisabled = selectedDate >= yesterday; // 最多只能到昨天

  const TABS = [
    {
      id: 'joint-supply' as const,
      label: '福安城东-岩湖联合供水运行监控分析',
      shortLabel: '联合供水监控',
      icon: <BarChart2 size={15} />,
    },
    {
      id: 'chengdong-dispatch' as const,
      label: '福安城东水厂智能错峰调度运行分析',
      shortLabel: '城东错峰调度',
      icon: <Activity size={15} />,
    },
    {
      id: 'yanhu-dispatch' as const,
      label: '福安岩湖水厂二级泵房高效节能智能调度运行分析',
      shortLabel: '岩湖泵房调度',
      icon: <Gauge size={15} />,
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      {/* 标题栏 */}
      <div className="border-b border-gray-200 px-4 sm:px-6 pt-4">
        <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3">运行看板</h2>

        {/* Tab + 日期导航 同一行 */}
        <div className="flex items-end justify-between gap-2">
          {/* Tab 切换 */}
          <div className="flex gap-1 overflow-x-auto pb-px flex-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-t-lg text-sm font-medium
                    whitespace-nowrap border-b-2 transition-all duration-200
                    ${
                      isActive
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  {tab.icon}
                  <span className="hidden md:inline">{tab.label}</span>
                  <span className="md:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* 日期导航：[<] 4月14日 [>] */}
          <div className="flex items-center gap-1 pb-1 shrink-0">
            <button
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title="前一天"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[56px] text-center select-none">
              {formatDisplay(selectedDate)}
            </span>
            <button
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              disabled={isNextDisabled}
              className={`p-1 rounded transition-colors ${
                isNextDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="后一天"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 看板内容（key 确保日期切换时触发重新加载） */}
      <div className="p-4 sm:p-6">
        {activeTab === 'joint-supply' && (
          <JointSupplyDashboard key={selectedDate} date={selectedDate} />
        )}
        {activeTab === 'chengdong-dispatch' && (
          <ChengdongDispatchDashboard key={selectedDate} date={selectedDate} />
        )}
        {activeTab === 'yanhu-dispatch' && (
          <YanhuDispatchDashboard key={selectedDate} date={selectedDate} />
        )}
      </div>
    </div>
  );
}
