import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

const BASELINE = {
  daily_water_supply: 37.8,
  avg_pressure: 0.461,
  daily_power_per_kt: 176.21,
  power_per_kt_mpa: 382.23,
  pump_efficiency: 72.64,
  comprehensive_price: 0.77,
  water_supply_cost: 0.1357,
};

function calculateMetrics(data: any) {
  const actualWaterSupply = data.daily_water_supply /1000 || 0;
  const actualPowerConsumption = data.daily_power_consumption || 0;
  
  const dailyPowerPerKt = actualWaterSupply > 0 
    ? actualPowerConsumption / actualWaterSupply 
    : 0;
  
  const powerPerKtMpa = data.avg_pressure > 0 
    ? dailyPowerPerKt / data.avg_pressure 
    : 0;
  
  const pumpEfficiency = dailyPowerPerKt > 0 
    ? ((0.278 * data.avg_pressure * 1000) / dailyPowerPerKt) * 100
    : 0;
  
  const annualSavings = (data.water_supply_cost !== null && data.water_supply_cost !== undefined)
    ? (BASELINE.water_supply_cost - data.water_supply_cost) * 3.78 * 365
    : null;
  
  const powerPerKtSavingRate = Math.max(-9999, Math.min(9999, ((BASELINE.daily_power_per_kt - dailyPowerPerKt) / BASELINE.daily_power_per_kt) * 100));
  const powerPerKtMpaSavingRate = Math.max(-9999, Math.min(9999, ((BASELINE.power_per_kt_mpa - powerPerKtMpa) / BASELINE.power_per_kt_mpa) * 100));
  const pumpEfficiencySavingRate = Math.max(-9999, Math.min(9999, ((pumpEfficiency - BASELINE.pump_efficiency) / BASELINE.pump_efficiency) * 100));
  
  const comprehensivePriceSavingRate = (data.comprehensive_price !== null && data.comprehensive_price !== undefined)
    ? ((BASELINE.comprehensive_price - data.comprehensive_price) / BASELINE.comprehensive_price) * 100
    : null;
  
  const waterSupplyCostSavingRate = (data.water_supply_cost !== null && data.water_supply_cost !== undefined)
    ? ((BASELINE.water_supply_cost - data.water_supply_cost) / BASELINE.water_supply_cost) * 100
    : null;
  
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

export async function GET() {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM `energy_saving_analysis` ORDER BY `year_month` DESC'
    );
    
    const convertedData = rows.map(row => ({
      ...row,
      orig_daily_water_supply: row.orig_daily_water_supply ? Number(row.orig_daily_water_supply) / 1000 : null,
      orig_avg_pressure: row.orig_avg_pressure ? Number(row.orig_avg_pressure) : null,
      orig_daily_power_consumption: row.orig_daily_power_consumption ? Number(row.orig_daily_power_consumption) : null,
      orig_peak_ratio: row.orig_peak_ratio ? Number(row.orig_peak_ratio) * 100 : null,
      orig_valley_ratio: row.orig_valley_ratio ? Number(row.orig_valley_ratio) * 100 : null,
      orig_flat_ratio: row.orig_flat_ratio ? Number(row.orig_flat_ratio) * 100 : null,
      orig_spike_ratio: row.orig_spike_ratio ? Number(row.orig_spike_ratio) * 100 : null,
      daily_water_supply: row.daily_water_supply ? Number(row.daily_water_supply) / 1000 : null,
      avg_pressure: row.avg_pressure ? Number(row.avg_pressure) : null,
      daily_power_consumption: row.daily_power_consumption ? Number(row.daily_power_consumption) : null,
      peak_ratio: row.peak_ratio ? Number(row.peak_ratio) * 100 : null,
      valley_ratio: row.valley_ratio ? Number(row.valley_ratio) * 100 : null,
      flat_ratio: row.flat_ratio ? Number(row.flat_ratio) * 100 : null,
      spike_ratio: row.spike_ratio ? Number(row.spike_ratio) * 100 : null,
      comprehensive_price: row.comprehensive_price ? Number(row.comprehensive_price) : null,
      water_supply_cost: row.water_supply_cost ? Number(row.water_supply_cost) : null,
      daily_power_per_kt: row.daily_power_per_kt ? Number(row.daily_power_per_kt) : null,
      power_per_kt_mpa: row.power_per_kt_mpa ? Number(row.power_per_kt_mpa) : null,
      pump_efficiency: row.pump_efficiency ? Number(row.pump_efficiency) : null,
      annual_savings: row.annual_savings ? Number(row.annual_savings) : null,
      power_per_kt_saving_rate: row.power_per_kt_saving_rate ? Number(row.power_per_kt_saving_rate) : null,
      power_per_kt_mpa_saving_rate: row.power_per_kt_mpa_saving_rate ? Number(row.power_per_kt_mpa_saving_rate) : null,
      pump_efficiency_saving_rate: row.pump_efficiency_saving_rate ? Number(row.pump_efficiency_saving_rate) : null,
      comprehensive_price_saving_rate: row.comprehensive_price_saving_rate ? Number(row.comprehensive_price_saving_rate) : null,
      water_supply_cost_saving_rate: row.water_supply_cost_saving_rate ? Number(row.water_supply_cost_saving_rate) : null,
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: convertedData || [],
      baseline: BASELINE
    });
  } catch (error: any) {
    console.error('获取节能分析数据失败:', error);
    return NextResponse.json(
      { success: false, error: error?.message || '获取数据失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year_month, orig_values, ...data } = body;
    
    const calculated = calculateMetrics(data);
    
    const pool = getPool();
    
    if (orig_values) {
      await pool.query(
        `INSERT INTO \`energy_saving_analysis\` (
          \`year_month\`,
          \`orig_daily_water_supply\`, \`orig_avg_pressure\`, \`orig_daily_power_consumption\`,
          \`orig_peak_ratio\`, \`orig_valley_ratio\`, \`orig_flat_ratio\`, \`orig_spike_ratio\`,
          \`daily_water_supply\`, \`avg_pressure\`, \`daily_power_consumption\`,
          \`peak_ratio\`, \`valley_ratio\`, \`flat_ratio\`, \`spike_ratio\`,
          \`comprehensive_price\`, \`water_supply_cost\`,
          \`daily_power_per_kt\`, \`power_per_kt_mpa\`, \`pump_efficiency\`, \`annual_savings\`,
          \`power_per_kt_saving_rate\`, \`power_per_kt_mpa_saving_rate\`,
          \`pump_efficiency_saving_rate\`, \`comprehensive_price_saving_rate\`,
          \`water_supply_cost_saving_rate\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          \`daily_water_supply\` = VALUES(\`daily_water_supply\`),
          \`avg_pressure\` = VALUES(\`avg_pressure\`),
          \`daily_power_consumption\` = VALUES(\`daily_power_consumption\`),
          \`peak_ratio\` = VALUES(\`peak_ratio\`),
          \`valley_ratio\` = VALUES(\`valley_ratio\`),
          \`flat_ratio\` = VALUES(\`flat_ratio\`),
          \`spike_ratio\` = VALUES(\`spike_ratio\`),
          \`comprehensive_price\` = VALUES(\`comprehensive_price\`),
          \`water_supply_cost\` = VALUES(\`water_supply_cost\`),
          \`daily_power_per_kt\` = VALUES(\`daily_power_per_kt\`),
          \`power_per_kt_mpa\` = VALUES(\`power_per_kt_mpa\`),
          \`pump_efficiency\` = VALUES(\`pump_efficiency\`),
          \`annual_savings\` = VALUES(\`annual_savings\`),
          \`power_per_kt_saving_rate\` = VALUES(\`power_per_kt_saving_rate\`),
          \`power_per_kt_mpa_saving_rate\` = VALUES(\`power_per_kt_mpa_saving_rate\`),
          \`pump_efficiency_saving_rate\` = VALUES(\`pump_efficiency_saving_rate\`),
          \`comprehensive_price_saving_rate\` = VALUES(\`comprehensive_price_saving_rate\`),
          \`water_supply_cost_saving_rate\` = VALUES(\`water_supply_cost_saving_rate\`)`,
        [
          year_month,
          orig_values.daily_water_supply,
          orig_values.avg_pressure,
          orig_values.daily_power_consumption,
          orig_values.peak_ratio || 0,
          orig_values.valley_ratio || 0,
          orig_values.flat_ratio || 0,
          orig_values.spike_ratio || 0,
          data.daily_water_supply,
          data.avg_pressure,
          data.daily_power_consumption,
          data.peak_ratio || 0,
          data.valley_ratio || 0,
          data.flat_ratio || 0,
          data.spike_ratio || 0,
          data.comprehensive_price,
          data.water_supply_cost,
          calculated.daily_power_per_kt,
          calculated.power_per_kt_mpa,
          calculated.pump_efficiency,
          calculated.annual_savings,
          calculated.power_per_kt_saving_rate,
          calculated.power_per_kt_mpa_saving_rate,
          calculated.pump_efficiency_saving_rate,
          calculated.comprehensive_price_saving_rate,
          calculated.water_supply_cost_saving_rate,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO \`energy_saving_analysis\` (
          \`year_month\`,
          \`daily_water_supply\`, \`avg_pressure\`, \`daily_power_consumption\`,
          \`peak_ratio\`, \`valley_ratio\`, \`flat_ratio\`, \`spike_ratio\`,
          \`comprehensive_price\`, \`water_supply_cost\`,
          \`daily_power_per_kt\`, \`power_per_kt_mpa\`, \`pump_efficiency\`, \`annual_savings\`,
          \`power_per_kt_saving_rate\`, \`power_per_kt_mpa_saving_rate\`,
          \`pump_efficiency_saving_rate\`, \`comprehensive_price_saving_rate\`,
          \`water_supply_cost_saving_rate\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          \`daily_water_supply\` = VALUES(\`daily_water_supply\`),
          \`avg_pressure\` = VALUES(\`avg_pressure\`),
          \`daily_power_consumption\` = VALUES(\`daily_power_consumption\`),
          \`peak_ratio\` = VALUES(\`peak_ratio\`),
          \`valley_ratio\` = VALUES(\`valley_ratio\`),
          \`flat_ratio\` = VALUES(\`flat_ratio\`),
          \`spike_ratio\` = VALUES(\`spike_ratio\`),
          \`comprehensive_price\` = VALUES(\`comprehensive_price\`),
          \`water_supply_cost\` = VALUES(\`water_supply_cost\`),
          \`daily_power_per_kt\` = VALUES(\`daily_power_per_kt\`),
          \`power_per_kt_mpa\` = VALUES(\`power_per_kt_mpa\`),
          \`pump_efficiency\` = VALUES(\`pump_efficiency\`),
          \`annual_savings\` = VALUES(\`annual_savings\`),
          \`power_per_kt_saving_rate\` = VALUES(\`power_per_kt_saving_rate\`),
          \`power_per_kt_mpa_saving_rate\` = VALUES(\`power_per_kt_mpa_saving_rate\`),
          \`pump_efficiency_saving_rate\` = VALUES(\`pump_efficiency_saving_rate\`),
          \`comprehensive_price_saving_rate\` = VALUES(\`comprehensive_price_saving_rate\`),
          \`water_supply_cost_saving_rate\` = VALUES(\`water_supply_cost_saving_rate\`)`,
        [
          year_month,
          data.daily_water_supply,
          data.avg_pressure,
          data.daily_power_consumption,
          data.peak_ratio || 0,
          data.valley_ratio || 0,
          data.flat_ratio || 0,
          data.spike_ratio || 0,
          data.comprehensive_price,
          data.water_supply_cost,
          calculated.daily_power_per_kt,
          calculated.power_per_kt_mpa,
          calculated.pump_efficiency,
          calculated.annual_savings,
          calculated.power_per_kt_saving_rate,
          calculated.power_per_kt_mpa_saving_rate,
          calculated.pump_efficiency_saving_rate,
          calculated.comprehensive_price_saving_rate,
          calculated.water_supply_cost_saving_rate,
        ]
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存节能分析数据失败:', error);
    return NextResponse.json(
      { success: false, error: '保存数据失败' },
      { status: 500 }
    );
  }
}
