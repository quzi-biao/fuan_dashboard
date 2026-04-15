'use client';

import { X } from 'lucide-react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

interface FlowRecord {
  date: string;
  period: string;
  is_total?: boolean;
  chengdong_cumulative_flow: number;
  yanhu_cumulative_flow: number;
  yanhu_electricity: number;
}

interface Props {
  data: FlowRecord[];
  onClose: () => void;
}

// 谷/平/峰 三色方案（三组各一套，深浅略有区分）
const C = {
  cd: { valley: '#6ee7b7', flat: '#fcd34d', peak: '#f87171' }, // 城东流量
  yh: { valley: '#34d399', flat: '#f59e0b', peak: '#ef4444' }, // 岩湖流量
  elec: { valley: '#bfdbfe', flat: '#60a5fa', peak: '#2563eb' }, // 岩湖电量（蓝色系）
};

const LEGEND_LABELS: Record<string, string> = {
  cd_valley: '城东流量·谷', cd_flat: '城东流量·平', cd_peak: '城东流量·峰',
  yh_valley: '岩湖流量·谷', yh_flat: '岩湖流量·平', yh_peak: '岩湖流量·峰',
  elec_valley: '岩湖电量·谷', elec_flat: '岩湖电量·平', elec_peak: '岩湖电量·峰',
};

export function FlowPeriodChartModal({ data, onClose }: Props) {
  const rows = data.filter(d => !d.is_total && d.period !== 'total');
  const dates = [...new Set(rows.map(d => d.date))];

  const chartData = dates.map(date => {
    const get = (p: string) => rows.find(d => d.date === date && d.period === p);
    const v = get('valley'), f = get('flat'), k = get('peak');
    return {
      date: date.slice(5),
      cd_valley: +(v?.chengdong_cumulative_flow ?? 0).toFixed(0),
      cd_flat: +(f?.chengdong_cumulative_flow ?? 0).toFixed(0),
      cd_peak: +(k?.chengdong_cumulative_flow ?? 0).toFixed(0),
      yh_valley: +(v?.yanhu_cumulative_flow ?? 0).toFixed(0),
      yh_flat:   +(f?.yanhu_cumulative_flow ?? 0).toFixed(0),
      yh_peak:   +(k?.yanhu_cumulative_flow ?? 0).toFixed(0),
      elec_valley: +(v?.yanhu_electricity ?? 0).toFixed(0),
      elec_flat:   +(f?.yanhu_electricity ?? 0).toFixed(0),
      elec_peak:   +(k?.yanhu_electricity ?? 0).toFixed(0),
    };
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">日期分组三色堆叠柱状图</h2>
            <p className="text-xs text-gray-400 mt-0.5">城东流量 · 岩湖流量（左轴 m³）&nbsp;｜&nbsp;岩湖电量（右轴 kWh）</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* 图表区 */}
        <div className="p-6">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart data={chartData} barCategoryGap="22%" barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  label={{ value: '流量 (m³)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#9ca3af' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#2563eb' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  label={{ value: '电量 (kWh)', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 11, fill: '#2563eb' } }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
                  formatter={(val: number, name: string) => [
                    val.toLocaleString(),
                    LEGEND_LABELS[name] ?? name,
                  ]}
                />
                <Legend
                  formatter={(val: string) => LEGEND_LABELS[val] ?? val}
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                />

                {/* 城东流量（谷→平→峰 叠加） */}
                <Bar yAxisId="left" dataKey="cd_valley" stackId="cd" fill={C.cd.valley} name="cd_valley" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="left" dataKey="cd_flat" stackId="cd" fill={C.cd.flat} name="cd_flat" />
                <Bar yAxisId="left" dataKey="cd_peak" stackId="cd" fill={C.cd.peak} name="cd_peak" radius={[3, 3, 0, 0]} />

                {/* 岩湖流量 */}
                <Bar yAxisId="left" dataKey="yh_valley" stackId="yh" fill={C.yh.valley} name="yh_valley" />
                <Bar yAxisId="left" dataKey="yh_flat" stackId="yh" fill={C.yh.flat} name="yh_flat" />
                <Bar yAxisId="left" dataKey="yh_peak" stackId="yh" fill={C.yh.peak} name="yh_peak" radius={[3, 3, 0, 0]} />

                {/* 岩湖电量（右轴，淡色） */}
                <Bar yAxisId="right" dataKey="elec_valley" stackId="elec" fill={C.elec.valley} name="elec_valley" />
                <Bar yAxisId="right" dataKey="elec_flat" stackId="elec" fill={C.elec.flat} name="elec_flat" />
                <Bar yAxisId="right" dataKey="elec_peak" stackId="elec" fill={C.elec.peak} name="elec_peak" radius={[3, 3, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
