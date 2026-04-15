/**
 * 运行看板容器组件
 * 使用 Tab 切换不同的运行分析看板
 */
'use client';

import React, { useState } from 'react';
import { JointSupplyDashboard } from './JointSupplyDashboard';
import { ChengdongDispatchDashboard } from './ChengdongDispatchDashboard';
import { BarChart2, Activity } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: 'joint-supply',
    label: '福安城东-岩湖联合供水运行监控分析',
    shortLabel: '联合供水监控',
    icon: <BarChart2 size={15} />,
    component: <JointSupplyDashboard />,
  },
  {
    id: 'chengdong-dispatch',
    label: '福安城东水厂智能错峰调度运行分析',
    shortLabel: '城东错峰调度',
    icon: <Activity size={15} />,
    component: <ChengdongDispatchDashboard />,
  },
];

export function DashboardPanel() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  const current = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      {/* 标题栏 */}
      <div className="border-b border-gray-200 px-4 sm:px-6 pt-4">
        <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3">运行看板</h2>

        {/* Tab 切换 */}
        <div className="flex gap-1 overflow-x-auto pb-px">
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
                {/* 桌面端显示完整标题，移动端显示短标题 */}
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 看板内容 */}
      <div className="p-4 sm:p-6">{current.component}</div>
    </div>
  );
}
