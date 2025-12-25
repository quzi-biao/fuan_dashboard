#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
福安数据同步脚本
将末端压力计和水厂指标数据同步到目标数据库的 fuan_data 表
支持时间对齐和数据聚合
"""

import pymysql
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import argparse
import sys
from influxdb_client import InfluxDBClient
from influxdb_client.client.query_api import QueryApi
import logging
import pytz

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 时区配置
BEIJING_TZ = pytz.timezone('Asia/Shanghai')
UTC_TZ = pytz.UTC

# 数据库配置
SOURCE_DB_CONFIG = {
    'host': 'gz-cdb-e3z4b5ql.sql.tencentcdb.com',
    'port': 63453,
    'user': 'root',
    'password': 'zsj12345678',
    'database': 'water_dev',
    'charset': 'utf8mb4',
    'connect_timeout': 60,
    'read_timeout': 300,
    'write_timeout': 300,
    'autocommit': True
}

TARGET_DB_CONFIG = {
    'host': 'gz-cdb-e3z4b5ql.sql.tencentcdb.com',
    'port': 63453,
    'user': 'root',
    'password': 'zsj12345678',
    'database': 'fuan_data',
    'charset': 'utf8mb4',
    'connect_timeout': 60,
    'read_timeout': 300,
    'write_timeout': 300,
    'autocommit': True
}

# InfluxDB配置
INFLUX_CONFIG = {
    'url': 'http://43.139.93.159:8086',
    'token': 'oPeLbhvS-3OymtJj9z_XmQa7DyvHJHkbh_l-NFYUYYhXBSFHuIElzHy4ULWizikeGLKAiu7D57rhoGEp2cVOZA==',
    'org': 'watersAI',
    'bucket': 'metricsData'
}

# 压力计编号
PRESSURE_METERS = [
    '862006079084137',
    '862006079089300', 
    '862006078962366',
    '862006078966540',
    '862006078965385',
    '862006079083873',
    '862006078961665'
]

# 水厂指标
YANHU_INDICATORS = list(range(1069, 1078)) + list(range(1029, 1052))  # 1069-1077, 1029-1051
CHENGDONG_INDICATORS = list(range(1128, 1131)) + [1102, 1101, 1099, 1098, 1097, 1096]  # 1128-1130, 1102,1101,1099,1098,1097,1096

ALL_INDICATORS = YANHU_INDICATORS + CHENGDONG_INDICATORS

class DataSyncManager:
    def __init__(self):
        self.source_conn = None
        self.target_conn = None
        self.influx_client = None
        
    def connect_mysql(self, config):
        """连接MySQL数据库"""
        try:
            connection = pymysql.connect(**config)
            logger.info(f"MySQL数据库连接成功: {config['database']}")
            return connection
        except Exception as e:
            logger.error(f"MySQL数据库连接失败: {e}")
            return None
    
    def connect_influxdb(self):
        """连接InfluxDB"""
        try:
            client = InfluxDBClient(
                url=INFLUX_CONFIG['url'],
                token=INFLUX_CONFIG['token'],
                org=INFLUX_CONFIG['org']
            )
            # 测试连接
            client.ping()
            logger.info("InfluxDB连接成功")
            return client
        except Exception as e:
            logger.error(f"InfluxDB连接失败: {e}")
            return None
    
    def create_target_table(self):
        """创建目标表 fuan_data"""
        if not self.target_conn:
            logger.error("目标数据库连接不存在")
            return False
        
        try:
            with self.target_conn.cursor() as cursor:
                # 1. 先检查表是否存在
                cursor.execute("SHOW TABLES LIKE 'fuan_data'")
                table_exists = cursor.fetchone() is not None
                
                if not table_exists:
                    # 表不存在，创建新表
                    logger.info("表不存在，创建新表 fuan_data")
                    columns = ['collect_time DATETIME PRIMARY KEY']
                    
                    # 添加压力计字段
                    for meter in PRESSURE_METERS:
                        column_name = f"press_{meter[-4:]}"
                        columns.append(f"{column_name} DECIMAL(10,3) DEFAULT 0")
                    
                    # 添加指标字段
                    for indicator in ALL_INDICATORS:
                        column_name = f"i_{indicator}"
                        columns.append(f"{column_name} DECIMAL(10,3) DEFAULT 0")
                    
                    create_sql = f"""
                    CREATE TABLE fuan_data (
                        {', '.join(columns)}
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='福安数据同步表'
                    """
                    cursor.execute(create_sql)
                    logger.info("表 fuan_data 创建成功")
                else:
                    # 表已存在，检查并添加缺失的字段
                    logger.info("表已存在，检查并添加缺失字段")
                    
                    # 获取现有字段
                    cursor.execute("DESCRIBE fuan_data")
                    existing_columns = {row[0] for row in cursor.fetchall()}
                    logger.info(f"现有字段数量: {len(existing_columns)}")
                    
                    # 检查需要添加的字段
                    fields_to_add = []
                    
                    # 检查压力计字段
                    for meter in PRESSURE_METERS:
                        column_name = f"press_{meter[-4:]}"
                        if column_name not in existing_columns:
                            fields_to_add.append(column_name)
                    
                    # 检查指标字段
                    for indicator in ALL_INDICATORS:
                        column_name = f"i_{indicator}"
                        if column_name not in existing_columns:
                            fields_to_add.append(column_name)
                    
                    # 添加缺失的字段
                    if fields_to_add:
                        logger.info(f"需要添加 {len(fields_to_add)} 个字段: {fields_to_add}")
                        for field in fields_to_add:
                            alter_sql = f"ALTER TABLE fuan_data ADD COLUMN {field} DECIMAL(10,3) DEFAULT 0"
                            try:
                                cursor.execute(alter_sql)
                                logger.info(f"成功添加字段: {field}")
                            except Exception as e:
                                logger.error(f"添加字段 {field} 失败: {e}")
                    else:
                        logger.info("所有字段已存在，无需添加")
                
                logger.info("目标表 fuan_data 创建/更新完成")
                return True
                
        except Exception as e:
            logger.error(f"创建/更新目标表失败: {e}")
            return False
    
    def query_pressure_data(self, start_date, end_date):
        """查询压力计数据"""
        if not self.source_conn:
            logger.error("源数据库连接不存在")
            return pd.DataFrame()
        
        # 转换日期格式
        start_timestamp = int(datetime.strptime(start_date, '%Y%m%d').timestamp() * 1000)
        end_timestamp = int((datetime.strptime(end_date, '%Y%m%d') + timedelta(days=1)).timestamp() * 1000)
        
        query = """
        SELECT sn, collect_time, press
        FROM t_press
        WHERE sn IN %s 
        AND collect_time >= %s AND collect_time < %s
        AND press IS NOT NULL AND press > 0
        ORDER BY collect_time
        """
        
        try:
            with self.source_conn.cursor() as cursor:
                cursor.execute(query, (PRESSURE_METERS, start_timestamp, end_timestamp))
                results = cursor.fetchall()
                
                data = []
                for row in results:
                    # collect_time是毫秒时间戳，转换为北京时间
                    utc_time = datetime.fromtimestamp(row[1] / 1000, tz=UTC_TZ)
                    beijing_time = utc_time.astimezone(BEIJING_TZ).replace(tzinfo=None)
                    data.append({
                        'sn': row[0],
                        'collect_time': beijing_time,
                        'press': float(row[2])
                    })
                
                df = pd.DataFrame(data)
                logger.info(f"查询到压力计数据: {len(df)} 条")
                return df
                
        except Exception as e:
            logger.error(f"查询压力计数据失败: {e}")
            return pd.DataFrame()
    
    def query_influx_data_by_day(self, single_date):
        """按天查询单个指标的InfluxDB数据"""
        if not self.influx_client:
            logger.error("InfluxDB连接不存在")
            return pd.DataFrame()
        
        # 转换日期格式 - 将北京时间转换为UTC时间用于InfluxDB查询
        beijing_start = BEIJING_TZ.localize(datetime.strptime(single_date, '%Y%m%d'))
        beijing_end = beijing_start + timedelta(days=1)
        utc_start = beijing_start.astimezone(UTC_TZ)
        utc_end = beijing_end.astimezone(UTC_TZ)
        
        start_time = utc_start.strftime('%Y-%m-%dT%H:%M:%SZ')
        end_time = utc_end.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        all_data = []
        
        # 为每个指标单独查询
        for indicator_id in ALL_INDICATORS:
            query = f'''
            from(bucket: "{INFLUX_CONFIG['bucket']}")
            |> range(start: {start_time}, stop: {end_time})
            |> filter(fn: (r) => 
                r["_measurement"] == "plcData" and
                r["_field"] == "value" and
                r["indicator_id"] == "{indicator_id}")
            |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
            '''
            
            try:
                query_api = self.influx_client.query_api()
                logger.info(f"查询日期 {single_date} 指标 {indicator_id}")
                tables = query_api.query(query, INFLUX_CONFIG['org'])
                
                for table in tables:
                    for record in table.records:
                        if record.get_value() is not None:
                            # 转换时区为北京时间
                            utc_time = record.get_time()
                            if utc_time.tzinfo is None:
                                utc_time = UTC_TZ.localize(utc_time)
                            beijing_time = utc_time.astimezone(BEIJING_TZ).replace(tzinfo=None)
                            all_data.append({
                                'collect_time': beijing_time,
                                'indicator_id': str(indicator_id),
                                'value': float(record.get_value())
                            })
                            
            except Exception as e:
                logger.error(f"查询指标 {indicator_id} 失败: {e}")
                continue
        
        if not all_data:
            logger.info(f"日期 {single_date} InfluxDB查询结果为空")
            return pd.DataFrame()
        
        # 转换为DataFrame并透视
        df = pd.DataFrame(all_data)
        
        # 透视表：时间为行，指标为列
        pivot_df = df.pivot_table(
            index='collect_time',
            columns='indicator_id',
            values='value',
            aggfunc='mean'
        ).reset_index()
        
        # 重命名列
        rename_dict = {str(ind): f"i_{ind}" for ind in ALL_INDICATORS if str(ind) in pivot_df.columns}
        pivot_df.rename(columns=rename_dict, inplace=True)
        
        logger.info(f"日期 {single_date} 查询到InfluxDB数据: {len(pivot_df)} 条")
        return pivot_df
    
    def query_influx_data(self, start_date, end_date):
        """按天查询InfluxDB指标数据"""
        start_dt = datetime.strptime(start_date, '%Y%m%d')
        end_dt = datetime.strptime(end_date, '%Y%m%d')
        
        all_dfs = []
        
        # 按天循环查询
        current_date = start_dt
        while current_date <= end_dt:
            date_str = current_date.strftime('%Y%m%d')
            daily_df = self.query_influx_data_by_day(date_str)
            
            if not daily_df.empty:
                all_dfs.append(daily_df)
            
            current_date += timedelta(days=1)
        
        if not all_dfs:
            logger.info("所有日期的InfluxDB查询结果都为空")
            return pd.DataFrame()
        
        # 合并所有天的数据
        combined_df = pd.concat(all_dfs, ignore_index=True)
        logger.info(f"合并后InfluxDB数据总计: {len(combined_df)} 条")
        
        return combined_df
    
    def align_data_by_minute(self, pressure_df, influx_df, start_date, end_date):
        """按分钟对齐数据"""
        # 生成完整的时间序列（每分钟一个点）
        start_dt = datetime.strptime(start_date, '%Y%m%d')
        end_dt = datetime.strptime(end_date, '%Y%m%d') + timedelta(days=1)
        
        time_range = pd.date_range(start=start_dt, end=end_dt, freq='1min')[:-1]  # 排除最后一个点
        aligned_df = pd.DataFrame({'collect_time': time_range})
        
        # 处理压力计数据
        if not pressure_df.empty:
            # 按分钟分组并计算均值
            pressure_df['minute'] = pressure_df['collect_time'].dt.floor('min')
            pressure_grouped = pressure_df.groupby(['sn', 'minute'])['press'].mean().reset_index()
            
            # 透视表转换
            pressure_pivot = pressure_grouped.pivot(index='minute', columns='sn', values='press')
            pressure_pivot.columns = [f"press_{sn[-4:]}" for sn in pressure_pivot.columns]
            pressure_pivot = pressure_pivot.reset_index()
            pressure_pivot.rename(columns={'minute': 'collect_time'}, inplace=True)
            
            # 合并到对齐的时间序列
            aligned_df = aligned_df.merge(pressure_pivot, on='collect_time', how='left')
        
        # 处理InfluxDB数据
        if not influx_df.empty:
            # 按分钟分组并计算均值
            influx_df['minute'] = influx_df['collect_time'].dt.floor('min')
            
            # 对每个指标计算均值
            indicator_columns = [col for col in influx_df.columns if col not in ['collect_time', 'minute']]
            influx_grouped = influx_df.groupby('minute')[indicator_columns].mean().reset_index()
            
            # 重命名列
            rename_dict = {str(ind): f"i_{ind}" for ind in ALL_INDICATORS if str(ind) in influx_grouped.columns}
            influx_grouped.rename(columns=rename_dict, inplace=True)
            influx_grouped.rename(columns={'minute': 'collect_time'}, inplace=True)
            
            # 合并到对齐的时间序列
            aligned_df = aligned_df.merge(influx_grouped, on='collect_time', how='left')
        
        # 填充缺失值为0
        aligned_df = aligned_df.fillna(0)
        
        # 过滤超出 DECIMAL(10,3) 范围的值
        # DECIMAL(10,3) 最大值为 9999999.999
        MAX_VALUE = 9999999.999
        MIN_VALUE = -9999999.999
        
        # 对所有数值列进行范围检查（除了 collect_time）
        numeric_columns = [col for col in aligned_df.columns if col != 'collect_time']
        for col in numeric_columns:
            # 将超出范围的值设置为0
            out_of_range_mask = (aligned_df[col] > MAX_VALUE) | (aligned_df[col] < MIN_VALUE)
            out_of_range_count = out_of_range_mask.sum()
            if out_of_range_count > 0:
                logger.warning(f"字段 {col} 有 {out_of_range_count} 个值超出范围，已设置为0")
                aligned_df.loc[out_of_range_mask, col] = 0
        
        logger.info(f"数据对齐完成，生成 {len(aligned_df)} 条记录")
        return aligned_df
    
    def insert_data_to_target(self, aligned_df):
        """将对齐的数据插入目标表
        
        注意：值为0的字段不会更新到数据库，保持原有值
        这样可以避免因读取异常导致的0值覆盖有效数据
        """
        if not self.target_conn or aligned_df.empty:
            logger.error("目标数据库连接不存在或数据为空")
            return False
        
        # 构建插入语句
        columns = list(aligned_df.columns)
        placeholders = ', '.join(['%s'] * len(columns))
        
        # 构建更新语句：只更新非0的值，使用 IF 条件判断
        # IF(VALUES(col)!=0, VALUES(col), col) 表示：如果新值不为0则更新，否则保持原值
        update_clauses = []
        for col in columns:
            if col != 'collect_time':
                update_clauses.append(f"{col}=IF(VALUES({col})!=0, VALUES({col}), {col})")
        
        insert_sql = f"""
        INSERT INTO fuan_data ({', '.join(columns)})
        VALUES ({placeholders})
        ON DUPLICATE KEY UPDATE
        {', '.join(update_clauses)}
        """
        
        try:
            with self.target_conn.cursor() as cursor:
                # 批量插入
                data_tuples = [tuple(row) for row in aligned_df.values]
                cursor.executemany(insert_sql, data_tuples)
                
            logger.info(f"成功插入/更新 {len(aligned_df)} 条数据到目标表")
            return True
            
        except Exception as e:
            logger.error(f"插入数据到目标表失败: {e}")
            return False
    
    def sync_data(self, start_date, end_date):
        """执行数据同步"""
        logger.info(f"开始同步数据: {start_date} 到 {end_date}")
        
        # 建立连接
        self.source_conn = self.connect_mysql(SOURCE_DB_CONFIG)
        self.target_conn = self.connect_mysql(TARGET_DB_CONFIG)
        self.influx_client = self.connect_influxdb()
        
        if not all([self.source_conn, self.target_conn, self.influx_client]):
            logger.error("数据库连接失败，无法继续")
            return False
        
        try:
            # 创建目标表
            if not self.create_target_table():
                return False
            
            # 查询源数据
            logger.info("查询压力计数据...")
            pressure_df = self.query_pressure_data(start_date, end_date)
            
            logger.info("查询InfluxDB指标数据...")
            influx_df = self.query_influx_data(start_date, end_date)
            
            # 对齐数据
            logger.info("对齐数据...")
            aligned_df = self.align_data_by_minute(pressure_df, influx_df, start_date, end_date)
            
            # 插入目标表
            logger.info("插入数据到目标表...")
            success = self.insert_data_to_target(aligned_df)
            
            if success:
                logger.info("数据同步完成！")
            else:
                logger.error("数据同步失败！")
            
            return success
            
        finally:
            # 关闭连接
            if self.source_conn:
                self.source_conn.close()
            if self.target_conn:
                self.target_conn.close()
            if self.influx_client:
                self.influx_client.close()

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='福安数据同步脚本')
    parser.add_argument('start_date', help='开始日期，格式：YYYYMMDD')
    parser.add_argument('end_date', help='结束日期，格式：YYYYMMDD')
    
    args = parser.parse_args()
    
    # 验证日期格式
    try:
        datetime.strptime(args.start_date, '%Y%m%d')
        datetime.strptime(args.end_date, '%Y%m%d')
    except ValueError:
        logger.error("日期格式错误，请使用 YYYYMMDD 格式")
        sys.exit(1)
    
    # 执行同步
    sync_manager = DataSyncManager()
    success = sync_manager.sync_data(args.start_date, args.end_date)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
