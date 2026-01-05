/**
 * 流量数据分时段分析表格组件
 */
'use client';

import React from 'react';

interface FlowAnalysisData {
  date: string;
  period: string;
  period_name: string;
  chengdong_avg_flow: number;
  yanhu_avg_flow: number;
  chengdong_cumulative_flow: number;
  yanhu_cumulative_flow: number;
  yanhu_electricity: number;
  total_cumulative_flow: number;
  is_total?: boolean;
}

interface Props {
  data: FlowAnalysisData[];
}

export function FlowAnalysisTable({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">暂无数据</div>;
  }

  // 按日期分组
  const groupedByDate = data.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = [];
    }
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, FlowAnalysisData[]>);

  // 按日期降序排序（最新日期在上）
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              日期
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              时段
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              城东流量(m³)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              岩湖电量(kWh)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              岩湖流量(m³)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              总供水量(m³)
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedDates.map((date, dateIndex) => {
            const items = groupedByDate[date];
            return (
            <React.Fragment key={date}>
              {items.map((item, idx) => (
                <tr 
                  key={`${date}-${item.period}`} 
                  className={`${dateIndex % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-blue-50 transition-colors`}
                >
                  {idx === 0 && (
                    <td
                      rowSpan={items.length}
                      className={`px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r ${
                        dateIndex % 2 === 0 ? 'bg-white' : 'bg-gray-100'
                      }`}
                    >
                      {date}
                    </td>
                  )}
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-900 ${item.is_total ? 'font-bold' : ''}`}>
                    {item.is_total ? (
                      <span className="px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-800">
                        {item.period_name}
                      </span>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.period === 'valley' ? 'bg-blue-100 text-blue-800' :
                        item.period === 'flat' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.period_name}电价
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 ${item.is_total ? 'font-bold' : ''}`}>
                    {item.chengdong_cumulative_flow.toFixed(1)}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 ${item.is_total ? 'font-bold' : ''}`}>
                    {item.yanhu_cumulative_flow.toFixed(1)}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 ${item.is_total ? 'font-bold' : ''}`}>
                    {item.yanhu_electricity.toFixed(1)}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 ${item.is_total ? 'font-bold' : 'font-medium'}`}>
                    {item.total_cumulative_flow.toFixed(1)}
                  </td>
                </tr>
              ))}
            </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
