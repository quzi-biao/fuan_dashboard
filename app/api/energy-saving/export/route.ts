import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import ExcelJS from 'exceljs';

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
      'SELECT * FROM `energy_saving_analysis` ORDER BY `year_month` ASC'
    );

    // Convert units to match frontend display
    const convertedRows = rows.map((row: any) => ({
      ...row,
      daily_water_supply: row.daily_water_supply ? Number(row.daily_water_supply) / 1000 : null,
      peak_ratio: row.peak_ratio ? Number(row.peak_ratio) * 100 : null,
      valley_ratio: row.valley_ratio ? Number(row.valley_ratio) * 100 : null,
      flat_ratio: row.flat_ratio ? Number(row.flat_ratio) * 100 : null,
      spike_ratio: row.spike_ratio ? Number(row.spike_ratio) * 100 : null,
    }));

    const metrics = [
      { name: '日均供水量(kt/d)', baseline: BASELINE.daily_water_supply, field: 'daily_water_supply', hasRate: false, isPercentage: false },
      { name: '平均送水压力(Mpa)', baseline: BASELINE.avg_pressure, field: 'avg_pressure', hasRate: false, isPercentage: false },
      { name: '日均用电量(kw*h)', baseline: '-', field: 'daily_power_consumption', hasRate: false, isPercentage: false },
      { name: '日均电耗(kw*h/kt)', baseline: BASELINE.daily_power_per_kt, field: 'daily_power_per_kt', hasRate: true, rateField: 'power_per_kt_saving_rate', isPercentage: false },
      { name: '千吨水Mpa电耗(kw*h/kt.Mpa)', baseline: BASELINE.power_per_kt_mpa, field: 'power_per_kt_mpa', hasRate: true, rateField: 'power_per_kt_mpa_saving_rate', isPercentage: false },
      { name: '泵组综合效率(%)', baseline: BASELINE.pump_efficiency, field: 'pump_efficiency', hasRate: true, rateField: 'pump_efficiency_saving_rate', isPercentage: true },
      { name: '综合电单价(元/kw*h)', baseline: BASELINE.comprehensive_price, field: 'comprehensive_price', hasRate: true, rateField: 'comprehensive_price_saving_rate', isPercentage: false },
      { name: '峰时占比(%)', baseline: '-', field: 'peak_ratio', hasRate: false, isPercentage: true },
      { name: '谷时占比(%)', baseline: '-', field: 'valley_ratio', hasRate: false, isPercentage: true },
      { name: '平时占比(%)', baseline: '-', field: 'flat_ratio', hasRate: false, isPercentage: true },
      { name: '尖峰占比(%)', baseline: '-', field: 'spike_ratio', hasRate: false, isPercentage: true },
      { name: '送水电费(元/t)', baseline: BASELINE.water_supply_cost, field: 'water_supply_cost', hasRate: true, rateField: 'water_supply_cost_saving_rate', isPercentage: false },
      { name: '年节省电费(万元/年)', baseline: '-', field: 'annual_savings', hasRate: false, isPercentage: false },
    ];

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('节能分析');

    // Create header row 1: month names
    const headerRow1 = worksheet.addRow(['指标名称', '基准值']);
    convertedRows.forEach(row => {
      headerRow1.getCell(headerRow1.cellCount + 1).value = row.year_month;
      headerRow1.getCell(headerRow1.cellCount + 1).value = '';
    });

    // Create header row 2: actual value and saving rate
    const headerRow2 = worksheet.addRow(['', '']);
    convertedRows.forEach(() => {
      headerRow2.getCell(headerRow2.cellCount + 1).value = '实际值';
      headerRow2.getCell(headerRow2.cellCount + 1).value = '节能率';
    });

    // Merge cells for month names
    let colIndex = 3;
    convertedRows.forEach(() => {
      worksheet.mergeCells(1, colIndex, 1, colIndex + 1);
      colIndex += 2;
    });

    // Add data rows
    metrics.forEach(metric => {
      const row = worksheet.addRow([metric.name, metric.baseline]);
      
      convertedRows.forEach(monthData => {
        const value = monthData[metric.field];
        if (value !== null && value !== undefined) {
          const formattedValue = metric.isPercentage 
            ? `${Number(value).toFixed(2)}%` 
            : Number(value).toFixed(4);
          row.getCell(row.cellCount + 1).value = formattedValue;
        } else {
          row.getCell(row.cellCount + 1).value = '-';
        }

        // Add saving rate column
        if (metric.hasRate && metric.rateField) {
          const rate = monthData[metric.rateField];
          row.getCell(row.cellCount + 1).value = rate !== null && rate !== undefined ? `${Number(rate).toFixed(2)}%` : '/';
        } else {
          row.getCell(row.cellCount + 1).value = '/';
        }
      });
    });

    // Apply borders and styling to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        
        // Header rows styling
        if (rowNumber <= 2) {
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' }
          };
        }
      });
    });

    // Set column widths
    worksheet.getColumn(1).width = 25;
    worksheet.getColumn(2).width = 12;
    for (let i = 3; i <= 2 + convertedRows.length * 2; i++) {
      worksheet.getColumn(i).width = 12;
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="energy_saving_analysis_${new Date().toISOString().split('T')[0]}.xlsx"`,
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
