/**
 * 数据分析工具
 * 包含流量分时段分析和能效分析的逻辑
 */

// 电价时段定义
export const ELECTRICITY_PERIODS = {
  valley: {  // 谷电价 (0:00-8:00)
    ranges: [[0, 8]],
    duration_hours: 8,
    name: '谷'
  },
  flat: {    // 平电价 (8:00-10:00, 12:00-15:00, 20:00-21:00, 22:00-24:00)
    ranges: [[8, 10], [12, 15], [20, 21], [22, 24]],
    duration_hours: 8,
    name: '平'
  },
  peak: {    // 峰电价 (10:00-12:00, 15:00-20:00, 21:00-22:00)
    ranges: [[10, 12], [15, 20], [21, 22]],
    duration_hours: 8,
    name: '峰'
  }
} as const;

export type ElectricityPeriod = keyof typeof ELECTRICITY_PERIODS;

// 根据小时数分类电价时段
export function classifyElectricityPeriod(hour: number): ElectricityPeriod | null {
  for (const [period, config] of Object.entries(ELECTRICITY_PERIODS)) {
    for (const [start, end] of config.ranges) {
      if (hour >= start && hour < end) {
        return period as ElectricityPeriod;
      }
    }
  }
  return null;
}

// 流量数据记录类型
export interface FlowDataRecord {
  collect_time: Date;
  chengdong_flow: number;
  yanhu_flow: number;
  yanhu_pressure?: number;
  yanhu_daily_water?: number;
  yanhu_daily_power?: number;
}

// 流量分时段分析结果
export interface FlowAnalysisResult {
  date: string;
  period: ElectricityPeriod | 'total';
  period_name: string;
  chengdong_avg_flow: number;
  yanhu_avg_flow: number;
  chengdong_cumulative_flow: number;
  yanhu_cumulative_flow: number;
  yanhu_electricity: number;
  total_cumulative_flow: number;
  is_total?: boolean; // 标记是否为总计行
}

// 能效分析结果
export interface EfficiencyAnalysisResult {
  date: string;
  pressure_simple_avg: number;
  pressure_weighted_avg: number;
  pressure_max: number;
  pressure_min: number;
  daily_water_supply: number;
  daily_power_consumption: number;
  power_per_1000t: number;
  power_per_pressure: number;
}

/**
 * 分析流量数据按电价时段
 */
export function analyzeFlowByElectricityPeriod(data: FlowDataRecord[]): FlowAnalysisResult[] {
  const results: FlowAnalysisResult[] = [];
  
  // 按日期分组 - 使用本地日期，与Python的 dt.date 保持一致
  const dataByDate = new Map<string, FlowDataRecord[]>();
  data.forEach(record => {
    // 使用本地日期，与Python的 dt.date 保持一致
    const year = record.collect_time.getFullYear();
    const month = String(record.collect_time.getMonth() + 1).padStart(2, '0');
    const day = String(record.collect_time.getDate()).padStart(2, '0');
    const date = `${year}-${month}-${day}`;
    
    if (!dataByDate.has(date)) {
      dataByDate.set(date, []);
    }
    dataByDate.get(date)!.push(record);
  });
  
  // 分析每一天的每个时段
  dataByDate.forEach((dayData, date) => {
    // 计算全天的总电量（日累计最大值 - 最小值）
    const allPowerValues = dayData
      .map(r => r.yanhu_daily_power)
      .filter((v): v is number => v !== undefined && v !== null);
    const totalDailyElectricity = allPowerValues.length > 0
      ? Math.max(...allPowerValues) - Math.min(...allPowerValues)
      : 0;
    
    // 计算全天的总供水量（日累计最大值 - 最小值）
    const allWaterValues = dayData
      .map(r => r.yanhu_daily_water)
      .filter((v): v is number => v !== undefined && v !== null);
    const totalDailyWater = allWaterValues.length > 0
      ? Math.max(...allWaterValues) - Math.min(...allWaterValues)
      : 0;
    
    // 按电价时段分组
    const periodData = new Map<ElectricityPeriod, FlowDataRecord[]>();
    
    dayData.forEach(record => {
      const hour = record.collect_time.getHours();
      const period = classifyElectricityPeriod(hour);
      if (period) {
        if (!periodData.has(period)) {
          periodData.set(period, []);
        }
        periodData.get(period)!.push(record);
      }
    });
    
    // 计算每个时段的电量和供水量增量，用于按比例分配
    const periodElectricityIncrements = new Map<ElectricityPeriod, number>();
    const periodWaterIncrements = new Map<ElectricityPeriod, number>();
    
    (['valley', 'flat', 'peak'] as ElectricityPeriod[]).forEach(period => {
      const records = periodData.get(period) || [];
      if (records.length > 0) {
        // 电量增量
        const powerValues = records
          .map(r => r.yanhu_daily_power)
          .filter((v): v is number => v !== undefined && v !== null);
        const powerIncrement = powerValues.length > 0
          ? Math.max(...powerValues) - Math.min(...powerValues)
          : 0;
        periodElectricityIncrements.set(period, powerIncrement);
        
        // 供水量增量
        const waterValues = records
          .map(r => r.yanhu_daily_water)
          .filter((v): v is number => v !== undefined && v !== null);
        const waterIncrement = waterValues.length > 0
          ? Math.max(...waterValues) - Math.min(...waterValues)
          : 0;
        periodWaterIncrements.set(period, waterIncrement);
      }
    });
    
    // 计算总增量用于比例分配
    const totalPowerIncrements = Array.from(periodElectricityIncrements.values()).reduce((sum, v) => sum + v, 0);
    const totalWaterIncrements = Array.from(periodWaterIncrements.values()).reduce((sum, v) => sum + v, 0);
    
    // 计算每个时段的统计数据
    const periodResults: FlowAnalysisResult[] = [];
    let totalChengdong = 0;
    let totalYanhu = 0;
    let totalElectricity = 0;
    
    (['valley', 'flat', 'peak'] as ElectricityPeriod[]).forEach(period => {
      const records = periodData.get(period) || [];
      if (records.length > 0) {
        const config = ELECTRICITY_PERIODS[period];
        
        // 计算平均流量（用于显示）
        const chengdongAvg = records.reduce((sum, r) => sum + r.chengdong_flow, 0) / records.length;
        const yanhuAvg = records.reduce((sum, r) => sum + r.yanhu_flow, 0) / records.length;
        
        // 计算城东累积流量 = 平均流量 × 时段时长
        const chengdongCumulative = chengdongAvg * config.duration_hours;
        
        // 按比例分配岩湖供水量：时段供水量 = 总供水量 × (时段增量 / 总增量)
        const waterIncrement = periodWaterIncrements.get(period) || 0;
        const yanhuCumulative = totalWaterIncrements > 0
          ? (totalDailyWater * waterIncrement / totalWaterIncrements)
          : 0;
        
        // 按比例分配电量：时段电量 = 总电量 × (时段增量 / 总增量)
        const powerIncrement = periodElectricityIncrements.get(period) || 0;
        const yanhuElectricity = totalPowerIncrements > 0
          ? (totalDailyElectricity * powerIncrement / totalPowerIncrements)
          : 0;
        
        // 累加到总计
        totalChengdong += chengdongCumulative;
        totalYanhu += yanhuCumulative;
        totalElectricity += yanhuElectricity;
        
        periodResults.push({
          date,
          period,
          period_name: config.name,
          chengdong_avg_flow: chengdongAvg,
          yanhu_avg_flow: yanhuAvg,
          chengdong_cumulative_flow: chengdongCumulative,
          yanhu_cumulative_flow: yanhuCumulative,
          yanhu_electricity: yanhuElectricity,
          total_cumulative_flow: chengdongCumulative + yanhuCumulative
        });
      }
    });
    
    // 添加时段结果
    results.push(...periodResults);
    
    // 添加总计行
    if (periodResults.length > 0) {
      results.push({
        date,
        period: 'total',
        period_name: '总计',
        chengdong_avg_flow: 0, // 总计行不显示平均值
        yanhu_avg_flow: 0,
        chengdong_cumulative_flow: totalChengdong,
        yanhu_cumulative_flow: totalYanhu,
        yanhu_electricity: totalElectricity,
        total_cumulative_flow: totalChengdong + totalYanhu,
        is_total: true
      });
    }
  });
  
  return results;
}

/**
 * 分析岩湖水厂能效
 */
export function analyzeEfficiency(data: FlowDataRecord[]): EfficiencyAnalysisResult[] {
  const results: EfficiencyAnalysisResult[] = [];
  
  // 按日期分组 - 使用本地日期，不使用ISO字符串
  const dataByDate = new Map<string, FlowDataRecord[]>();
  data.forEach(record => {
    // 使用本地日期，与Python的 dt.date 保持一致
    const year = record.collect_time.getFullYear();
    const month = String(record.collect_time.getMonth() + 1).padStart(2, '0');
    const day = String(record.collect_time.getDate()).padStart(2, '0');
    const date = `${year}-${month}-${day}`;
    
    if (!dataByDate.has(date)) {
      dataByDate.set(date, []);
    }
    dataByDate.get(date)!.push(record);
  });
  
  // 计算每日能效指标
  const dates = Array.from(dataByDate.keys()).sort();
  
  // 先计算所有日期的 i_1072 和 i_1073 最大值
  const dailyMaxValues = new Map<string, { water: number; power: number }>();
  dates.forEach(date => {
    const dayData = dataByDate.get(date)!;
    
    const waterValues = dayData
      .map(r => r.yanhu_daily_water)
      .filter((v): v is number => v !== undefined && v !== null);
    const powerValues = dayData
      .map(r => r.yanhu_daily_power)
      .filter((v): v is number => v !== undefined && v !== null);
    
    dailyMaxValues.set(date, {
      water: waterValues.length > 0 ? Math.max(...waterValues) : 0,
      power: powerValues.length > 0 ? Math.max(...powerValues) : 0
    });
  });
  
  dates.forEach((date, index) => {
    const dayData = dataByDate.get(date)!;
    
    // 过滤有效数据
    const validData = dayData.filter(r => 
      r.yanhu_pressure !== undefined && 
      r.yanhu_pressure > 0 && 
      r.yanhu_pressure < 10 &&
      r.yanhu_flow > 0 && 
      r.yanhu_flow < 10000
    );
    
    if (validData.length === 0) return;
    
    // 计算压力统计
    const pressures = validData.map(r => r.yanhu_pressure!);
    const pressureSimpleAvg = pressures.reduce((sum, p) => sum + p, 0) / pressures.length;
    const pressureMax = Math.max(...pressures);
    const pressureMin = Math.min(...pressures);
    
    // 计算加权平均压力
    const weightedSum = validData.reduce((sum, r) => sum + r.yanhu_pressure! * r.yanhu_flow, 0);
    const flowSum = validData.reduce((sum, r) => sum + r.yanhu_flow, 0);
    const pressureWeightedAvg = weightedSum / flowSum;
    
    // 获取日供水量和日耗电量（使用下一天的数据，因为有偏移）
    // Python: daily_stats['i_1072_adjusted'] = daily_stats['i_1072_max'].shift(-1)
    // 只有当有下一天数据时才添加结果
    if (index < dates.length - 1) {
      const nextDate = dates[index + 1];
      const nextDayMax = dailyMaxValues.get(nextDate);
      if (nextDayMax) {
        const dailyWater = nextDayMax.water;
        const dailyPower = nextDayMax.power;
        
        // 计算能效指标
        // Python公式: i_1072_adjusted / i_1073_adjusted * 1000 (水量/电量)
        const powerPer1000t = dailyPower > 0 ? (dailyWater / dailyPower * 1000) : 0;
        const powerPerPressure = pressureWeightedAvg > 0 ? (powerPer1000t / pressureWeightedAvg) : 0;
        
        results.push({
          date: nextDate,
          pressure_simple_avg: pressureSimpleAvg,
          pressure_weighted_avg: pressureWeightedAvg,
          pressure_max: pressureMax,
          pressure_min: pressureMin,
          daily_water_supply: dailyWater,
          daily_power_consumption: dailyPower,
          power_per_1000t: powerPer1000t,
          power_per_pressure: powerPerPressure
        });
      }
    }
  });
  
  return results;
}
