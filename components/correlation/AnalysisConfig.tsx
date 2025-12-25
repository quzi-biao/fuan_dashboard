/**
 * 关联分析配置组件
 */
'use client';

import { CustomSelect } from '@/components/CustomSelect';
import { CustomDatePicker } from '@/components/CustomDatePicker';

// 字段标签映射
export const FIELD_LABELS: Record<string, string> = {
  // 末端压力计
  'press_4137': '末端压力 - 一中新校区',
  'press_9300': '末端压力 - 农垦人花苑',
  'press_2366': '末端压力 - 涧里小区',
  'press_6540': '末端压力 - 天马山庄',
  'press_5385': '末端压力 - 农校',
  'press_3873': '末端压力 - 阳头小学外墙',
  'press_1665': '末端压力 - 老干新村',
  
  // 水厂指标
  'i_1034': '岩湖-出水流量',
  'i_1030': '岩湖-出水压力',
  'i_1029': '岩湖-水位',
  'i_1031': '岩湖-目标压力',
  'i_1032': '岩湖-出水流量1',
  'i_1033': '岩湖-出水流量2',
  'i_1035': '岩湖-出水累计流量',
  
  // 泵相关指标
  'i_1069': '岩湖-实时水电比',
  'i_1070': '岩湖-实时能耗',
  'i_1071': '岩湖-实时效率',
  'i_1072': '岩湖-日累计电量',
  'i_1073': '岩湖-日累计水量',
  'i_1074': '岩湖-日累计水电比',
  'i_1075': '岩湖-累计电量',
  'i_1076': '岩湖-累计水量',
  'i_1077': '岩湖-累计水电比',
  
  'i_1128': '城东-控制流量',
  'i_1129': '城东-累计流量',
  'i_1130': '城东-日用水量',
  
  // 其他指标
  'i_1102': '城东-瞬时流量',
  'i_1101': '城东-手动开度',
  'i_1099': '城东-中控开度',
  'i_1098': '城东-阀门开度',
  'i_1097': '城东-水箱水位',
  'i_1096': '城东-阀门增减量流量设置',
};

// 获取字段显示标签
export function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || `${field} (未知)`;
}

// 分析类型定义
export type AnalysisType = 
  | 'linear'              // 线性回归
  | 'polynomial'          // 多项式回归
  | 'exponential'         // 指数回归
  | 'logarithmic'         // 对数回归
  | 'power'               // 幂函数回归
  | 'ridge'               // 岭回归
  | 'lasso'               // Lasso回归
  | 'elastic_net'         // 弹性网络回归
  | 'svr'                 // 支持向量回归
  | 'random_forest'       // 随机森林回归
  | 'gradient_boosting'   // 梯度提升回归
  | 'neural_network'      // 神经网络回归
  | 'did';                // 双重差分分析

// 分析方法标签
export const ANALYSIS_TYPE_LABELS: Record<AnalysisType, string> = {
  'linear': '线性回归',
  'polynomial': '多项式回归',
  'exponential': '指数回归',
  'logarithmic': '对数回归',
  'power': '幂函数回归',
  'ridge': '岭回归 (L2正则化)',
  'lasso': 'Lasso回归 (L1正则化)',
  'elastic_net': '弹性网络回归 (L1+L2)',
  'svr': '支持向量回归 (SVR)',
  'random_forest': '随机森林回归',
  'gradient_boosting': '梯度提升回归 (GBDT)',
  'neural_network': '神经网络回归',
  'did': '双重差分分析 (DID)'
};

interface AnalysisConfigProps {
  xFields: string[];
  yField: string;
  analysisType: AnalysisType;
  polynomialDegree: number;
  hiddenLayers: string;
  interventionDate: string;
  startDate: string;
  endDate: string;
  availableFields: string[];
  loading: boolean;
  timeGranularity?: 'minute' | 'hour' | 'day';
  onXFieldsChange: (fields: string[]) => void;
  onYFieldChange: (field: string) => void;
  onAnalysisTypeChange: (type: AnalysisType) => void;
  onPolynomialDegreeChange: (degree: number) => void;
  onHiddenLayersChange: (layers: string) => void;
  onInterventionDateChange: (date: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onTimeGranularityChange?: (granularity: 'minute' | 'hour' | 'day') => void;
  onRunAnalysis: () => void;
  getFieldLabel: (field: string) => string;
}

export function AnalysisConfig({
  xFields,
  yField,
  analysisType,
  polynomialDegree,
  hiddenLayers,
  interventionDate,
  startDate,
  endDate,
  availableFields,
  loading,
  timeGranularity = 'minute',
  onXFieldsChange,
  onYFieldChange,
  onAnalysisTypeChange,
  onPolynomialDegreeChange,
  onHiddenLayersChange,
  onInterventionDateChange,
  onStartDateChange,
  onEndDateChange,
  onTimeGranularityChange,
  onRunAnalysis,
  getFieldLabel
}: AnalysisConfigProps) {
  
  const addXField = () => {
    onXFieldsChange([...xFields, '']);
  };

  const removeXField = (index: number) => {
    if (xFields.length > 1) {
      const newFields = xFields.filter((_, i) => i !== index);
      onXFieldsChange(newFields);
    }
  };

  const updateXField = (index: number, value: string) => {
    const newFields = [...xFields];
    newFields[index] = value;
    onXFieldsChange(newFields);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 sticky top-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">分析配置</h2>
      
      {/* 自变量选择 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          自变量（Independent Variables）
        </label>
        {xFields.map((field, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <CustomSelect
              value={field}
              onChange={(value) => updateXField(index, value)}
              options={availableFields.map(f => ({ value: f, label: getFieldLabel(f) }))}
              placeholder="选择字段"
              className="flex-1"
            />
            {xFields.length > 1 && (
              <button
                onClick={() => removeXField(index)}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex-shrink-0"
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
        <CustomSelect
          value={yField}
          onChange={onYFieldChange}
          options={availableFields.map(f => ({ value: f, label: getFieldLabel(f) }))}
          placeholder="选择字段"
        />
      </div>

      {/* 时间粒度选择 */}
      {onTimeGranularityChange && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            时间粒度
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center text-gray-900">
              <input
                type="radio"
                value="minute"
                checked={timeGranularity === 'minute'}
                onChange={(e) => onTimeGranularityChange(e.target.value as 'minute')}
                className="mr-2"
              />
              按分钟（原始数据）
            </label>
            <label className="flex items-center text-gray-900">
              <input
                type="radio"
                value="hour"
                checked={timeGranularity === 'hour'}
                onChange={(e) => onTimeGranularityChange(e.target.value as 'hour')}
                className="mr-2"
              />
              按小时（小时均值）
            </label>
            <label className="flex items-center text-gray-900">
              <input
                type="radio"
                value="day"
                checked={timeGranularity === 'day'}
                onChange={(e) => onTimeGranularityChange(e.target.value as 'day')}
                className="mr-2"
              />
              按日（日均值）
            </label>
          </div>
        </div>
      )}

      {/* 分析类型 */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">分析类型</h3>
        <CustomSelect
          value={analysisType}
          onChange={(value) => onAnalysisTypeChange(value as AnalysisType)}
          options={[
            { value: 'linear', label: `${ANALYSIS_TYPE_LABELS.linear}` },
            { value: 'polynomial', label: `${ANALYSIS_TYPE_LABELS.polynomial}` },
            { value: 'exponential', label: `${ANALYSIS_TYPE_LABELS.exponential}` },
            { value: 'logarithmic', label: `${ANALYSIS_TYPE_LABELS.logarithmic}` },
            { value: 'power', label: `${ANALYSIS_TYPE_LABELS.power}` },
            { value: 'ridge', label: `${ANALYSIS_TYPE_LABELS.ridge}` },
            { value: 'lasso', label: `${ANALYSIS_TYPE_LABELS.lasso}` },
            { value: 'elastic_net', label: `${ANALYSIS_TYPE_LABELS.elastic_net}` },
            { value: 'svr', label: `${ANALYSIS_TYPE_LABELS.svr}` },
            { value: 'random_forest', label: `${ANALYSIS_TYPE_LABELS.random_forest}` },
            { value: 'gradient_boosting', label: `${ANALYSIS_TYPE_LABELS.gradient_boosting}` },
            { value: 'neural_network', label: `${ANALYSIS_TYPE_LABELS.neural_network}` },
            { value: 'did', label: `${ANALYSIS_TYPE_LABELS.did}` },
          ]}
        />
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
            onChange={(e) => onPolynomialDegreeChange(parseInt(e.target.value))}
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
            onChange={(e) => onHiddenLayersChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-500"
            placeholder="100,50"
          />
        </div>
      )}

      {/* 双重差分干预日期 */}
      {analysisType === 'did' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            干预日期（政策实施日期）
          </label>
          <input
            type="date"
            value={interventionDate}
            onChange={(e) => onInterventionDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          />
          <p className="text-xs text-gray-500 mt-1">
            选择干预措施实施的日期，用于划分前后时期
          </p>
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
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onQuery={() => {}}
          maxDays={90}
          color="blue"
          cacheKey="correlationDateRange"
          hideButtons
        />
      </div>

      {/* 执行分析按钮 */}
      <button
        onClick={onRunAnalysis}
        disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
      >
        {loading ? '分析中...' : '开始分析'}
      </button>
    </div>
  );
}
