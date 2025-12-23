/**
 * 数据库连接配置
 * 连接到福安数据库
 */
import mysql from 'mysql2/promise';

// 数据库配置
const dbConfig = {
  host: 'gz-cdb-e3z4b5ql.sql.tencentcdb.com',
  port: 63453,
  user: 'root',
  password: 'zsj12345678',
  database: 'fuan_data',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000,
};

// 创建连接池
let pool: mysql.Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// 查询最新一条数据
export async function getLatestData() {
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(`
    SELECT 
      collect_time,
      i_1102 as chengdong_flow,
      i_1034 as yanhu_flow,
      i_1030 as yanhu_pressure,
      i_1072 as yanhu_daily_water,
      i_1073 as yanhu_daily_power
    FROM fuan_data
    WHERE collect_time IS NOT NULL
    ORDER BY collect_time DESC
    LIMIT 1
  `);
  return rows[0] || null;
}

// 查询最近N天的数据（不包含今天）
export async function getRecentData(days: number = 7) {
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(`
    SELECT 
      collect_time,
      i_1102 as chengdong_flow,
      i_1034 as yanhu_flow,
      i_1030 as yanhu_pressure,
      i_1072 as yanhu_daily_water,
      i_1073 as yanhu_daily_power
    FROM fuan_data
    WHERE DATE(collect_time) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      AND DATE(collect_time) < CURDATE()
      AND (i_1102 > 0 OR i_1034 > 0)
    ORDER BY collect_time
  `, [days]);
  return rows;
}

// 根据日期范围查询数据
export async function getDataByDateRange(startDate: string, endDate: string) {
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(`
    SELECT 
      collect_time,
      i_1102 as chengdong_flow,
      i_1034 as yanhu_flow,
      i_1030 as yanhu_pressure,
      i_1072 as yanhu_daily_water,
      i_1073 as yanhu_daily_power
    FROM fuan_data
    WHERE DATE(collect_time) >= ? 
      AND DATE(collect_time) <= ?
      AND (i_1102 > 0 OR i_1034 > 0)
    ORDER BY collect_time
  `, [startDate, endDate]);
  return rows;
}

// 关闭连接池
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
