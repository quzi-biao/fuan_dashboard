/**
 * 双重差分分析（DID）结果展示组件
 */
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface DIDResultsProps {
  result: {
    type: string;
    did_effect?: number;
    did_p_value?: number;
    pre_treatment_mean?: number;
    post_treatment_mean?: number;
    pre_control_mean?: number;
    post_control_mean?: number;
    treatment_trend?: Array<{ date: string; value: number; group: string; period: string }>;
    parallel_trend_test?: { p_value: number; passed: boolean };
  };
  yField: string;
  interventionDate: string;
  getFieldLabel: (field: string) => string;
}

export function DIDResults({ result, yField, interventionDate, getFieldLabel }: DIDResultsProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">双重差分分析结果</h2>
      </div>

      {/* DID统计指标 */}
      {result.did_effect !== undefined && (
        <div className="space-y-6 mb-6">
          {/* 主要效应指标 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-700 font-medium">DID 效应值</div>
              <div className="text-2xl font-bold text-blue-700">
                {result.did_effect.toFixed(4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {result.did_effect > 0 ? '✓ 正向影响' : '✗ 负向影响'}
              </div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-700 font-medium">显著性 (p-value)</div>
              <div className="text-2xl font-bold text-green-700">
                {result.did_p_value?.toFixed(4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {(result.did_p_value ?? 1) < 0.05 ? '✓ 显著 (p<0.05)' : '⚠ 不显著'}
              </div>
            </div>
          </div>
          
          {/* 四组均值 */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">各组均值对比</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg border-2 border-blue-200">
                <div className="text-xs text-gray-600 mb-1">干预前 - 处理组</div>
                <div className="text-lg font-bold text-gray-900">
                  {result.pre_treatment_mean?.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-400">
                <div className="text-xs text-gray-600 mb-1">干预后 - 处理组</div>
                <div className="text-lg font-bold text-blue-700">
                  {result.post_treatment_mean?.toFixed(2)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  变化: {((result.post_treatment_mean ?? 0) - (result.pre_treatment_mean ?? 0)).toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border-2 border-green-200">
                <div className="text-xs text-gray-600 mb-1">干预前 - 对照组</div>
                <div className="text-lg font-bold text-gray-900">
                  {result.pre_control_mean?.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border-2 border-green-400">
                <div className="text-xs text-gray-600 mb-1">干预后 - 对照组</div>
                <div className="text-lg font-bold text-green-700">
                  {result.post_control_mean?.toFixed(2)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  变化: {((result.post_control_mean ?? 0) - (result.pre_control_mean ?? 0)).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* DID效应计算说明 */}
          <div className="p-4 bg-indigo-50 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-2">DID 效应计算</div>
            <div className="text-xs text-gray-700 space-y-1">
              <div>处理组变化 = {((result.post_treatment_mean ?? 0) - (result.pre_treatment_mean ?? 0)).toFixed(2)}</div>
              <div>对照组变化 = {((result.post_control_mean ?? 0) - (result.pre_control_mean ?? 0)).toFixed(2)}</div>
              <div className="font-bold text-indigo-700 pt-1 border-t border-indigo-200">
                DID 效应 = 处理组变化 - 对照组变化 = {result.did_effect.toFixed(4)}
              </div>
            </div>
          </div>

          {/* 平行趋势检验 */}
          {result.parallel_trend_test && (
            <div className={`p-4 rounded-lg ${result.parallel_trend_test.passed ? 'bg-green-50 border-2 border-green-300' : 'bg-yellow-50 border-2 border-yellow-300'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">平行趋势检验</div>
                  <div className="text-xs text-gray-600 mt-1">
                    p-value: {result.parallel_trend_test.p_value.toFixed(4)}
                  </div>
                </div>
                <div className={`text-2xl ${result.parallel_trend_test.passed ? 'text-green-600' : 'text-yellow-600'}`}>
                  {result.parallel_trend_test.passed ? '✓' : '⚠'}
                </div>
              </div>
              <div className="text-xs text-gray-700 mt-2">
                {result.parallel_trend_test.passed 
                  ? '✓ 通过检验 - 满足平行趋势假设，DID结果可信' 
                  : '⚠ 未通过检验 - 不满足平行趋势假设，需谨慎解释结果'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 趋势对比图 */}
      {result.treatment_trend && result.treatment_trend.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">处理组与对照组趋势对比</h3>
          <ResponsiveContainer width="100%" height={500}>
            <LineChart
              data={result.treatment_trend}
              margin={{ top: 20, right: 30, bottom: 80, left: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                label={{ value: '日期', position: 'insideBottom', offset: -15, fill: '#374151', fontSize: 14 }}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                stroke="#9ca3af"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                label={{ value: getFieldLabel(yField), angle: -90, position: 'insideLeft', offset: -10, fill: '#374151', fontSize: 14 }}
                tick={{ fill: '#6b7280' }}
                stroke="#9ca3af"
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                labelStyle={{ color: '#374151' }}
              />
              <Legend wrapperStyle={{ color: '#374151', paddingTop: '30px' }} />
              <ReferenceLine 
                x={interventionDate} 
                stroke="#ef4444" 
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{ value: '干预时点', position: 'top', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#3b82f6' }}
                name="处理组"
                data={result.treatment_trend.filter(d => d.group === 'treatment')}
                isAnimationActive={false}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#10b981" 
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#10b981' }}
                name="对照组"
                data={result.treatment_trend.filter(d => d.group === 'control')}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          
          <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
            <strong>图表说明：</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>蓝色线表示处理组（受干预影响的组）的趋势</li>
              <li>绿色线表示对照组（未受干预影响的组）的趋势</li>
              <li>红色虚线标记干预实施的时间点</li>
              <li>理想情况下，干预前两组应保持平行趋势，干预后处理组出现明显变化</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
