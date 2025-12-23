/**
 * 岩湖水厂能效分析表格组件
 */
'use client';

interface EfficiencyAnalysisData {
  date: string;
  pressure_simple_avg: number;
  pressure_weighted_avg: number;
  pressure_max: number;
  pressure_min: number;
  daily_water_supply: number;
  daily_power_consumption: number;
  power_per_1000t: number;
  power_per_pressure: number;
}

interface Props {
  data: EfficiencyAnalysisData[];
}

export function EfficiencyAnalysisTable({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">暂无数据</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              日期
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              压力简单均值(MPa)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              压力加权均值(MPa)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              日供水量(m³)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              日耗电量(kWh)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              千吨水电耗
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              能效比
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.date} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                {item.date}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                {item.pressure_simple_avg.toFixed(4)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                {item.pressure_weighted_avg.toFixed(4)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                {item.daily_water_supply > 0 ? item.daily_water_supply.toFixed(0) : '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                {item.daily_power_consumption > 0 ? item.daily_power_consumption.toFixed(0) : '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                {item.power_per_1000t > 0 ? item.power_per_1000t.toFixed(3) : '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                {item.power_per_pressure > 0 ? item.power_per_pressure.toFixed(3) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
