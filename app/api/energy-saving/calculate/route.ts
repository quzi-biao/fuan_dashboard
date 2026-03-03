import { NextRequest, NextResponse } from 'next/server';
import { getDataByDateRange } from '@/lib/db';
import { analyzeFlowByElectricityPeriod, analyzeEfficiency } from '@/lib/analysis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearMonth = searchParams.get('yearMonth');
    
    if (!yearMonth) {
      return NextResponse.json(
        { success: false, error: '缺少年月参数' },
        { status: 400 }
      );
    }
    
    const [year, month] = yearMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    const rawData = await getDataByDateRange(startDate, endDate);
    
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          daily_water_supply: 0,
          avg_pressure: 0,
          daily_power_consumption: 0,
          peak_ratio: 0,
          valley_ratio: 0,
          flat_ratio: 0,
          spike_ratio: 0,
        }
      });
    }
    
    const data = rawData.map(row => ({
      collect_time: new Date(row.collect_time),
      chengdong_flow: Number(row.chengdong_flow),
      yanhu_flow: Number(row.yanhu_flow),
      yanhu_pressure: row.yanhu_pressure ? Number(row.yanhu_pressure) : undefined,
      yanhu_daily_water: row.yanhu_daily_power ? Number(row.yanhu_daily_power) : undefined,
      yanhu_daily_power: row.yanhu_daily_water ? Number(row.yanhu_daily_water) : undefined,
    }));
    
    const flowAnalysis = analyzeFlowByElectricityPeriod(data);
    const efficiencyAnalysis = analyzeEfficiency(data);
    
    let totalWaterSupply = 0;
    let totalPowerConsumption = 0;
    let totalPressure = 0;
    let validDays = 0;
    
    efficiencyAnalysis.forEach(day => {
      if (day.daily_water_supply > 0) {
        totalWaterSupply += day.daily_water_supply;
        totalPowerConsumption += day.daily_power_consumption;
        totalPressure += day.pressure_weighted_avg;
        validDays++;
      }
    });
    
    const avgWaterSupply = validDays > 0 ? totalWaterSupply / validDays : 0;
    const avgPowerConsumption = validDays > 0 ? totalPowerConsumption / validDays : 0;
    const avgPressure = validDays > 0 ? totalPressure / validDays : 0;
    
    const totalRows = flowAnalysis.filter(row => row.is_total);
    let totalPeakWater = 0;
    let totalValleyWater = 0;
    let totalFlatWater = 0;
    let totalSpikeWater = 0;
    let totalAllWater = 0;
    
    flowAnalysis.forEach(row => {
      if (!row.is_total) {
        const water = row.yanhu_cumulative_flow;
        totalAllWater += water;
        
        if (row.period === 'peak') totalPeakWater += water;
        else if (row.period === 'valley') totalValleyWater += water;
        else if (row.period === 'flat') totalFlatWater += water;
      }
    });
    
    const peakRatio = totalAllWater > 0 ? totalPeakWater / totalAllWater : 0;
    const valleyRatio = totalAllWater > 0 ? totalValleyWater / totalAllWater : 0;
    const flatRatio = totalAllWater > 0 ? totalFlatWater / totalAllWater : 0;
    const spikeRatio = 0;
    
    return NextResponse.json({
      success: true,
      data: {
        daily_water_supply: Number(avgWaterSupply.toFixed(2)),
        avg_pressure: Number(avgPressure.toFixed(4)),
        daily_power_consumption: Number(avgPowerConsumption.toFixed(2)),
        peak_ratio: Number(peakRatio.toFixed(4)),
        valley_ratio: Number(valleyRatio.toFixed(4)),
        flat_ratio: Number(flatRatio.toFixed(4)),
        spike_ratio: Number(spikeRatio.toFixed(4)),
      }
    });
  } catch (error) {
    console.error('计算月度数据失败:', error);
    return NextResponse.json(
      { success: false, error: '计算失败' },
      { status: 500 }
    );
  }
}
