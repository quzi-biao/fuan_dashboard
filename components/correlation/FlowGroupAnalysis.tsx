'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AnalysisConfig, getFieldLabel } from './AnalysisConfig';
import { RegressionResults } from './RegressionResults';
import { FlowDistribution } from './FlowDistribution';
import { GroupingConfig } from './GroupingConfig';
import { loadConfigFromCache, saveConfigToCache } from '@/lib/utils/configCache';

interface FlowGroup {
  group_id: number;
  min_flow: number;
  max_flow: number;
  count: number;
  avg_flow: number;
}

interface FlowDistribution {
  flow: number;
  count: number;
  frequency: number;
}

interface GroupAnalysisResult {
  type: string;
  group_id: number;
  group_range: string;
  sample_count: number;
  r2_train?: number;
  r2_test?: number;
  mse_train?: number;
  mse_test?: number;
  equation?: string;
  scatter_data?: Array<{ actual: number; predicted: number }>;
  residuals_data?: Array<{ predicted: number; residual: number }>;
  feature_importance?: Record<string, number>;
  [key: string]: any;
}


const CACHE_KEY = 'flowGroupAnalysisConfig';

export function FlowGroupAnalysis() {
  // 从缓存加载初始配置
  const cachedConfig = loadConfigFromCache(CACHE_KEY);
  
  // 分组配置
  const [groupCount, setGroupCount] = useState(cachedConfig?.groupCount || 10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 分组结果
  const [groups, setGroups] = useState<FlowGroup[]>([]);
  const [distribution, setDistribution] = useState<FlowDistribution[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  
  // 分析配置
  const [xFields, setXFields] = useState<string[]>(cachedConfig?.xFields || []);
  const [yField, setYField] = useState(cachedConfig?.yField || '');
  const [analysisType, setAnalysisType] = useState<'polynomial' | 'exponential' | 'logarithmic' | 'neural_network' | 'did'>(cachedConfig?.analysisType || 'polynomial');
  const [polynomialDegree, setPolynomialDegree] = useState(cachedConfig?.polynomialDegree || 2);
  const [hiddenLayers, setHiddenLayers] = useState(cachedConfig?.hiddenLayers || '100,50');
  const [interventionDate, setInterventionDate] = useState(cachedConfig?.interventionDate || '');
  const [timeGranularity, setTimeGranularity] = useState<'minute' | 'hour' | 'day'>(cachedConfig?.timeGranularity || 'minute');
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  
  // 分析结果
  const [analysisResult, setAnalysisResult] = useState<GroupAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // 初始化日期范围
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
          setAvailableFields(data.fields || []);
        }
      } catch (err) {
        console.error('获取字段列表失败:', err);
      }
    }
    fetchFields();
  }, []);

  // 保存配置到缓存（当配置变化时）
  useEffect(() => {
    const config = {
      groupCount,
      xFields,
      yField,
      analysisType,
      polynomialDegree,
      hiddenLayers,
      interventionDate,
      timeGranularity,
    };
    saveConfigToCache(CACHE_KEY, config);
  }, [groupCount, xFields, yField, analysisType, polynomialDegree, hiddenLayers, interventionDate, timeGranularity]);

  // 执行分组
  async function performGrouping() {
    if (!startDate || !endDate) {
      setError('请选择日期范围');
      return;
    }

    setLoading(true);
    setError(null);
    setGroups([]);
    setDistribution([]);
    setSelectedGroupId(null);
    setAnalysisResult(null);

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        group_count: String(groupCount),
      });

      const response = await fetch(`/api/correlation/flow-groups?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '分组失败');
      }

      setGroups(data.groups || []);
      setDistribution(data.distribution || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // 分析选中的分组
  async function analyzeGroup() {
    if (selectedGroupId === null) {
      setError('请选择一个分组');
      return;
    }

    if (!xFields.length || !yField) {
      setError('请选择自变量和因变量');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        group_id: String(selectedGroupId),
        group_count: String(groupCount),
        x_fields: xFields.join(','),
        y_field: yField,
        analysis_type: analysisType,
        time_granularity: timeGranularity,
      });

      if (analysisType === 'polynomial') {
        params.append('degree', String(polynomialDegree));
      } else if (analysisType === 'neural_network') {
        params.append('hidden_layers', hiddenLayers);
      } else if (analysisType === 'did' && interventionDate) {
        params.append('intervention_date', interventionDate);
      }

      const response = await fetch(`/api/correlation/flow-group-analyze?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '分析失败');
      }

      setAnalysisResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-6">
      <div className="max-w-[1920px] mx-auto">
        {/* 头部导航 */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/correlation"
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:bg-gray-50 transition text-gray-900"
          >
            <ArrowLeft size={20} />
            <span>返回普通分析</span>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">流量分组回归分析</h1>
            <p className="text-gray-600 mt-1">基于城东和岩湖总流量进行分组，在每个分组内执行回归分析</p>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 主布局 */}
        <div className="grid grid-cols-12 gap-6 xl:grid-cols-12">
          {/* 左侧：配置面板 */}
          <div className="col-span-3 space-y-6">
            {/* 分析配置 */}
            {selectedGroupId !== null && (
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
                  loading={analyzing}
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
                  onRunAnalysis={analyzeGroup}
                  getFieldLabel={getFieldLabel}
                />
            )}

            {/* 分组配置 */}
            <GroupingConfig
              startDate={startDate}
              endDate={endDate}
              groupCount={groupCount}
              loading={loading}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onGroupCountChange={setGroupCount}
              onPerformGrouping={performGrouping}
            />
          </div>

          {/* 右侧：分组和分析结果 */}
          <div className="col-span-9 space-y-6">
            {/* 流量分布统计 - 只在没有分析结果时显示 */}
            {!analysisResult && (
              <FlowDistribution distribution={distribution} groupCount={groupCount} />
            )}

            {/* 分组选择 */}
            {groups.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  选择分组（共 {groups.length} 个）
                </h2>
                
                <div className="grid grid-cols-12 gap-3">
                  {groups.map((group) => (
                    <div
                      key={group.group_id}
                      onClick={() => setSelectedGroupId(group.group_id)}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedGroupId === group.group_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-gray-900">
                          分组 {group.group_id}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 font-medium px-1.5 py-0.5 rounded">
                          {group.count}
                        </span>
                      </div>
                      <div className="text-xs text-gray-800 space-y-0.5 font-medium">
                        <div className="truncate">范围: <span className="text-blue-600">{group.min_flow.toFixed(0)}~{group.max_flow.toFixed(0)}</span></div>
                        <div className="truncate">均值: <span className="text-green-600">{group.avg_flow.toFixed(1)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 分析结果 */}
            {analysisResult && (
              <div>
                {/* <div className="bg-white rounded-lg shadow p-6 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    分组 {analysisResult.group_id} 的分析结果
                  </h3>
                  <p className="text-sm text-gray-600">
                    流量范围: {analysisResult.group_range} | 样本数: {analysisResult.sample_count}
                  </p>
                </div> */}
                <RegressionResults
                  result={analysisResult}
                  xFields={xFields}
                  yField={yField}
                  getFieldLabel={getFieldLabel}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
