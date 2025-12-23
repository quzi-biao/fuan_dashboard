'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Download } from 'lucide-react';
import Link from 'next/link';
import { CustomDatePicker } from '@/components/CustomDatePicker';
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

interface AnalysisResult {
  type: string;
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  coefficients?: Record<string, number>;
  intercept?: number;
  feature_importance?: Record<string, number>;
  scatter_data?: Array<{ actual: number; predicted: number }>;
  residuals_data?: Array<{ predicted: number; residual: number }>;
  correlation_matrix?: Record<string, Record<string, number>>;
  equation?: string;
}

export default function CorrelationAnalysisPage() {
  const [xFields, setXFields] = useState<string[]>(['flow_out']);
  const [yField, setYField] = useState('pressure_out');
  const [analysisType, setAnalysisType] = useState<'polynomial' | 'neural_network'>('polynomial');
  const [polynomialDegree, setPolynomialDegree] = useState(2);
  const [hiddenLayers, setHiddenLayers] = useState('100,50');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableFields, setAvailableFields] = useState<string[]>([]);

  // 初始化日期范围（最近7天，不包含今天）
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sevenDaysAgo = new Date(yesterday);
    sevenDaysAgo.setDate(yesterday.getDate() - 6);
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    setEndDate(formatDate(yesterday));
    setStartDate(formatDate(sevenDaysAgo));
  }, []);

  // 获取可用字段列表
  useEffect(() => {
    async function fetchFields() {
      try {
        const response = await fetch('/api/correlation/fields');
        if (response.ok) {
          const data = await response.json();
          setAvailableFields(data.fields);
        }
      } catch (err) {
        console.error('获取字段列表失败:', err);
      }
    }
    fetchFields();
  }, []);

  // 添加自变量
  const addXField = () => {
    setXFields([...xFields, '']);
  };

  // 删除自变量
  const removeXField = (index: number) => {
    if (xFields.length > 1) {
      const newFields = xFields.filter((_, i) => i !== index);
      setXFields(newFields);
    }
  };

  // 更新自变量
  const updateXField = (index: number, value: string) => {
    const newFields = [...xFields];
    newFields[index] = value;
    setXFields(newFields);
  };

  // 执行分析
  const runAnalysis = async () => {
    if (!startDate || !endDate) {
      setError('请选择日期范围');
      return;
    }

    if (xFields.some(f => !f)) {
      setError('请选择所有自变量');
      return;
    }

    if (!yField) {
      setError('请选择因变量');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        x_fields: xFields.join(','),
        y_field: yField,
        start_date: startDate,
        end_date: endDate,
        analysis_type: analysisType,
      });

      if (analysisType === 'polynomial') {
        params.append('degree', polynomialDegree.toString());
      } else {
        params.append('hidden_layers', hiddenLayers);
      }

      const response = await fetch(`/api/correlation/analyze?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '分析失败');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 头部导航 */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:bg-gray-50 transition text-gray-900"
        >
          <ArrowLeft size={20} />
          <span>返回主页</span>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">关联分析</h1>
          <p className="text-gray-600 mt-1">分析水厂指标之间的关系</p>
        </div>
      </div>

      {/* 主内容区域：左右布局 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 配置面板 - 左侧，较窄 */}
        <div className="xl:col-span-3">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">分析配置</h2>
        
        {/* 自变量选择 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            自变量（Independent Variables）
          </label>
          {xFields.map((field, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <select
                value={field}
                onChange={(e) => updateXField(index, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="" className="text-gray-500">选择字段</option>
                {availableFields.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              {xFields.length > 1 && (
                <button
                  onClick={() => removeXField(index)}
                  className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  删除
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addXField}
            className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            + 添加自变量
          </button>
        </div>

        {/* 因变量选择 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            因变量（Dependent Variable）
          </label>
          <select
            value={yField}
            onChange={(e) => setYField(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          >
            <option value="" className="text-gray-500">选择字段</option>
            {availableFields.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* 分析类型 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            分析类型
          </label>
          <div className="flex gap-4">
            <label className="flex items-center text-gray-900">
              <input
                type="radio"
                value="polynomial"
                checked={analysisType === 'polynomial'}
                onChange={(e) => setAnalysisType(e.target.value as 'polynomial')}
                className="mr-2"
              />
              多项式回归
            </label>
            <label className="flex items-center text-gray-900">
              <input
                type="radio"
                value="neural_network"
                checked={analysisType === 'neural_network'}
                onChange={(e) => setAnalysisType(e.target.value as 'neural_network')}
                className="mr-2"
              />
              神经网络回归
            </label>
          </div>
        </div>

        {/* 多项式阶数 */}
        {analysisType === 'polynomial' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              多项式阶数
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={polynomialDegree}
              onChange={(e) => setPolynomialDegree(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>
        )}

        {/* 神经网络隐藏层 */}
        {analysisType === 'neural_network' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              隐藏层结构（用逗号分隔，如：100,50）
            </label>
            <input
              type="text"
              value={hiddenLayers}
              onChange={(e) => setHiddenLayers(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
              placeholder="100,50"
            />
          </div>
        )}

        {/* 日期范围 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            分析日期范围
          </label>
          <CustomDatePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onQuery={() => {}}
            maxDays={90}
            color="blue"
            cacheKey="correlationDateRange"
            hideButtons={true}
          />
        </div>

        {/* 执行按钮 */}
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>分析中...</span>
            </>
          ) : (
            <>
              <Play size={20} />
              <span>开始分析</span>
            </>
          )}
        </button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 font-medium">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* 结果展示 - 右侧，较宽 */}
        {result && (
          <div className="xl:col-span-9">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">分析结果</h2>
              </div>

              {/* 统计指标 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-700 font-medium">训练集 R²</div>
                  <div className="text-2xl font-bold text-blue-700">
                    {result.r2_train.toFixed(4)}
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-700 font-medium">测试集 R²</div>
                  <div className="text-2xl font-bold text-green-700">
                    {result.r2_test.toFixed(4)}
                  </div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-sm text-gray-700 font-medium">训练集 MSE</div>
                  <div className="text-2xl font-bold text-orange-700">
                    {result.mse_train.toFixed(4)}
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-700 font-medium">测试集 MSE</div>
                  <div className="text-2xl font-bold text-purple-700">
                    {result.mse_test.toFixed(4)}
                  </div>
                </div>
              </div>

              {/* 回归方程 */}
              {result.equation && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-900 mb-2">回归方程</div>
                  <div className="font-mono text-sm text-gray-900">{result.equation}</div>
                </div>
              )}

              {/* 图表展示 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      name,
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

            {/* 系数展示 */}
            {result.coefficients && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900">回归系数</h3>
                <div className="space-y-2">
                  {Object.entries(result.coefficients).map(([field, coef]) => (
                    <div key={field} className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="font-medium text-gray-900">{field}</span>
                      <span className="font-mono text-gray-700">{coef.toFixed(6)}</span>
                    </div>
                  ))}
                  {result.intercept !== undefined && (
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span className="font-medium text-gray-900">截距</span>
                      <span className="font-mono text-gray-700">{result.intercept.toFixed(6)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
