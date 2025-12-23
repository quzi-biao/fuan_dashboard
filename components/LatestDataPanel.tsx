/**
 * 最新数据面板组件
 * 显示最新一条数据的关键指标
 */
'use client';

import { Droplets, Gauge, Zap, Activity } from 'lucide-react';

interface LatestData {
  collect_time: string;
  chengdong_flow: number;
  yanhu_flow: number;
  yanhu_pressure: number;
  yanhu_daily_water: number;
  yanhu_daily_power: number;
}

interface Props {
  data: LatestData | null;
}

export function LatestDataPanel({ data }: Props) {
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-gray-500">暂无数据</div>
      </div>
    );
  }

  const collectTime = new Date(data.collect_time).toLocaleString('zh-CN');

  const cards = [
    {
      title: '城东流量',
      value: data.chengdong_flow.toFixed(2),
      unit: 'm³/h',
      icon: Droplets,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: '岩湖流量',
      value: data.yanhu_flow.toFixed(2),
      unit: 'm³/h',
      icon: Droplets,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50'
    },
    {
      title: '岩湖压力',
      value: data.yanhu_pressure.toFixed(3),
      unit: 'MPa',
      icon: Gauge,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: '日供水量',
      value: data.yanhu_daily_water.toFixed(0),
      unit: 'm³',
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: '日耗电量',
      value: data.yanhu_daily_power.toFixed(0),
      unit: 'kWh',
      icon: Zap,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">实时数据</h2>
        <div className="text-sm text-gray-500">
          更新时间: {collectTime}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className={`${card.bgColor} rounded-lg p-4 transition hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">
                  {card.title}
                </span>
                <Icon className={`${card.color} w-5 h-5`} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${card.color}`}>
                  {card.value}
                </span>
                <span className="text-sm text-gray-500">{card.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
