/**
 * 关联分析配置组件
 */
'use client';

import { CustomSelect } from '@/components/CustomSelect';
import { CustomDatePicker } from '@/components/CustomDatePicker';

interface AnalysisConfigProps {
  xFields: string[];
  yField: string;
  analysisType: 'polynomial' | 'neural_network' | 'did';
  polynomialDegree: number;
  hiddenLayers: string;
  interventionDate: string;
  startDate: string;
  endDate: string;
  availableFields: string[];
  loading: boolean;
  onXFieldsChange: (fields: string[]) => void;
  onYFieldChange: (field: string) => void;
  onAnalysisTypeChange: (type: 'polynomial' | 'neural_network' | 'did') => void;
  onPolynomialDegreeChange: (degree: number) => void;
  onHiddenLayersChange: (layers: string) => void;
  onInterventionDateChange: (date: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
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
  onXFieldsChange,
  onYFieldChange,
  onAnalysisTypeChange,
  onPolynomialDegreeChange,
  onHiddenLayersChange,
  onInterventionDateChange,
  onStartDateChange,
  onEndDateChange,
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

      {/* 分析类型 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          分析类型
        </label>
        <div className="flex flex-col gap-2">
          <label className="flex items-center text-gray-900">
            <input
              type="radio"
              value="polynomial"
              checked={analysisType === 'polynomial'}
              onChange={(e) => onAnalysisTypeChange(e.target.value as 'polynomial')}
              className="mr-2"
            />
            多项式回归
          </label>
          <label className="flex items-center text-gray-900">
            <input
              type="radio"
              value="neural_network"
              checked={analysisType === 'neural_network'}
              onChange={(e) => onAnalysisTypeChange(e.target.value as 'neural_network')}
              className="mr-2"
            />
            神经网络回归
          </label>
          <label className="flex items-center text-gray-900">
            <input
              type="radio"
              value="did"
              checked={analysisType === 'did'}
              onChange={(e) => onAnalysisTypeChange(e.target.value as 'did')}
              className="mr-2"
            />
            双重差分分析
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
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
