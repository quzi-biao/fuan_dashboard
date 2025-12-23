/**
 * API: 获取数据库字段列表
 */
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: 'gz-cdb-e3z4b5ql.sql.tencentcdb.com',
  port: 63453,
  user: 'root',
  password: 'zsj12345678',
  database: 'fuan_data',
  charset: 'utf8mb4',
  connectTimeout: 60000,
};

export async function GET() {
  let connection;

  try {
    connection = await mysql.createConnection(DB_CONFIG);

    // 获取表结构
    const [columns] = await connection.query<any[]>('DESCRIBE fuan_data');

    // 过滤掉 collect_time 和 id 字段，只返回数值字段
    const numericFields = columns
      .filter((col: any) => 
        col.Field !== 'collect_time' && 
        col.Field !== 'id' &&
        (col.Type.includes('int') || 
         col.Type.includes('float') || 
         col.Type.includes('double') ||
         col.Type.includes('decimal'))
      )
      .map((col: any) => col.Field);

    return NextResponse.json({
      success: true,
      fields: numericFields
    });

  } catch (error) {
    console.error('获取字段列表失败:', error);
    return NextResponse.json(
      { error: '获取字段列表失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
