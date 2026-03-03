-- 岩湖水厂节能改造效益分析数据表
CREATE TABLE IF NOT EXISTS energy_saving_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year_month VARCHAR(7) NOT NULL COMMENT '年月 (YYYY-MM)',
  
  -- 原始统计值（从数据库计算得出，不可修改）
  orig_daily_water_supply DECIMAL(10, 2) COMMENT '日均供水量-原始统计值(kt/d)',
  orig_avg_pressure DECIMAL(10, 4) COMMENT '平均送水压力-原始统计值(Mpa)',
  orig_daily_power_consumption DECIMAL(10, 2) COMMENT '日均用电量-原始统计值(kw*h)',
  orig_peak_ratio DECIMAL(10, 4) COMMENT '峰时供水量占比-原始统计值',
  orig_valley_ratio DECIMAL(10, 4) COMMENT '谷时供水量占比-原始统计值',
  orig_flat_ratio DECIMAL(10, 4) COMMENT '平时供水量占比-原始统计值',
  orig_spike_ratio DECIMAL(10, 4) COMMENT '尖峰供水量占比-原始统计值',
  
  -- 最终值（默认等于原始统计值，用户可修改）
  daily_water_supply DECIMAL(10, 2) COMMENT '日均供水量-最终值(kt/d)',
  avg_pressure DECIMAL(10, 4) COMMENT '平均送水压力-最终值(Mpa)',
  daily_power_consumption DECIMAL(10, 2) COMMENT '日均用电量-最终值(kw*h)',
  peak_ratio DECIMAL(10, 4) DEFAULT 0 COMMENT '峰时供水量占比-最终值',
  valley_ratio DECIMAL(10, 4) DEFAULT 0 COMMENT '谷时供水量占比-最终值',
  flat_ratio DECIMAL(10, 4) DEFAULT 0 COMMENT '平时供水量占比-最终值',
  spike_ratio DECIMAL(10, 4) DEFAULT 0 COMMENT '尖峰供水量占比-最终值',
  
  -- 手动输入字段（无原始统计值）
  comprehensive_price DECIMAL(10, 4) COMMENT '综合电单价(元/kw*h)',
  water_supply_cost DECIMAL(10, 4) COMMENT '送水电费(元/t)',
  
  -- 计算字段（基于最终值计算）
  daily_power_per_kt DECIMAL(10, 2) COMMENT '日均电耗(kw*h/kt)',
  power_per_kt_mpa DECIMAL(10, 2) COMMENT '千吨水Mpa电耗(kw*h/kt.Mpa)',
  pump_efficiency DECIMAL(10, 4) COMMENT '泵组综合效率(%)',
  annual_savings DECIMAL(10, 2) COMMENT '年节省电费(万元/年)',
  
  -- 节能率字段
  power_per_kt_saving_rate DECIMAL(10, 4) COMMENT '电耗节能率(%)',
  power_per_kt_mpa_saving_rate DECIMAL(10, 4) COMMENT '千吨水Mpa电耗节能率(%)',
  pump_efficiency_saving_rate DECIMAL(10, 4) COMMENT '泵组综合效率节能率(%)',
  comprehensive_price_saving_rate DECIMAL(10, 4) COMMENT '综合电单价节能率(%)',
  water_supply_cost_saving_rate DECIMAL(10, 4) COMMENT '送水电费节能率(%)',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_year_month (year_month),
  INDEX idx_year_month (year_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岩湖水厂节能改造效益分析';
