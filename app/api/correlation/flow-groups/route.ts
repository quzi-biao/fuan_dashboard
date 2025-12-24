/**
 * API: 流量分组
 * 计算每分钟的城东和岩湖总流量，并按流量范围分组
 */
import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  let connection;

  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const groupCount = parseInt(searchParams.get('group_count') || '10');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '请提供开始日期和结束日期' },
        { status: 400 }
      );
    }

    if (groupCount < 2 || groupCount > 100) {
      return NextResponse.json(
        { error: '分组数量必须在2-100之间' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(DB_CONFIG);

    // 查询城东和岩湖的累计流量数据
    const query = `
      SELECT 
        collect_time,
        i_1129 as dongcheng_cumulative,
        i_1076 as yanhu_cumulative
      FROM fuan_data
      WHERE collect_time >= ?
        AND collect_time <= ?
        AND i_1129 IS NOT NULL
        AND i_1076 IS NOT NULL
      ORDER BY collect_time
    `;

    const [rows] = await connection.query<any[]>(query, [startDate, endDate]);

    if (rows.length < 10) {
      return NextResponse.json(
        { error: '数据点太少，无法进行分组分析' },
        { status: 400 }
      );
    }

    // 计算每分钟的流量（滑动窗口：前后10分钟累计流量的最大值 - 最小值）
    const flowData: Array<{
      time: Date;
      dongcheng_flow: number;
      yanhu_flow: number;
      total_flow: number;
    }> = [];

    const windowSize = 10; // 前后10分钟
    let filteredCount = 0;
    let totalProcessed = 0;

    for (let i = 0; i < rows.length; i++) {
      const curr = rows[i];
      totalProcessed++;
      
      // 动态计算窗口范围（边界处理）
      const windowStart = Math.max(0, i - windowSize);
      const windowEnd = Math.min(rows.length - 1, i + windowSize);
      const windowData = rows.slice(windowStart, windowEnd + 1);
      
      // 计算窗口内累计流量的最大值和最小值
      const dongchengValues = windowData.map(r => parseFloat(r.dongcheng_cumulative));
      const yanhuValues = windowData.map(r => parseFloat(r.yanhu_cumulative));
      
      const dongchengMax = Math.max(...dongchengValues);
      const dongchengMin = Math.min(...dongchengValues);
      const yanhuMax = Math.max(...yanhuValues);
      const yanhuMin = Math.min(...yanhuValues);
      
      // 计算窗口内的总流量差值，然后除以窗口大小得到平均流量
      const actualWindowSize = windowData.length;
      const dongchengFlow = (dongchengMax - dongchengMin) / actualWindowSize;
      const yanhuFlow = (yanhuMax - yanhuMin) / actualWindowSize;
      const totalFlow = Math.floor(dongchengFlow + yanhuFlow); // 取整数
      
      // 只保留正值且总流量不超过200（异常值过滤）
      if (dongchengFlow >= 0 && yanhuFlow >= 0 && totalFlow <= 500) {
        flowData.push({
          time: new Date(curr.collect_time),
          dongcheng_flow: dongchengFlow,
          yanhu_flow: yanhuFlow,
          total_flow: totalFlow,
        });
      }
    }

    if (flowData.length < 10) {
      return NextResponse.json(
        { error: '有效数据点太少，无法进行分组分析' },
        { status: 400 }
      );
    }

    // 找出流量的最小值和最大值
    const flows = flowData.map(d => d.total_flow);
    const minFlow = Math.min(...flows);
    const maxFlow = Math.max(...flows);

    // 计算每个分组的范围
    const rangeSize = (maxFlow - minFlow) / groupCount;

    // 创建分组
    const groups: Array<{
      group_id: number;
      min_flow: number;
      max_flow: number;
      count: number;
      avg_flow: number;
      data_indices: number[];
    }> = [];

    for (let i = 0; i < groupCount; i++) {
      const groupMinFlow = minFlow + i * rangeSize;
      const groupMaxFlow = i === groupCount - 1 ? maxFlow + 1 : minFlow + (i + 1) * rangeSize;

      groups.push({
        group_id: i + 1,
        min_flow: groupMinFlow,
        max_flow: groupMaxFlow,
        count: 0,
        avg_flow: 0,
        data_indices: [],
      });
    }

    // 将数据分配到各个分组
    flowData.forEach((data, index) => {
      const flow = data.total_flow;
      
      // 找到对应的分组
      for (let i = 0; i < groups.length; i++) {
        if (flow >= groups[i].min_flow && flow < groups[i].max_flow) {
          groups[i].count++;
          groups[i].data_indices.push(index);
          break;
        }
      }
    });

    // 计算每个分组的平均流量
    groups.forEach(group => {
      if (group.count > 0) {
        const totalFlow = group.data_indices.reduce((sum, idx) => sum + flowData[idx].total_flow, 0);
        group.avg_flow = totalFlow / group.count;
      }
    });

    // 过滤掉空分组
    const nonEmptyGroups = groups.filter(g => g.count > 0);

    // 计算流量分布（每个流量值的频率）
    const flowDistribution: Record<number, number> = {};
    flowData.forEach(d => {
      const flow = d.total_flow;
      flowDistribution[flow] = (flowDistribution[flow] || 0) + 1;
    });

    // 转换为数组格式，按流量值排序
    const distributionData = Object.entries(flowDistribution)
      .map(([flow, count]) => ({
        flow: parseInt(flow),
        count: count,
        frequency: count / flowData.length
      }))
      .sort((a, b) => a.flow - b.flow);

    console.log('Distribution summary:', {
      totalFlowData: flowData.length,
      uniqueFlows: distributionData.length,
      sample: distributionData.slice(0, 5),
      maxCount: Math.max(...distributionData.map(d => d.count))
    });

    // 返回分组信息（不包含data_indices，节省内存）
    const result = {
      total_samples: flowData.length,
      group_count: nonEmptyGroups.length,
      flow_range: { min: minFlow, max: maxFlow },
      distribution: distributionData,
      groups: nonEmptyGroups.map(g => ({
        group_id: g.group_id,
        min_flow: g.min_flow,
        max_flow: g.max_flow,
        count: g.count,
        avg_flow: g.avg_flow,
      })),
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('流量分组失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '流量分组失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
