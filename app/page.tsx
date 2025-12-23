/**
 * 福安数据分析仪表板
 * 主页面
 */
'use client';

import { useEffect, useState } from 'react';
import { LatestDataPanel } from '@/components/LatestDataPanel';
import { FlowAnalysisTable } from '@/components/FlowAnalysisTable';
import { EfficiencyAnalysisTable } from '@/components/EfficiencyAnalysisTable';
import { FlowAnalysisCharts } from '@/components/FlowAnalysisCharts';
import { EfficiencyAnalysisCharts } from '@/components/EfficiencyAnalysisCharts';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Download, BarChart3, Table } from 'lucide-react';

export default function Home() {
  const [latestData, setLatestData] = useState<any>(null);
  const [flowAnalysis, setFlowAnalysis] = useState<any[]>([]);
  const [efficiencyAnalysis, setEfficiencyAnalysis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 日期范围状态
  const [flowStartDate, setFlowStartDate] = useState('');
  const [flowEndDate, setFlowEndDate] = useState('');
  const [efficiencyStartDate, setEfficiencyStartDate] = useState('');
  const [efficiencyEndDate, setEfficiencyEndDate] = useState('');
  
  // 视图切换状态
  const [flowViewMode, setFlowViewMode] = useState<'table' | 'chart'>('table');
  const [efficiencyViewMode, setEfficiencyViewMode] = useState<'table' | 'chart'>('table');

  // 初始化日期（不包含今天）
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sevenDaysAgo = new Date(yesterday);
    sevenDaysAgo.setDate(yesterday.getDate() - 6); // 昨天往前推6天，共7天
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const endDateStr = formatDate(yesterday); // 结束日期为昨天
    const startDateStr = formatDate(sevenDaysAgo);
    
    // 检查缓存，如果有则从 CustomDatePicker 组件加载，否则设置默认值
    const cachedFlow = localStorage.getItem('flowDateRange');
    const cachedEfficiency = localStorage.getItem('efficiencyDateRange');
    
    if (cachedFlow) {
      const { startDate, endDate } = JSON.parse(cachedFlow);
      setFlowStartDate(startDate);
      setFlowEndDate(endDate);
    } else {
      setFlowStartDate(startDateStr);
      setFlowEndDate(endDateStr);
    }
    
    if (cachedEfficiency) {
      const { startDate, endDate } = JSON.parse(cachedEfficiency);
      setEfficiencyStartDate(startDate);
      setEfficiencyEndDate(endDate);
    } else {
      setEfficiencyStartDate(startDateStr);
      setEfficiencyEndDate(endDateStr);
    }
  }, []);

  // 当日期设置好后加载数据
  useEffect(() => {
    if (flowStartDate && flowEndDate && efficiencyStartDate && efficiencyEndDate) {
      loadData();
    }
  }, [flowStartDate, flowEndDate, efficiencyStartDate, efficiencyEndDate]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // 并行加载三个接口的数据
      const [latestRes, flowRes, efficiencyRes] = await Promise.all([
        fetch('/api/latest'),
        fetch(`/api/flow-analysis?startDate=${flowStartDate}&endDate=${flowEndDate}`),
        fetch(`/api/efficiency-analysis?startDate=${efficiencyStartDate}&endDate=${efficiencyEndDate}`)
      ]);

      if (!latestRes.ok || !flowRes.ok || !efficiencyRes.ok) {
        throw new Error('数据加载失败');
      }

      const [latest, flow, efficiency] = await Promise.all([
        latestRes.json(),
        flowRes.json(),
        efficiencyRes.json()
      ]);

      setLatestData(latest.data);
      setFlowAnalysis(flow.data);
      setEfficiencyAnalysis(efficiency.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }

  // 加载流量分析数据
  async function loadFlowAnalysis() {
    if (!flowStartDate || !flowEndDate) return;
    
    // 验证日期范围不超过30天
    const start = new Date(flowStartDate);
    const end = new Date(flowEndDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
      alert('日期范围不能超过30天');
      return;
    }
    
    if (start > end) {
      alert('开始日期不能晚于结束日期');
      return;
    }
    
    try {
      const response = await fetch(`/api/flow-analysis?startDate=${flowStartDate}&endDate=${flowEndDate}`);
      if (response.ok) {
        const data = await response.json();
        setFlowAnalysis(data.data);
      }
    } catch (err) {
      console.error('加载流量分析数据失败', err);
    }
  }

  // 加载能效分析数据
  async function loadEfficiencyAnalysis() {
    if (!efficiencyStartDate || !efficiencyEndDate) return;
    
    // 验证日期范围不超过30天
    const start = new Date(efficiencyStartDate);
    const end = new Date(efficiencyEndDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
      alert('日期范围不能超过30天');
      return;
    }
    
    if (start > end) {
      alert('开始日期不能晚于结束日期');
      return;
    }
    
    try {
      const response = await fetch(`/api/efficiency-analysis?startDate=${efficiencyStartDate}&endDate=${efficiencyEndDate}`);
      if (response.ok) {
        const data = await response.json();
        setEfficiencyAnalysis(data.data);
      }
    } catch (err) {
      console.error('加载能效分析数据失败', err);
    }
  }

  // 导出报表1
  async function exportFlowReport() {
    try {
      const response = await fetch(`/api/export/flow-analysis?startDate=${flowStartDate}&endDate=${flowEndDate}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `流量数据分时段分析_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出失败');
    }
  }

  // 导出报表2
  async function exportEfficiencyReport() {
    try {
      const response = await fetch(`/api/export/efficiency-analysis?startDate=${efficiencyStartDate}&endDate=${efficiencyEndDate}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `岩湖水厂能效分析_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出失败');
    }
  }

  if (loading && !latestData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-600">错误: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 标题 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">福安数据分析仪表板</h1>
        <p className="text-gray-600 mt-2">实时监控水厂运行数据与能效分析</p>
      </div>

      {/* 最新数据面板 */}
      <LatestDataPanel data={latestData} />

      {/* 数据分析表格 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* 流量数据分时段分析 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">流量数据分时段分析</h2>
            <div className="flex justify-between items-center gap-4">
              <CustomDatePicker
                startDate={flowStartDate}
                endDate={flowEndDate}
                onStartDateChange={setFlowStartDate}
                onEndDateChange={setFlowEndDate}
                onQuery={loadFlowAnalysis}
                maxDays={30}
                color="blue"
                cacheKey="flowDateRange"
              />
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setFlowViewMode(flowViewMode === 'table' ? 'chart' : 'table')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm"
                >
                  {flowViewMode === 'table' ? (
                    <><BarChart3 size={14} /> 图表</>
                  ) : (
                    <><Table size={14} /> 表格</>
                  )}
                </button>
                <button
                  onClick={exportFlowReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
                >
                  <Download size={14} />
                  导出报表
                </button>
              </div>
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {flowViewMode === 'table' ? (
              <FlowAnalysisTable data={flowAnalysis} />
            ) : (
              <FlowAnalysisCharts data={flowAnalysis} />
            )}
          </div>
        </div>

        {/* 岩湖水厂能效分析 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">岩湖水厂能效分析</h2>
            <div className="flex justify-between items-center gap-4">
              <CustomDatePicker
                startDate={efficiencyStartDate}
                endDate={efficiencyEndDate}
                onStartDateChange={setEfficiencyStartDate}
                onEndDateChange={setEfficiencyEndDate}
                onQuery={loadEfficiencyAnalysis}
                maxDays={30}
                color="green"
                cacheKey="efficiencyDateRange"
              />
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setEfficiencyViewMode(efficiencyViewMode === 'table' ? 'chart' : 'table')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm"
                >
                  {efficiencyViewMode === 'table' ? (
                    <><BarChart3 size={14} /> 图表</>
                  ) : (
                    <><Table size={14} /> 表格</>
                  )}
                </button>
                <button
                  onClick={exportEfficiencyReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
                >
                  <Download size={14} />
                  导出报表
                </button>
              </div>
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {efficiencyViewMode === 'table' ? (
              <EfficiencyAnalysisTable data={efficiencyAnalysis} />
            ) : (
              <EfficiencyAnalysisCharts data={efficiencyAnalysis} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
