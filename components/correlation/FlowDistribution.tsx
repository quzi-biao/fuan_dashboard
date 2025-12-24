'use client';

interface FlowDistributionData {
  flow: number;
  count: number;
  frequency: number;
}

interface FlowDistributionProps {
  distribution: FlowDistributionData[];
  groupCount: number;
}

export function FlowDistribution({ distribution, groupCount }: FlowDistributionProps) {
  if (distribution.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">流量分布统计</h2>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
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
        <div className="h-48 flex items-end gap-px">
          {(() => {
            const minFlow = distribution[0].flow;
            const maxFlow = distribution[distribution.length - 1].flow;
            const rangeSize = (maxFlow - minFlow) / groupCount;
            
            const aggregatedData: Array<{ flow: number; count: number; range: string }> = [];
            for (let i = 0; i < groupCount; i++) {
              const groupMin = minFlow + i * rangeSize;
              const groupMax = i === groupCount - 1 ? maxFlow + 1 : minFlow + (i + 1) * rangeSize;
              
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
            
            return aggregatedData.map((d, i) => {
              const heightPx = maxCount > 0 ? (d.count / maxCount) * 192 : 0;
              const isHighest = d.count === maxCount;
              
              return (
                <div key={i} className="flex-1 group relative" style={{ minWidth: '3px' }}>
                  <div
                    className={`w-full rounded-t transition-all ${
                      isHighest 
                        ? 'bg-gradient-to-t from-orange-500 to-orange-400' 
                        : 'bg-gradient-to-t from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500'
                    }`}
                    style={{ height: `${Math.max(heightPx, 3)}px` }}
                  />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    范围: {d.range}<br/>
                    频次: {d.count}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        
        <div className="flex justify-between mt-4 text-xs text-gray-600 font-medium">
          <span>最小: {distribution[0]?.flow}</span>
          <span className="text-gray-500">← 流量分布 ({groupCount} 个分组) →</span>
          <span>最大: {distribution[distribution.length - 1]?.flow}</span>
        </div>
      </div>
    </div>
  );
}
