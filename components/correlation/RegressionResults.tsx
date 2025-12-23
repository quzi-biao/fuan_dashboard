/**
 * 回归分析结果展示组件（多项式回归和神经网络回归）
 */
'use client';

import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine
} from 'recharts';

interface RegressionResultsProps {
  result: {
    type: string;
    r2_train?: number;
    r2_test?: number;
    mse_train?: number;
    mse_test?: number;
    equation?: string;
    time_series_data?: Array<{ x: number; y_actual: number; y_predicted: number }>;
    is_single_variable?: boolean;
    scatter_data?: Array<{ actual: number; predicted: number }>;
    residuals_data?: Array<{ predicted: number; residual: number }>;
    feature_importance?: Record<string, number>;
  };
  xFields: string[];
  yField: string;
  getFieldLabel: (field: string) => string;
}

export function RegressionResults({ result, xFields, yField, getFieldLabel }: RegressionResultsProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">分析结果</h2>
      </div>

      {/* 统计指标 */}
      {result.r2_train !== undefined && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <div className="text-sm text-gray-700 font-medium">训练集 R²</div>
              <div className="text-2xl font-bold text-blue-700">
                {result.r2_train.toFixed(4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {result.r2_train > 0.9 ? '✓ 优秀' : result.r2_train > 0.7 ? '✓ 良好' : result.r2_train > 0.5 ? '△ 一般' : '✗ 较差'}
              </div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <div className="text-sm text-gray-700 font-medium">测试集 R²</div>
              <div className="text-2xl font-bold text-green-700">
                {result.r2_test?.toFixed(4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {(result.r2_test ?? 0) > 0.9 ? '✓ 优秀' : (result.r2_test ?? 0) > 0.7 ? '✓ 良好' : (result.r2_test ?? 0) > 0.5 ? '△ 一般' : '✗ 较差'}
              </div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-sm text-gray-700 font-medium">训练集 MSE</div>
              <div className="text-2xl font-bold text-orange-700">
                {result.mse_train?.toFixed(4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">越小越好</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-700 font-medium">测试集 MSE</div>
              <div className="text-2xl font-bold text-purple-700">
                {result.mse_test?.toFixed(4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">越小越好</div>
            </div>
          </div>
          
          {/* R²和MSE说明 */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
            <div className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span className="text-blue-600">📊</span>
              <span>评价指标说明</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-700">
              <div>
                <div className="font-semibold text-blue-700 mb-1">R² (决定系数)</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>范围</strong>: 0 ~ 1（越接近1越好）</li>
                  <li><strong>含义</strong>: 模型解释了多少数据变异</li>
                  <li><strong>评价</strong>:
                    <div className="ml-4 mt-1">
                      <div>• R² &gt; 0.9: 优秀拟合</div>
                      <div>• 0.7 &lt; R² ≤ 0.9: 良好拟合</div>
                      <div>• 0.5 &lt; R² ≤ 0.7: 一般拟合</div>
                      <div>• R² ≤ 0.5: 较差拟合</div>
                    </div>
                  </li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-orange-700 mb-1">MSE (均方误差)</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>范围</strong>: 0 ~ ∞（越接近0越好）</li>
                  <li><strong>含义</strong>: 预测值与实际值的平均偏差</li>
                  <li><strong>特点</strong>: 对大误差更敏感</li>
                  <li><strong>注意</strong>: 训练集和测试集MSE不应相差太大，否则可能过拟合</li>
                </ul>
              </div>
            </div>
            {result.r2_train - (result.r2_test ?? 0) > 0.1 && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
                ⚠️ <strong>提示</strong>: 训练集和测试集R²差异较大 ({(result.r2_train - (result.r2_test ?? 0)).toFixed(3)})，可能存在过拟合。建议调整模型参数或增加数据量。
              </div>
            )}
          </div>
        </>
      )}

      {/* 回归方程 */}
      {result.equation && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
          <div className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-blue-600">📐</span>
            <span>回归方程</span>
          </div>
          <div className="font-mono text-base text-gray-900 bg-white p-3 rounded border border-blue-100">
            {result.equation}
          </div>
          <div className="mt-3 text-xs text-gray-600">
            <div className="font-medium mb-1">变量说明：</div>
            <div className="space-y-1">
              <div>• y = {getFieldLabel(yField)}</div>
              {xFields.map((field, idx) => (
                <div key={idx}>• x{idx + 1} = {getFieldLabel(field)}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 图表展示 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 单变量时显示原始曲线和回归曲线对比 */}
        {result.is_single_variable && result.time_series_data && result.time_series_data.length > 0 && (
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold mb-3 text-gray-900">原始数据与回归曲线对比</h3>
            <ResponsiveContainer width="100%" height={500}>
              <LineChart
                data={result.time_series_data}
                margin={{ top: 20, right: 30, bottom: 50, left: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="x" 
                  name={xFields[0]}
                  label={{ value: getFieldLabel(xFields[0]), position: 'insideBottom', offset: -15, fill: '#374151', fontSize: 14 }}
                  tick={{ fill: '#6b7280' }}
                  stroke="#9ca3af"
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
                <Line 
                  type="monotone" 
                  dataKey="y_actual" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3b82f6' }}
                  name="实际值"
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="y_predicted" 
                  stroke="#ef4444" 
                  strokeWidth={1.5}
                  dot={false}
                  name="回归曲线"
                  strokeDasharray="5 5"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* 预测值 vs 实际值 */}
        {result.scatter_data && result.scatter_data.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-900">预测值 vs 实际值</h3>
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  type="number" 
                  dataKey="actual" 
                  name="实际值"
                  label={{ value: '实际值', position: 'insideBottom', offset: -15, fill: '#374151', fontSize: 14 }}
                  tick={{ fill: '#6b7280' }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  type="number" 
                  dataKey="predicted" 
                  name="预测值"
                  label={{ value: '预测值', angle: -90, position: 'insideLeft', offset: -10, fill: '#374151', fontSize: 14 }}
                  tick={{ fill: '#6b7280' }}
                  stroke="#9ca3af"
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                  labelStyle={{ color: '#374151' }}
                />
                <Legend wrapperStyle={{ color: '#374151', paddingTop: '30px' }} />
                <Scatter name="数据点" data={result.scatter_data} fill="#3b82f6" />
                <ReferenceLine 
                  stroke="#ef4444" 
                  strokeDasharray="3 3"
                  segment={[
                    { x: Math.min(...result.scatter_data.map(d => d.actual)), y: Math.min(...result.scatter_data.map(d => d.actual)) },
                    { x: Math.max(...result.scatter_data.map(d => d.actual)), y: Math.max(...result.scatter_data.map(d => d.actual)) }
                  ]}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 残差分析 */}
        {result.residuals_data && result.residuals_data.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-900">残差分析</h3>
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  type="number" 
                  dataKey="predicted" 
                  name="预测值"
                  label={{ value: '预测值', position: 'insideBottom', offset: -15, fill: '#374151', fontSize: 14 }}
                  tick={{ fill: '#6b7280' }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  type="number" 
                  dataKey="residual" 
                  name="残差"
                  label={{ value: '残差', angle: -90, position: 'insideLeft', offset: -10, fill: '#374151', fontSize: 14 }}
                  tick={{ fill: '#6b7280' }}
                  stroke="#9ca3af"
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                  labelStyle={{ color: '#374151' }}
                />
                <Legend wrapperStyle={{ color: '#374151', paddingTop: '30px' }} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                <Scatter name="残差" data={result.residuals_data} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 特征重要性 */}
        {result.feature_importance && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-900">特征重要性</h3>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart
                data={Object.entries(result.feature_importance).map(([name, value]) => ({
                  name: getFieldLabel(name),
                  importance: value
                }))}
                margin={{ top: 20, right: 30, bottom: 50, left: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#6b7280' }}
                  stroke="#9ca3af"
                  label={{ value: '变量', position: 'insideBottom', offset: -15, fill: '#374151', fontSize: 14 }}
                />
                <YAxis 
                  tick={{ fill: '#6b7280' }}
                  stroke="#9ca3af"
                  label={{ value: '重要性', angle: -90, position: 'insideLeft', offset: -10, fill: '#374151', fontSize: 14 }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                  labelStyle={{ color: '#374151' }}
                />
                <Legend wrapperStyle={{ color: '#374151', paddingTop: '30px' }} />
                <Bar dataKey="importance" fill="#8b5cf6" name="重要性" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
