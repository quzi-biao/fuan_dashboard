'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AnalysisConfig } from './AnalysisConfig';
import { RegressionResults } from './RegressionResults';

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

// 字段标签映射（复用）
const FIELD_LABELS: Record<string, string> = {
  'press_4137': '末端压力 - 一中新校区',
  'press_9300': '末端压力 - 农垦人花苑',
  'press_2366': '末端压力 - 涧里小区',
  'press_6540': '末端压力 - 天马山庄',
  'press_5385': '末端压力 - 农校',
  'press_3873': '末端压力 - 阳头小学外墙',
  'press_1665': '末端压力 - 老干新村',
  'i_1034': '岩湖-出水流量',
  'i_1030': '岩湖-出水压力',
  'i_1029': '岩湖-水位',
  'i_1076': '岩湖-累计流量',
  'i_1027': '岩湖-瞬时流量',
  'i_1026': '岩湖-浊度',
  'i_1025': '岩湖-余氯',
  'i_1024': '岩湖-PH',
  'i_1023': '岩湖-水温',
  'i_1022': '岩湖-电导率',
  'i_1021': '岩湖-溶解氧',
  'i_1020': '岩湖-氨氮',
  'i_1019': '岩湖-COD',
  'i_1018': '岩湖-BOD',
  'i_1017': '岩湖-总磷',
  'i_1016': '岩湖-总氮',
  'i_1015': '岩湖-悬浮物',
  'i_1014': '岩湖-透明度',
  'i_1013': '岩湖-叶绿素a',
  'i_1012': '岩湖-蓝绿藻',
  'i_1011': '城东-出水流量',
  'i_1010': '城东-出水压力',
  'i_1009': '城东-水位',
  'i_1129': '城东-累计流量',
  'i_1007': '城东-瞬时流量',
};

function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || `${field} (未知)`;
}

export function FlowGroupAnalysis() {
  // 分组配置
  const [groupCount, setGroupCount] = useState(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 分组结果
  const [groups, setGroups] = useState<FlowGroup[]>([]);
  const [distribution, setDistribution] = useState<FlowDistribution[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  
  // 分析配置
  const [xFields, setXFields] = useState<string[]>([]);
  const [yField, setYField] = useState('');
  const [analysisType, setAnalysisType] = useState<'polynomial' | 'neural_network' | 'did'>('polynomial');
  const [polynomialDegree, setPolynomialDegree] = useState(2);
  const [hiddenLayers, setHiddenLayers] = useState('100,50');
  const [interventionDate, setInterventionDate] = useState('');
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  
  // 分析结果
  const [analysisResult, setAnalysisResult] = useState<GroupAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // 初始化日期范围（最近7天）
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
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <Link
            href="/correlation"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回普通分析</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">流量分组回归分析</h1>
          <p className="text-gray-600 mt-2">
            基于城东和岩湖总流量进行分组，在每个分组内执行回归分析
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 分组配置 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">第一步：配置分组参数</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                开始日期
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                结束日期
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                分组数量
              </label>
              <input
                type="number"
                min="2"
                max="50"
                value={groupCount}
                onChange={(e) => setGroupCount(parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          <button
            onClick={performGrouping}
            disabled={loading || !startDate || !endDate}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>分组中...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>执行分组</span>
              </>
            )}
          </button>

          {/* 分组说明 */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">分组说明</h3>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>对每个时间点，取前后10分钟的累计流量窗口（滑动窗口）</li>
              <li>计算窗口内城东和岩湖累计流量的最大值和最小值</li>
              <li>平均流量 = (最大值 - 最小值) / 窗口大小</li>
              <li>将两个水厂的平均流量求和，得到总流量（取整数）</li>
              <li>过滤异常值（总流量 &gt; 500）</li>
              <li>根据设置的分组数量，自动计算每个分组的流量范围</li>
              <li>将数据按流量范围分配到各个分组</li>
            </ol>
          </div>
        </div>

        {/* 流量分布曲线 */}
        {distribution.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">流量分布统计</h2>
            
            {/* 统计信息卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="text-xs text-blue-700 font-medium mb-1">总样本数</div>
                <div className="text-2xl font-bold text-blue-900">
                  {distribution.reduce((sum, d) => sum + d.count, 0)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="text-xs text-green-700 font-medium mb-1">流量范围</div>
                <div className="text-xl font-bold text-green-900">
                  {distribution[0]?.flow} ~ {distribution[distribution.length - 1]?.flow}
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                <div className="text-xs text-orange-700 font-medium mb-1">峰值流量</div>
                <div className="text-2xl font-bold text-orange-900">
                  {distribution.reduce((max, d) => d.count > max.count ? d : max, distribution[0])?.flow}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="text-xs text-purple-700 font-medium mb-1">峰值频次</div>
                <div className="text-2xl font-bold text-purple-900">
                  {Math.max(...distribution.map(d => d.count))}
                </div>
              </div>
            </div>

            {/* 分布柱状图 */}
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-6 border border-gray-200">
              {distribution.length > 0 ? (
                <>
                  <div className="h-48 flex items-end gap-px">
                    {(() => {
                      // 根据分组数量聚合数据
                      const minFlow = distribution[0].flow;
                      const maxFlow = distribution[distribution.length - 1].flow;
                      const rangeSize = (maxFlow - minFlow) / groupCount;
                      
                      // 创建分组
                      const aggregatedData: Array<{ flow: number; count: number; range: string }> = [];
                      for (let i = 0; i < groupCount; i++) {
                        const groupMin = minFlow + i * rangeSize;
                        const groupMax = i === groupCount - 1 ? maxFlow + 1 : minFlow + (i + 1) * rangeSize;
                        
                        // 统计该分组内的数据点
                        const groupData = distribution.filter(d => d.flow >= groupMin && d.flow < groupMax);
                        const totalCount = groupData.reduce((sum, d) => sum + d.count, 0);
                        const avgFlow = groupData.length > 0 
                          ? groupData.reduce((sum, d) => sum + d.flow * d.count, 0) / totalCount 
                          : groupMin;
                        
                        if (totalCount > 0) {
                          aggregatedData.push({
                            flow: Math.round(avgFlow),
                            count: totalCount,
                            range: `${Math.round(groupMin)}-${Math.round(groupMax)}`
                          });
                        }
                      }
                      
                      const maxCount = Math.max(...aggregatedData.map(d => d.count));
                      
                      console.log('Aggregated distribution:', { 
                        groupCount,
                        aggregatedGroups: aggregatedData.length,
                        maxCount,
                        sample: aggregatedData.slice(0, 3)
                      });
                      
                      return aggregatedData.map((d, i) => {
                        const heightPx = maxCount > 0 ? (d.count / maxCount) * 192 : 0; // 192px = h-48
                        const isHighest = d.count === maxCount;
                        
                        return (
                          <div
                            key={i}
                            className="flex-1 group relative"
                            style={{ minWidth: '3px' }}
                          >
                            <div
                              className={`w-full rounded-t transition-all ${
                                isHighest 
                                  ? 'bg-gradient-to-t from-orange-500 to-orange-400' 
                                  : 'bg-gradient-to-t from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500'
                              }`}
                              style={{ 
                                height: `${Math.max(heightPx, 3)}px`
                              }}
                            />
                            {/* 悬停提示 */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                              范围: {d.range}<br/>
                              频次: {d.count}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  
                  {/* X轴标签 */}
                  <div className="flex justify-between mt-4 text-xs text-gray-600 font-medium">
                    <span>最小: {distribution[0]?.flow}</span>
                    <span className="text-gray-500">← 流量分布 ({groupCount} 个分组) →</span>
                    <span>最大: {distribution[distribution.length - 1]?.flow}</span>
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">
                  暂无分布数据
                </div>
              )}
            </div>
          </div>
        )}

        {/* 分组结果 */}
        {groups.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              第二步：选择分组（共 {groups.length} 个分组）
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {groups.map((group) => (
                <div
                  key={group.group_id}
                  onClick={() => setSelectedGroupId(group.group_id)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedGroupId === group.group_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-semibold text-gray-900">
                      分组 {group.group_id}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2 py-1 rounded">
                      {group.count} 条
                    </span>
                  </div>
                  <div className="text-sm text-gray-800 space-y-1 font-medium">
                    <div>流量范围: <span className="text-blue-600">{group.min_flow.toFixed(0)} ~ {group.max_flow.toFixed(0)}</span></div>
                    <div>平均流量: <span className="text-green-600">{group.avg_flow.toFixed(1)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 分析配置和执行 */}
        {selectedGroupId !== null && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* 左侧：分析配置 */}
            <div className="xl:col-span-4">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  第三步：配置分析参数
                </h2>
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
                  onXFieldsChange={setXFields}
                  onYFieldChange={setYField}
                  onAnalysisTypeChange={setAnalysisType}
                  onPolynomialDegreeChange={setPolynomialDegree}
                  onHiddenLayersChange={setHiddenLayers}
                  onInterventionDateChange={setInterventionDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onRunAnalysis={analyzeGroup}
                  getFieldLabel={getFieldLabel}
                />
              </div>
            </div>

            {/* 右侧：分析结果 */}
            {analysisResult && (
              <div className="xl:col-span-8">
                <div className="bg-white rounded-lg shadow p-6 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    分组 {analysisResult.group_id} 的分析结果
                  </h3>
                  <p className="text-sm text-gray-600">
                    流量范围: {analysisResult.group_range} | 样本数: {analysisResult.sample_count}
                  </p>
                </div>
                <RegressionResults
                  result={analysisResult}
                  xFields={xFields}
                  yField={yField}
                  getFieldLabel={getFieldLabel}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
