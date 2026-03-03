const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'gz-cdb-e3z4b5ql.sql.tencentcdb.com',
  port: 63453,
  user: 'root',
  password: 'zsj12345678',
  database: 'fuan_data',
};

async function setupTable() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS \`energy_saving_analysis\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`year_month\` VARCHAR(7) NOT NULL COMMENT '年月',
        \`orig_daily_water_supply\` DECIMAL(10, 2) COMMENT '日均供水量-原始统计值',
        \`orig_avg_pressure\` DECIMAL(10, 4) COMMENT '平均送水压力-原始统计值',
        \`orig_daily_power_consumption\` DECIMAL(10, 2) COMMENT '日均用电量-原始统计值',
        \`orig_peak_ratio\` DECIMAL(10, 4) COMMENT '峰时供水量占比-原始统计值',
        \`orig_valley_ratio\` DECIMAL(10, 4) COMMENT '谷时供水量占比-原始统计值',
        \`orig_flat_ratio\` DECIMAL(10, 4) COMMENT '平时供水量占比-原始统计值',
        \`orig_spike_ratio\` DECIMAL(10, 4) COMMENT '尖峰供水量占比-原始统计值',
        \`daily_water_supply\` DECIMAL(10, 2) COMMENT '日均供水量-最终值',
        \`avg_pressure\` DECIMAL(10, 4) COMMENT '平均送水压力-最终值',
        \`daily_power_consumption\` DECIMAL(10, 2) COMMENT '日均用电量-最终值',
        \`peak_ratio\` DECIMAL(10, 4) DEFAULT 0 COMMENT '峰时供水量占比-最终值',
        \`valley_ratio\` DECIMAL(10, 4) DEFAULT 0 COMMENT '谷时供水量占比-最终值',
        \`flat_ratio\` DECIMAL(10, 4) DEFAULT 0 COMMENT '平时供水量占比-最终值',
        \`spike_ratio\` DECIMAL(10, 4) DEFAULT 0 COMMENT '尖峰供水量占比-最终值',
        \`comprehensive_price\` DECIMAL(10, 4) COMMENT '综合电单价',
        \`water_supply_cost\` DECIMAL(10, 4) COMMENT '送水电费',
        \`daily_power_per_kt\` DECIMAL(10, 2) COMMENT '日均电耗',
        \`power_per_kt_mpa\` DECIMAL(10, 2) COMMENT '千吨水Mpa电耗',
        \`pump_efficiency\` DECIMAL(10, 4) COMMENT '泵组综合效率',
        \`annual_savings\` DECIMAL(10, 2) COMMENT '年节省电费',
        \`power_per_kt_saving_rate\` DECIMAL(10, 4) COMMENT '电耗节能率',
        \`power_per_kt_mpa_saving_rate\` DECIMAL(10, 4) COMMENT '千吨水Mpa电耗节能率',
        \`pump_efficiency_saving_rate\` DECIMAL(10, 4) COMMENT '泵组综合效率节能率',
        \`comprehensive_price_saving_rate\` DECIMAL(10, 4) COMMENT '综合电单价节能率',
        \`water_supply_cost_saving_rate\` DECIMAL(10, 4) COMMENT '送水电费节能率',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`unique_year_month\` (\`year_month\`),
        INDEX \`idx_year_month\` (\`year_month\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岩湖水厂节能改造效益分析'
    `;

    await connection.query(createTableSQL);
    console.log('Table created successfully');

    const [rows] = await connection.query('SHOW TABLES LIKE "energy_saving_analysis"');
    if (rows.length > 0) {
      console.log('✓ Table energy_saving_analysis exists');
      
      const [columns] = await connection.query('DESCRIBE energy_saving_analysis');
      console.log('\nTable structure:');
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

setupTable();
