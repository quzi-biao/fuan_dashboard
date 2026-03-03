'use client';

import { useEffect, useState, Fragment } from 'react';
import { X, Download, Edit2, Save, XCircle } from 'lucide-react';

const BASELINE = {
  daily_water_supply: 37.8,
  avg_pressure: 0.461,
  daily_power_per_kt: 176.21,
  power_per_kt_mpa: 382.23,
  pump_efficiency: 72.64,
  comprehensive_price: 0.77,
  water_supply_cost: 0.1357,
};

interface MonthData {
  year_month: string;
  orig_daily_water_supply?: number;
  orig_avg_pressure?: number;
  orig_daily_power_consumption?: number;
  orig_peak_ratio?: number;
  orig_valley_ratio?: number;
  orig_flat_ratio?: number;
  orig_spike_ratio?: number;
  daily_water_supply: number;
  avg_pressure: number;
  daily_power_consumption: number;
  daily_power_per_kt: number;
  power_per_kt_mpa: number;
  pump_efficiency: number;
  comprehensive_price: number;
  peak_ratio: number;
  valley_ratio: number;
  flat_ratio: number;
  spike_ratio: number;
  water_supply_cost: number;
  annual_savings: number;
  power_per_kt_saving_rate: number;
  power_per_kt_mpa_saving_rate: number;
  pump_efficiency_saving_rate: number;
  comprehensive_price_saving_rate: number;
  water_supply_cost_saving_rate: number;
}

interface EnergySavingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EnergySavingModal({ isOpen, onClose }: EnergySavingModalProps) {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<MonthData>>({});
  const [originalData, setOriginalData] = useState<Partial<MonthData>>({});
  const [hoveredCell, setHoveredCell] = useState<{ month: string; field: string } | null>(null);
  const [newMonthInput, setNewMonthInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch('/api/energy-saving');
      const result = await response.json();
      if (result.success) {
        const sortedData = result.data.sort((a: MonthData, b: MonthData) => 
          a.year_month.localeCompare(b.year_month)
        );
        setData(sortedData);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMonthStatistics(yearMonth: string) {
    try {
      const response = await fetch(`/api/energy-saving/calculate?yearMonth=${yearMonth}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const calculated = calculateMetrics(result.data);
        const dataToSave = {
          year_month: yearMonth,
          orig_values: result.data,
          ...result.data,
          ...calculated,
        };

        const saveResponse = await fetch('/api/energy-saving', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        });

        const saveResult = await saveResponse.json();
        if (saveResult.success) {
          await loadData();
          alert(`成功加载 ${yearMonth} 的统计数据`);
        } else {
          alert('保存统计数据失败');
        }
      } else {
        alert('该月份没有可用的统计数据');
      }
    } catch (error) {
      console.error('加载月度统计失败:', error);
      alert('加载月度统计失败');
    }
  }

  function calculateMetrics(editedData: Partial<MonthData>) {
    const dailyPowerPerKt = editedData.daily_water_supply && editedData.daily_water_supply > 0
      ? (editedData.daily_power_consumption || 0) / editedData.daily_water_supply
      : 0;

    const powerPerKtMpa = editedData.avg_pressure && editedData.avg_pressure > 0
      ? dailyPowerPerKt / editedData.avg_pressure
      : 0;

    const pumpEfficiency = dailyPowerPerKt > 0
      ? (0.278 * (editedData.avg_pressure || 0) * 1000) / dailyPowerPerKt
      : 0;

    const annualSavings = (BASELINE.water_supply_cost - (editedData.water_supply_cost || 0)) * 3.78 * 365;

    const powerPerKtSavingRate = ((BASELINE.daily_power_per_kt - dailyPowerPerKt) / BASELINE.daily_power_per_kt) * 100;
    const powerPerKtMpaSavingRate = ((BASELINE.power_per_kt_mpa - powerPerKtMpa) / BASELINE.power_per_kt_mpa) * 100;
    const pumpEfficiencySavingRate = ((pumpEfficiency - BASELINE.pump_efficiency) / BASELINE.pump_efficiency) * 100;
    const comprehensivePriceSavingRate = ((BASELINE.comprehensive_price - (editedData.comprehensive_price || 0)) / BASELINE.comprehensive_price) * 100;
    const waterSupplyCostSavingRate = ((BASELINE.water_supply_cost - (editedData.water_supply_cost || 0)) / BASELINE.water_supply_cost) * 100;

    return {
      daily_power_per_kt: dailyPowerPerKt,
      power_per_kt_mpa: powerPerKtMpa,
      pump_efficiency: pumpEfficiency,
      annual_savings: annualSavings,
      power_per_kt_saving_rate: powerPerKtSavingRate,
      power_per_kt_mpa_saving_rate: powerPerKtMpaSavingRate,
      pump_efficiency_saving_rate: pumpEfficiencySavingRate,
      comprehensive_price_saving_rate: comprehensivePriceSavingRate,
      water_supply_cost_saving_rate: waterSupplyCostSavingRate,
    };
  }

  function startEdit(month: string) {
    if (editingMonth && editingMonth !== month) {
      if (!confirm('您有未保存的编辑内容，切换到其他月份将丢失这些内容。是否继续？')) {
        return;
      }
    }

    const monthData = data.find(d => d.year_month === month);
    if (monthData) {
      setEditingMonth(month);
      setEditData({ ...monthData });
      setOriginalData({ ...monthData });
    }
  }

  function cancelEdit() {
    setEditingMonth(null);
    setEditData({});
    setOriginalData({});
  }

  async function saveEdit() {
    if (!editingMonth) return;

    const backendData = {
      ...editData,
      daily_water_supply: (editData.daily_water_supply || 0) * 1000,
      peak_ratio: (editData.peak_ratio || 0) / 100,
      valley_ratio: (editData.valley_ratio || 0) / 100,
      flat_ratio: (editData.flat_ratio || 0) / 100,
      spike_ratio: (editData.spike_ratio || 0) / 100,
    };

    const calculated = calculateMetrics(backendData);
    
    const monthData = data.find(d => d.year_month === editingMonth);
    const orig_values = monthData ? {
      daily_water_supply: (monthData.orig_daily_water_supply || 0) * 1000,
      avg_pressure: monthData.orig_avg_pressure,
      daily_power_consumption: monthData.orig_daily_power_consumption,
      peak_ratio: (monthData.orig_peak_ratio || 0) / 100,
      valley_ratio: (monthData.orig_valley_ratio || 0) / 100,
      flat_ratio: (monthData.orig_flat_ratio || 0) / 100,
      spike_ratio: (monthData.orig_spike_ratio || 0) / 100,
    } : null;
    
    const dataToSave = {
      year_month: editingMonth,
      orig_values: orig_values,
      ...backendData,
      ...calculated,
    };

    try {
      const response = await fetch('/api/energy-saving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
        setEditingMonth(null);
        setEditData({});
        setOriginalData({});
      } else {
        alert('保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  }

  function updateEditField(field: string, value: number) {
    const updated = { ...editData, [field]: value };
    const calculated = calculateMetrics(updated);
    setEditData({ ...updated, ...calculated });
  }

  async function exportToExcel() {
    try {
      const response = await fetch('/api/energy-saving/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `岩湖水厂节能改造效益分析_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败');
    }
  }

  function getOriginalValue(month: string, field: string): number | null {
    const monthData = data.find(d => d.year_month === month);
    if (!monthData) return null;

    const originalFieldMap: { [key: string]: string } = {
      'daily_water_supply': 'orig_daily_water_supply',
      'avg_pressure': 'orig_avg_pressure',
      'daily_power_consumption': 'orig_daily_power_consumption',
      'peak_ratio': 'orig_peak_ratio',
      'valley_ratio': 'orig_valley_ratio',
      'flat_ratio': 'orig_flat_ratio',
      'spike_ratio': 'orig_spike_ratio',
    };

    const origField = originalFieldMap[field];
    if (!origField) return null;

    return monthData[origField as keyof MonthData] as number | null;
  }

  if (!isOpen) return null;

  const metrics = [
    { name: '日均供水量(kt/d)', baseline: BASELINE.daily_water_supply, field: 'daily_water_supply', editable: true, hasRate: false, isPercentage: false },
    { name: '平均送水压力(Mpa)', baseline: BASELINE.avg_pressure, field: 'avg_pressure', editable: true, hasRate: false, isPercentage: false },
    { name: '日均用电量(kw*h)', baseline: '-', field: 'daily_power_consumption', editable: true, hasRate: false, isPercentage: false },
    { name: '日均电耗(kw*h/kt)', baseline: BASELINE.daily_power_per_kt, field: 'daily_power_per_kt', editable: false, hasRate: true, rateField: 'power_per_kt_saving_rate', isPercentage: false },
    { name: '千吨水Mpa电耗(kw*h/kt.Mpa)', baseline: BASELINE.power_per_kt_mpa, field: 'power_per_kt_mpa', editable: false, hasRate: true, rateField: 'power_per_kt_mpa_saving_rate', isPercentage: false },
    { name: '泵组综合效率(%)', baseline: BASELINE.pump_efficiency, field: 'pump_efficiency', editable: false, hasRate: true, rateField: 'pump_efficiency_saving_rate', isPercentage: true },
    { name: '综合电单价(元/kw*h)', baseline: BASELINE.comprehensive_price, field: 'comprehensive_price', editable: true, hasRate: true, rateField: 'comprehensive_price_saving_rate', isPercentage: false },
    { name: '峰时占比(%)', baseline: '-', field: 'peak_ratio', editable: true, hasRate: false, isPercentage: true },
    { name: '谷时占比(%)', baseline: '-', field: 'valley_ratio', editable: true, hasRate: false, isPercentage: true },
    { name: '平时占比(%)', baseline: '-', field: 'flat_ratio', editable: true, hasRate: false, isPercentage: true },
    { name: '尖峰占比(%)', baseline: '-', field: 'spike_ratio', editable: true, hasRate: false, isPercentage: true },
    { name: '送水电费(元/t)', baseline: BASELINE.water_supply_cost, field: 'water_supply_cost', editable: true, hasRate: true, rateField: 'water_supply_cost_saving_rate', isPercentage: false },
    { name: '年节省电费(万元/年)', baseline: '-', field: 'annual_savings', editable: false, hasRate: false, isPercentage: false },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">岩湖水厂节能改造效益分析</h2>
            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                <Download size={18} />
                导出Excel
              </button>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-900">加载月度统计：</label>
            <input
              type="month"
              value={newMonthInput}
              onChange={(e) => setNewMonthInput(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm text-gray-900"
              placeholder="选择月份"
            />
            <button
              onClick={() => {
                if (newMonthInput) {
                  loadMonthStatistics(newMonthInput);
                  setNewMonthInput('');
                } else {
                  alert('请选择月份');
                }
              }}
              className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
            >
              加载统计数据
            </button>
            <span className="text-xs text-gray-500">（从原始数据计算该月份的统计值）</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-r-2 border-r-gray-300 p-2 sticky left-0 bg-gray-100 z-10 min-w-[200px] text-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>指标名称</th>
                    <th className="border border-r-2 border-r-gray-300 p-2 sticky left-[200px] bg-gray-100 z-10 min-w-[100px] text-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>基准值</th>
                    {data.map(month => (
                      <th key={month.year_month} className="border p-2 min-w-[200px] text-gray-900 group" colSpan={2}>
                        <div className="flex items-center justify-between gap-2">
                          <span>{month.year_month}</span>
                          {editingMonth === month.year_month ? (
                            <div className="flex gap-1">
                              <button
                                onClick={saveEdit}
                                className="text-green-600 hover:text-green-700"
                                title="保存"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-red-600 hover:text-red-700"
                                title="取消"
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(month.year_month)}
                              className="text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition"
                              title="编辑"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-gray-100">
                    {data.map(month => (
                      <Fragment key={`${month.year_month}-subheader`}>
                        <th className="border p-2 text-xs text-gray-900 min-w-[100px]">实际值</th>
                        <th className="border p-2 text-xs text-gray-900 min-w-[100px]">节能率</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(metric => (
                    <tr key={metric.field} className="hover:bg-gray-50">
                      <td className="border border-r-2 border-r-gray-300 p-2 font-medium sticky left-0 bg-white z-10 text-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{metric.name}</td>
                      <td className="border border-r-2 border-r-gray-300 p-2 text-center sticky left-[200px] bg-white z-10 text-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{metric.baseline}</td>
                      {data.map(month => {
                        const isEditing = editingMonth === month.year_month;
                        const value = isEditing 
                          ? editData[metric.field as keyof MonthData]
                          : month[metric.field as keyof MonthData];
                        const originalValue = getOriginalValue(month.year_month, metric.field);
                        
                        const rateValue = metric.hasRate && metric.rateField
                          ? (isEditing
                              ? editData[metric.rateField as keyof MonthData]
                              : month[metric.rateField as keyof MonthData])
                          : null;

                        return (
                          <Fragment key={`${month.year_month}-${metric.field}`}>
                            <td
                              className="border p-2 text-center relative text-gray-900"
                              onMouseEnter={() => setHoveredCell({ month: month.year_month, field: metric.field })}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              {isEditing && metric.editable ? (
                                <input
                                  type="number"
                                  step="0.0001"
                                  value={value as number || ''}
                                  onChange={(e) => updateEditField(metric.field, parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-1 border rounded text-center text-gray-900"
                                />
                              ) : (
                                <span>
                                  {typeof value === 'number' 
                                    ? (metric.isPercentage ? `${value.toFixed(2)}%` : value.toFixed(4))
                                    : '-'}
                                </span>
                              )}
                              {hoveredCell?.month === month.year_month && 
                               hoveredCell?.field === metric.field && 
                               originalValue !== null && 
                               originalValue !== undefined && 
                               typeof originalValue === 'number' && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-20">
                                  原始统计值: {metric.isPercentage ? `${originalValue.toFixed(2)}%` : originalValue.toFixed(4)}
                                </div>
                              )}
                            </td>
                            <td className="border p-2 text-center text-gray-900">
                              {typeof rateValue === 'number' ? `${rateValue.toFixed(2)}%` : '/'}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
