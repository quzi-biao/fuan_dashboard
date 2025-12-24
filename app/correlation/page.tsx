'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { AnalysisConfig, getFieldLabel } from '@/components/correlation/AnalysisConfig';
import { RegressionResults } from '@/components/correlation/RegressionResults';
import { DIDResults } from '@/components/correlation/DIDResults';

interface AnalysisResult {
  type: string;
  r2_train?: number;
  r2_test?: number;
  mse_train?: number;
  mse_test?: number;
  coefficients?: Record<string, number>;
  intercept?: number;
  feature_importance?: Record<string, number>;
  scatter_data?: Array<{ actual: number; predicted: number }>;
  residuals_data?: Array<{ predicted: number; residual: number }>;
  correlation_matrix?: Record<string, Record<string, number>>;
  equation?: string;
  time_series_data?: Array<{ x: number; y_actual: number; y_predicted: number; time?: string }>;
  is_single_variable?: boolean;
  // DID 分析结果
  did_effect?: number;
  did_p_value?: number;
  pre_treatment_mean?: number;
  post_treatment_mean?: number;
  pre_control_mean?: number;
  post_control_mean?: number;
  treatment_trend?: Array<{ date: string; value: number; group: string; period: string }>;
  parallel_trend_test?: { p_value: number; passed: boolean };
}


export default function CorrelationAnalysisPage() {
  const [xFields, setXFields] = useState<string[]>(['flow_out']);
  const [yField, setYField] = useState('pressure_out');
  const [analysisType, setAnalysisType] = useState<'polynomial' | 'neural_network' | 'did'>('polynomial');
  const [polynomialDegree, setPolynomialDegree] = useState(2);
  const [hiddenLayers, setHiddenLayers] = useState('100,50');
  const [interventionDate, setInterventionDate] = useState('');
  const [timeGranularity, setTimeGranularity] = useState<'minute' | 'hour' | 'day'>('minute');
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
        time_granularity: timeGranularity,
      });

      if (analysisType === 'polynomial') {
        params.append('degree', polynomialDegree.toString());
      } else if (analysisType === 'neural_network') {
        params.append('hidden_layers', hiddenLayers);
      } else if (analysisType === 'did') {
        if (!interventionDate) {
          setError('请选择干预日期');
          setLoading(false);
          return;
        }
        params.append('intervention_date', interventionDate);
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

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* 主内容区域：左右布局 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 配置面板 - 左侧，较窄 */}
        <div className="xl:col-span-3">
          <AnalysisConfig
            xFields={xFields}
            yField={yField}
            analysisType={analysisType}
            polynomialDegree={polynomialDegree}
            hiddenLayers={hiddenLayers}
            interventionDate={interventionDate}
            startDate={startDate}
            endDate={endDate}
            availableFields={availableFields}
            loading={loading}
            timeGranularity={timeGranularity}
            onXFieldsChange={setXFields}
            onYFieldChange={setYField}
            onAnalysisTypeChange={setAnalysisType}
            onPolynomialDegreeChange={setPolynomialDegree}
            onHiddenLayersChange={setHiddenLayers}
            onInterventionDateChange={setInterventionDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onTimeGranularityChange={setTimeGranularity}
            onRunAnalysis={runAnalysis}
            getFieldLabel={getFieldLabel}
          />
          
          {/* 流量分组回归分析入口 */}
          <div className="mt-6">
            <Link
              href="/correlation/flow-group"
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-4 rounded-lg hover:from-green-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 font-medium shadow-lg"
            >
              <TrendingUp className="w-5 h-5" />
              <span>流量分组回归分析</span>
            </Link>
            <p className="text-xs text-gray-600 mt-2 text-center">
              按城东+岩湖总流量分组分析
            </p>
          </div>
        </div>

        {/* 结果展示 - 右侧，较宽 */}
        {result && (
          <div className="xl:col-span-9">
            {result.type === 'did' ? (
              <DIDResults
                result={result}
                yField={yField}
                interventionDate={interventionDate}
                getFieldLabel={getFieldLabel}
              />
            ) : (
              <RegressionResults
                result={result}
                xFields={xFields}
                yField={yField}
                getFieldLabel={getFieldLabel}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
