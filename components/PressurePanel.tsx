'use client';

import React, { useState } from 'react';
import { Gauge, Download } from 'lucide-react';
import { PressureHistoryDialog } from './PressureHistoryDialog';
import { PressureExportDialog } from './PressureExportDialog';

interface PressureData {
  sn: string;
  label: string;
  pressure: number;
  collect_time: string;
}

interface PressurePanelProps {
  data: PressureData[];
  collectTime: string;
}

export function PressurePanel({ data, collectTime }: PressurePanelProps) {
  const [selectedMeter, setSelectedMeter] = useState<{ sn: string; label: string } | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  const handleMeterClick = (sn: string, label: string) => {
    setSelectedMeter({ sn, label });
  };
  
  const getPressureColor = (pressure: number | string) => {
    const p = Number(pressure || 0);
    if (p === 0) return 'text-gray-400';
    // if (p < 0.2) return 'text-red-600';
    // if (p < 0.3) return 'text-yellow-600';
    return 'text-green-600';
  };
  
  const getPressureStatus = (pressure: number | string) => {
    const p = Number(pressure || 0);
    if (p === 0) return '无数据';
    //if (p < 0.2) return '偏低';
    return '正常';
  };
  
  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">末端压力数据</h2>
            <p className="text-sm text-gray-500 mt-1">
              更新时间: {new Date(collectTime).toLocaleString('zh-CN')}
            </p>
          </div>
          <button
            onClick={() => setShowExportDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
          >
            <Download size={14} />
            导出数据
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {data.map((meter) => (
            <button
              key={meter.sn}
              onClick={() => handleMeterClick(meter.sn, meter.label)}
              className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 hover:shadow-lg transition-all border border-blue-200 hover:border-blue-400 text-left"
            >
              <div className="flex items-center gap-2 mb-2">
                <Gauge size={18} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">{meter.label}</span>
              </div>
              
              <div className={`text-2xl font-bold ${getPressureColor(meter.pressure)}`}>
                {Number(meter.pressure || 0).toFixed(3)}
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-600">MPa</span>
                <span className={`text-xs font-medium ${getPressureColor(meter.pressure)}`}>
                  {getPressureStatus(meter.pressure)}
                </span>
              </div>
            </button>
          ))}
        </div>
        
        {data.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            暂无压力数据
          </div>
        )}
      </div>
      
      {/* 历史数据对话框 */}
      {selectedMeter && (
        <PressureHistoryDialog
          isOpen={!!selectedMeter}
          onClose={() => setSelectedMeter(null)}
          sn={selectedMeter.sn}
          label={selectedMeter.label}
        />
      )}
      
      {/* 导出对话框 */}
      <PressureExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
    </>
  );
}
