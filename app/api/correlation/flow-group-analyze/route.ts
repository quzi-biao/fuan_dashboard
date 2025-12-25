/**
 * API: 流量分组回归分析
 * 对指定分组内的数据执行回归分析
 */
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { polynomialRegressionPython } from '@/lib/analysis/pythonRunner';
import { exponentialRegression } from '@/lib/analysis/exponentialRegression';
import { logarithmicRegression } from '@/lib/analysis/logarithmicRegression';
import { trainNeuralNetwork } from '@/lib/analysis/neuralNetwork';
import { removeOutliers } from '@/lib/analysis/dataUtils';

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
    const groupId = parseInt(searchParams.get('group_id') || '0');
    const groupCount = parseInt(searchParams.get('group_count') || '10');
    const xFieldsStr = searchParams.get('x_fields');
    const yField = searchParams.get('y_field');
    const analysisType = searchParams.get('analysis_type') || 'polynomial';
    const degree = parseInt(searchParams.get('degree') || '2');
    const hiddenLayers = searchParams.get('hidden_layers');
    const timeGranularity = searchParams.get('time_granularity') || 'minute';

    if (!startDate || !endDate || !xFieldsStr || !yField) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const xFields = xFieldsStr.split(',').map(f => f.trim());

    connection = await mysql.createConnection(DB_CONFIG);

    // 根据时间粒度构建不同的查询
    const allFields = [...xFields, yField, 'i_1129', 'i_1076']; // 包含城东和岩湖累计流量
    
    let query: string;
    if (timeGranularity === 'hour') {
      // 按小时聚合，计算均值
      query = `
        SELECT 
          DATE_FORMAT(collect_time, '%Y-%m-%d %H:00:00') as collect_time,
          ${allFields.map(f => `AVG(${f}) as ${f}`).join(', ')}
        FROM fuan_data
        WHERE collect_time >= ?
          AND collect_time <= ?
          AND i_1129 IS NOT NULL
          AND i_1076 IS NOT NULL
          ${allFields.map(f => `AND ${f} IS NOT NULL`).join(' ')}
        GROUP BY DATE_FORMAT(collect_time, '%Y-%m-%d %H:00:00')
        ORDER BY collect_time
      `;
    } else if (timeGranularity === 'day') {
      // 按日聚合，计算均值
      query = `
        SELECT 
          DATE_FORMAT(collect_time, '%Y-%m-%d 00:00:00') as collect_time,
          ${allFields.map(f => `AVG(${f}) as ${f}`).join(', ')}
        FROM fuan_data
        WHERE collect_time >= ?
          AND collect_time <= ?
          AND i_1129 IS NOT NULL
          AND i_1076 IS NOT NULL
          ${allFields.map(f => `AND ${f} IS NOT NULL`).join(' ')}
        GROUP BY DATE_FORMAT(collect_time, '%Y-%m-%d')
        ORDER BY collect_time
      `;
    } else {
      // 按分钟，原始数据
      query = `
        SELECT 
          collect_time,
          ${allFields.join(', ')}
        FROM fuan_data
        WHERE collect_time >= ?
          AND collect_time <= ?
          AND i_1129 IS NOT NULL
          AND i_1076 IS NOT NULL
          ${allFields.map(f => `AND ${f} IS NOT NULL`).join(' ')}
        ORDER BY collect_time
      `;
    }

    const [rows] = await connection.query<any[]>(query, [startDate, endDate]);

    if (rows.length < 10) {
      return NextResponse.json(
        { error: '数据点太少' },
        { status: 400 }
      );
    }

    // 计算每分钟的流量（滑动窗口：前后10分钟累计流量的最大值 - 最小值）
    const processedData: any[] = [];
    const windowSize = 10; // 前后10分钟
    
    for (let i = 0; i < rows.length; i++) {
      const curr = rows[i];
      
      // 动态计算窗口范围（边界处理）
      const windowStart = Math.max(0, i - windowSize);
      const windowEnd = Math.min(rows.length - 1, i + windowSize);
      const windowData = rows.slice(windowStart, windowEnd + 1);
      
      // 提取城东和岩湖的累计流量
      const dongchengValues = windowData.map(r => parseFloat(r.i_1129));
      const yanhuValues = windowData.map(r => parseFloat(r.i_1076));
      
      // 计算最大值和最小值的差值
      const dongchengMax = Math.max(...dongchengValues);
      const dongchengMin = Math.min(...dongchengValues);
      const yanhuMax = Math.max(...yanhuValues);
      const yanhuMin = Math.min(...yanhuValues);
      
      // 计算窗口内的总流量差值，然后除以窗口大小得到平均流量
      const actualWindowSize = windowData.length;
      const dongchengFlow = (dongchengMax - dongchengMin) / actualWindowSize;
      const yanhuFlow = (yanhuMax - yanhuMin) / actualWindowSize;
      
      if (dongchengFlow >= 0 && yanhuFlow >= 0) {
        const totalFlow = Math.floor(dongchengFlow + yanhuFlow);
        
        // 过滤异常值：总流量不能超过500
        if (totalFlow <= 500) {
          const dataPoint: any = {
            total_flow: totalFlow,
            collect_time: curr.collect_time,
          };
          
          // 添加其他字段
          allFields.forEach(field => {
            if (field !== 'i_1129' && field !== 'i_1076') {
              dataPoint[field] = parseFloat(curr[field]);
            }
          });
          
          processedData.push(dataPoint);
        }
      }
    }

    // 计算流量范围并找出目标分组的数据
    const flows = processedData.map(d => d.total_flow);
    const minFlow = Math.min(...flows);
    const maxFlow = Math.max(...flows);
    const rangeSize = (maxFlow - minFlow) / groupCount;

    const groupMinFlow = minFlow + (groupId - 1) * rangeSize;
    const groupMaxFlow = groupId === groupCount ? maxFlow + 1 : minFlow + groupId * rangeSize;

    // 筛选出属于目标分组的数据
    const groupData = processedData.filter(d => 
      d.total_flow >= groupMinFlow && d.total_flow < groupMaxFlow
    );

    if (groupData.length < 10) {
      return NextResponse.json(
        { error: `分组 ${groupId} 的数据点太少（${groupData.length}条），无法进行分析` },
        { status: 400 }
      );
    }

    // 移除异常值
    const cleanData = removeOutliers(groupData, [...xFields, yField]);

    if (cleanData.length < 10) {
      return NextResponse.json(
        { error: '清洗后的数据点太少' },
        { status: 400 }
      );
    }

    // 准备训练数据
    const X = cleanData.map(row => xFields.map(f => row[f]));
    const y = cleanData.map(row => row[yField]);

    // 分割训练集和测试集 (80/20)
    const splitIndex = Math.floor(cleanData.length * 0.8);
    const XTrain = X.slice(0, splitIndex);
    const yTrain = y.slice(0, splitIndex);
    const XTest = X.slice(splitIndex);
    const yTest = y.slice(splitIndex);

    let result: any = {
      type: analysisType,
      group_id: groupId,
      group_range: `${groupMinFlow.toFixed(0)} ~ ${groupMaxFlow.toFixed(0)}`,
      sample_count: cleanData.length,
      train_count: XTrain.length,
      test_count: XTest.length,
      is_single_variable: xFields.length === 1,
    };

    if (analysisType === 'polynomial') {
      // 多项式回归（使用Python）
      const trainResult = await polynomialRegressionPython(XTrain, yTrain, degree);
      const testResult = await polynomialRegressionPython(XTest, yTest, degree);

      result.r2_train = trainResult.r2;
      result.r2_test = testResult.r2;
      result.mse_train = trainResult.mse || yTrain.reduce((sum, val, idx) => 
        sum + Math.pow(val - trainResult.predictions[idx], 2), 0) / yTrain.length;
      result.mse_test = testResult.mse || yTest.reduce((sum, val, idx) => 
        sum + Math.pow(val - testResult.predictions[idx], 2), 0) / yTest.length;

      result.scatter_data = yTest.map((actual, idx) => ({
        actual,
        predicted: testResult.predictions[idx]
      }));

      result.residuals_data = testResult.predictions.map((pred: number, idx: number) => ({
        predicted: pred,
        residual: yTest[idx] - pred
      }));

      // 生成方程
      const coeffs = trainResult.coefficients;
      let equation = `y = ${coeffs[0].toFixed(4)}`;
      let coeffIdx = 1;
      for (let fieldIdx = 0; fieldIdx < xFields.length; fieldIdx++) {
        for (let d = 1; d <= degree; d++) {
          const coef = coeffs[coeffIdx];
          const sign = coef >= 0 ? '+' : '';
          if (d === 1) {
            equation += ` ${sign}${coef.toFixed(4)}·${xFields[fieldIdx]}`;
          } else {
            equation += ` ${sign}${coef.toFixed(4)}·${xFields[fieldIdx]}^${d}`;
          }
          coeffIdx++;
        }
      }
      result.equation = equation;

      // 如果是单变量，返回分组内数据的时间序列用于绘制曲线
      if (xFields.length === 1) {
        // 使用分组内清洗后的数据重新训练，获取预测值
        const groupResult = await polynomialRegressionPython(X, y, degree);
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: groupResult.predictions[idx]
        })).sort((a, b) => a.x - b.x);
      }

    } else if (analysisType === 'exponential') {
      // 指数回归
      const trainResult = exponentialRegression(XTrain, yTrain);
      const testResult = exponentialRegression(XTest, yTest);

      result.r2_train = trainResult.r2;
      result.r2_test = testResult.r2;
      result.mse_train = yTrain.reduce((sum, val, idx) => 
        sum + Math.pow(val - trainResult.predictions[idx], 2), 0) / yTrain.length;
      result.mse_test = yTest.reduce((sum, val, idx) => 
        sum + Math.pow(val - testResult.predictions[idx], 2), 0) / yTest.length;

      result.scatter_data = yTest.map((actual, idx) => ({
        actual,
        predicted: testResult.predictions[idx]
      }));

      result.residuals_data = testResult.predictions.map((pred, idx) => ({
        predicted: pred,
        residual: yTest[idx] - pred
      }));

      // 生成方程: y = a * e^(b1*x1 + b2*x2 + ...)
      const coeffs = trainResult.coefficients;
      let equation = `y = ${coeffs[0].toFixed(4)} · e^(`;
      const exponentParts: string[] = [];
      for (let i = 0; i < xFields.length; i++) {
        const coef = coeffs[i + 1];
        const sign = coef >= 0 && i > 0 ? '+' : '';
        exponentParts.push(`${sign}${coef.toFixed(4)}·${xFields[i]}`);
      }
      equation += exponentParts.join(' ') + ')';
      result.equation = equation;

      // 如果是单变量，返回分组内数据的时间序列用于绘制曲线
      if (xFields.length === 1) {
        const groupPredictions = exponentialRegression(X, y).predictions;
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: groupPredictions[idx]
        })).sort((a, b) => a.x - b.x);
      }

    } else if (analysisType === 'logarithmic') {
      // 对数回归
      const trainResult = logarithmicRegression(XTrain, yTrain);
      const testResult = logarithmicRegression(XTest, yTest);

      result.r2_train = trainResult.r2;
      result.r2_test = testResult.r2;
      result.mse_train = yTrain.reduce((sum, val, idx) => 
        sum + Math.pow(val - trainResult.predictions[idx], 2), 0) / yTrain.length;
      result.mse_test = yTest.reduce((sum, val, idx) => 
        sum + Math.pow(val - testResult.predictions[idx], 2), 0) / yTest.length;

      result.scatter_data = yTest.map((actual, idx) => ({
        actual,
        predicted: testResult.predictions[idx]
      }));

      result.residuals_data = testResult.predictions.map((pred, idx) => ({
        predicted: pred,
        residual: yTest[idx] - pred
      }));

      // 生成方程: y = a + b1*ln(x1) + b2*ln(x2) + ...
      const coeffs = trainResult.coefficients;
      let equation = `y = ${coeffs[0].toFixed(4)}`;
      for (let i = 0; i < xFields.length; i++) {
        const coef = coeffs[i + 1];
        const sign = coef >= 0 ? '+' : '';
        equation += ` ${sign}${coef.toFixed(4)}·ln(${xFields[i]})`;
      }
      result.equation = equation;

      // 如果是单变量，返回分组内数据的时间序列用于绘制曲线
      if (xFields.length === 1) {
        const groupPredictions = logarithmicRegression(X, y).predictions;
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: groupPredictions[idx]
        })).sort((a, b) => a.x - b.x);
      }

    } else {
      // 神经网络回归
      const hiddenLayerSizes = hiddenLayers ? hiddenLayers.split(',').map((s: string) => parseInt(s.trim())) : [100, 50];
      
      const nnResult = trainNeuralNetwork(
        XTrain, yTrain, XTest, yTest, X, y, xFields, hiddenLayerSizes
      );
      
      result.r2_train = nnResult.r2Train;
      result.r2_test = nnResult.r2Test;
      result.mse_train = nnResult.mseTrain;
      result.mse_test = nnResult.mseTest;
      result.feature_importance = nnResult.featureImportance;

      result.scatter_data = yTest.map((actual, idx) => ({
        actual,
        predicted: nnResult.predictions[yTrain.length + idx]
      }));

      result.residuals_data = yTest.map((actual, idx) => {
        const predicted = nnResult.predictions[yTrain.length + idx];
        return {
          predicted,
          residual: actual - predicted
        };
      });

      result.equation = `神经网络 [${nnResult.layers.join(' → ')}] (${nnResult.iterations} 次迭代)`;

      // 如果是单变量，返回分组内数据的时间序列用于绘制曲线
      if (xFields.length === 1) {
        // 使用分组内清洗后的数据和神经网络预测值
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: nnResult.predictions[idx]
        })).sort((a, b) => a.x - b.x);
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('分组分析失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分组分析失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
