import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM energy_saving_analysis ORDER BY year_month ASC'
    );

    const headers = [
      '指标名称',
      '基准值',
      ...rows.map(row => row.year_month)
    ];

    const metrics = [
      { name: '日均供水量(kt/d)', baseline: BASELINE.daily_water_supply, field: 'daily_water_supply', hasRate: false },
      { name: '平均送水压力(Mpa)', baseline: BASELINE.avg_pressure, field: 'avg_pressure', hasRate: false },
      { name: '日均用电量(kw*h)', baseline: '-', field: 'daily_power_consumption', hasRate: false },
      { name: '日均电耗(kw*h/kt)', baseline: BASELINE.daily_power_per_kt, field: 'daily_power_per_kt', hasRate: true, rateField: 'power_per_kt_saving_rate' },
      { name: '千吨水Mpa电耗(kw*h/kt.Mpa)', baseline: BASELINE.power_per_kt_mpa, field: 'power_per_kt_mpa', hasRate: true, rateField: 'power_per_kt_mpa_saving_rate' },
      { name: '泵组综合效率(%)', baseline: BASELINE.pump_efficiency, field: 'pump_efficiency', hasRate: true, rateField: 'pump_efficiency_saving_rate' },
      { name: '综合电单价(元/kw*h)', baseline: BASELINE.comprehensive_price, field: 'comprehensive_price', hasRate: true, rateField: 'comprehensive_price_saving_rate' },
      { name: '峰时占比', baseline: '-', field: 'peak_ratio', hasRate: false },
      { name: '谷时占比', baseline: '-', field: 'valley_ratio', hasRate: false },
      { name: '平时占比', baseline: '-', field: 'flat_ratio', hasRate: false },
      { name: '尖峰占比', baseline: '-', field: 'spike_ratio', hasRate: false },
      { name: '送水电费(元/t)', baseline: BASELINE.water_supply_cost, field: 'water_supply_cost', hasRate: true, rateField: 'water_supply_cost_saving_rate' },
      { name: '年节省电费(万元/年)', baseline: '-', field: 'annual_savings', hasRate: false },
    ];

    let csvContent = headers.join(',') + '\n';

    metrics.forEach(metric => {
      const actualRow = [metric.name, metric.baseline];
      rows.forEach(row => {
        const value = row[metric.field];
        actualRow.push(value !== null && value !== undefined ? value : '-');
      });
      csvContent += actualRow.join(',') + '\n';

      if (metric.hasRate && metric.rateField) {
        const rateRow = [metric.name + ' (节能率)', '-'];
        rows.forEach(row => {
          const rate = row[metric.rateField];
          rateRow.push(rate !== null && rate !== undefined ? `${Number(rate).toFixed(2)}%` : '-');
        });
        csvContent += rateRow.join(',') + '\n';
      }
    });

    const buffer = Buffer.from('\uFEFF' + csvContent, 'utf-8');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="energy_saving_analysis_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('导出节能分析数据失败:', error);
    return NextResponse.json(
      { success: false, error: '导出失败' },
      { status: 500 }
    );
  }
}
