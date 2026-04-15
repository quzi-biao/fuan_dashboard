/**
 * 福安城东-岩湖联合供水运行监控分析看板
 * 核心图表：分时段堆叠柱状图（城东 + 岩湖），横轴标注高低峰时段
 */
'use client';

import React, { useEffect, useState } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceArea, ResponsiveContainer,
} from 'recharts';

interface HourlyData {
  hour: number;
  label: string;
  chengdong_supply: number;
  yanhu_supply: number;
  total_supply: number;
  period: string;
  period_name: string;
}

interface PeriodSummary {
  period: string;
  period_name: string;
  chengdong_total: number;
  yanhu_total: number;
  total: number;
}

interface ApiData {
  success: boolean;
  date: string;
  hourly: HourlyData[];
  period_summary: PeriodSummary[];
}

// 时段背景颜色
const PERIOD_BG: Record<string, string> = {
  valley: '#fef9c3',
  flat: '#dcfce7',
  peak: '#fee2e2',
};

const PERIOD_COLORS: Record<string, string> = {
  valley: '#a16207',
  flat: '#15803d',
  peak: '#b91c1c',
};

// 时段名称
const PERIOD_LABEL_MAP: Record<string, string> = {
  valley: '谷电',
  flat: '平电',
  peak: '峰电',
};

// ReferenceArea 时段区间 (数值型 x 轴使用小时数)
const PERIOD_AREAS = [
  { x1: -0.5, x2: 7.5, fill: '#fef9c3', period: 'valley' },
  { x1: 7.5, x2: 9.5, fill: '#dcfce7', period: 'flat' },
  { x1: 9.5, x2: 11.5, fill: '#fee2e2', period: 'peak' },
  { x1: 11.5, x2: 14.5, fill: '#dcfce7', period: 'flat' },
  { x1: 14.5, x2: 19.5, fill: '#fee2e2', period: 'peak' },
  { x1: 19.5, x2: 20.5, fill: '#dcfce7', period: 'flat' },
  { x1: 20.5, x2: 21.5, fill: '#fee2e2', period: 'peak' },
  { x1: 21.5, x2: 23.5, fill: '#dcfce7', period: 'flat' },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const chengdong = payload.find((p: any) => p.dataKey === 'chengdong_supply');
  const yanhu = payload.find((p: any) => p.dataKey === 'yanhu_supply');
  const total = (chengdong?.value || 0) + (yanhu?.value || 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}:00</p>
      {chengdong && (
        <div className="flex items-center gap-2 text-blue-700">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#4f86c6' }} />
          城东：<strong>{chengdong.value.toLocaleString()}</strong> m³/h
        </div>
      )}
      {yanhu && (
        <div className="flex items-center gap-2 text-orange-600 mt-1">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#f5a442' }} />
          岩湖：<strong>{yanhu.value.toLocaleString()}</strong> m³/h
        </div>
      )}
      <div className="mt-1 pt-1 border-t border-gray-100 text-gray-600">
        合计：<strong>{total.toLocaleString()}</strong> m³/h
      </div>
    </div>
  );
}

export function JointSupplyDashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/joint-supply')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json);
        else setError(json.error || '加载失败');
      })
      .catch(() => setError('网络请求失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
        加载中...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">{error || '暂无数据'}</div>
    );
  }

  const { hourly, period_summary, date } = data;
  const hasData = hourly.some((h) => h.total_supply > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        暂无 {date} 的供水数据
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 日期标注 */}
      <div className="text-sm text-gray-500">
        分析日期：<span className="font-medium text-gray-700">{date}</span>（昨日数据）
      </div>

      {/* 时段汇总小卡片 */}
      <div className="grid grid-cols-3 gap-3">
        {period_summary.map((ps) => (
          <div
            key={ps.period}
            className="rounded-xl p-3 border"
            style={{ background: PERIOD_BG[ps.period] + 'cc', borderColor: PERIOD_BG[ps.period] }}
          >
            <div className="text-xs font-bold mb-1.5" style={{ color: PERIOD_COLORS[ps.period] }}>
              {PERIOD_LABEL_MAP[ps.period]}期
            </div>
            <div className="space-y-0.5 text-xs text-gray-700">
              <div>城东：<span className="font-semibold">{ps.chengdong_total.toLocaleString()}</span></div>
              <div>岩湖：<span className="font-semibold">{ps.yanhu_total.toLocaleString()}</span></div>
              <div className="pt-1 font-bold text-gray-800 border-t border-gray-200">
                合计：{ps.total.toLocaleString()} m³/h
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 柱状图：城东+岩湖堆叠，横轴为小时，背景区分高低峰 */}
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth: 640 }}>
          <ResponsiveContainer width="100%" height={500}>
            <ComposedChart
              data={hourly}
              margin={{ top: 10, right: 20, bottom: 40, left: 70 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />

              {/* 时段背景 */}
              {PERIOD_AREAS.map((area, i) => (
                <ReferenceArea
                  key={i}
                  x1={area.x1}
                  x2={area.x2}
                  fill={area.fill}
                  fillOpacity={0.65}
                  strokeOpacity={0}
                  yAxisId="left"
                />
              ))}

              <XAxis
                dataKey="hour"
                type="number"
                domain={[-0.5, 23.5]}
                ticks={Array.from({ length: 24 }, (_, i) => i)}
                tickFormatter={(v) => `${v}:00`}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                label={{
                  value: '供水量 (m³/h)',
                  angle: -90,
                  position: 'insideLeft',
                  dx: -50,
                  fontSize: 11,
                  fill: '#6b7280',
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={32}
                formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
              />

              <Bar
                yAxisId="left"
                dataKey="chengdong_supply"
                name="城东送水量"
                stackId="supply"
                fill="#4f86c6"
                barSize={28}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="yanhu_supply"
                name="岩湖送水量"
                stackId="supply"
                fill="#f5a442"
                barSize={28}
                radius={[2, 2, 0, 0]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 时段图例说明 */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 justify-center">
        {[
          { color: '#fef9c3', border: '#ca8a04', label: '谷电（0:00-8:00）' },
          { color: '#dcfce7', border: '#16a34a', label: '平电（8-10, 12-15, 20-21, 22-24时）' },
          { color: '#fee2e2', border: '#dc2626', label: '峰电（10-12, 15-20, 21-22时）' },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span
              className="inline-block w-6 h-3 rounded"
              style={{ background: item.color, border: `1px solid ${item.border}` }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {/* 分时数据表格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200" style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 text-gray-800">
              <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold">时间</th>
              <th className="border-b border-gray-200 px-3 py-2 text-center font-semibold">时段</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-semibold">城东 (m³/h)</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-semibold">岩湖 (m³/h)</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-semibold">合计 (m³/h)</th>
            </tr>
          </thead>
          <tbody>
            {hourly.map((row) => (
              <tr
                key={row.hour}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="px-3 py-1.5 text-gray-800">{row.label}</td>
                <td className="px-3 py-1.5 text-center">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                    style={{
                      background: PERIOD_BG[row.period],
                      color: PERIOD_COLORS[row.period],
                    }}
                  >
                    {row.period_name}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right text-gray-800">{row.chengdong_supply.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right text-gray-800">{row.yanhu_supply.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-gray-900">{row.total_supply.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300 text-gray-800">
              <td className="px-3 py-2" colSpan={2}>全天合计</td>
              <td className="px-3 py-2 text-right">
                {hourly.reduce((s, h) => s + h.chengdong_supply, 0).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right">
                {hourly.reduce((s, h) => s + h.yanhu_supply, 0).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right">
                {hourly.reduce((s, h) => s + h.total_supply, 0).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
