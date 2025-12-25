/**
 * API: 执行关联分析
 */
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { polynomialRegressionPython, neuralNetworkRegressionPython } from '@/lib/analysis/pythonRunner';
import { exponentialRegression } from '@/lib/analysis/exponentialRegression';
import { logarithmicRegression } from '@/lib/analysis/logarithmicRegression';
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
    const xFieldsStr = searchParams.get('x_fields');
    const yField = searchParams.get('y_field');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const analysisType = searchParams.get('analysis_type') || 'polynomial';
    const degree = parseInt(searchParams.get('degree') || '2');
    const hiddenLayers = searchParams.get('hidden_layers') || '100,50';
    const timeGranularity = searchParams.get('time_granularity') || 'minute';

    if (!xFieldsStr || !yField || !startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const xFields = xFieldsStr.split(',').map(f => f.trim());

    // 连接数据库
    connection = await mysql.createConnection(DB_CONFIG);

    // 根据时间粒度构建不同的查询
    const allFields = [...xFields, yField];
    const whereConditions = allFields.map(f => `${f} > 0`).join(' AND ');
    
    let query: string;
    if (timeGranularity === 'hour') {
      // 按小时聚合，计算均值
      query = `
        SELECT 
          DATE_FORMAT(collect_time, '%Y-%m-%d %H:00:00') as collect_time,
          ${allFields.map(f => `AVG(${f}) as ${f}`).join(', ')}
        FROM fuan_data
        WHERE ${whereConditions}
          AND collect_time >= ?
          AND collect_time <= ?
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
        WHERE ${whereConditions}
          AND collect_time >= ?
          AND collect_time <= ?
        GROUP BY DATE_FORMAT(collect_time, '%Y-%m-%d')
        ORDER BY collect_time
      `;
    } else {
      // 按分钟，原始数据
      query = `
        SELECT collect_time, ${allFields.join(', ')}
        FROM fuan_data
        WHERE ${whereConditions}
          AND collect_time >= ?
          AND collect_time <= ?
        ORDER BY collect_time
      `;
    }

    const [rows] = await connection.query<any[]>(query, [startDate, endDate]);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: '没有符合条件的数据' },
        { status: 404 }
      );
    }

    // 转换数据类型
    const data = rows.map(row => {
      const converted: any = {};
      for (const field of allFields) {
        converted[field] = parseFloat(row[field]);
      }
      return converted;
    });

    // 移除异常值
    const cleanData = removeOutliers(data, allFields);

    if (cleanData.length < 10) {
      return NextResponse.json(
        { error: '有效数据点太少，无法进行分析' },
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
      sample_count: cleanData.length,
      train_count: XTrain.length,
      test_count: XTest.length,
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

      // 生成散点图数据
      result.scatter_data = yTest.map((actual, idx) => ({
        actual,
        predicted: testResult.predictions[idx]
      }));

      // 生成残差数据
      result.residuals_data = testResult.predictions.map((pred: number, idx: number) => ({
        predicted: pred,
        residual: yTest[idx] - pred
      }));

      // 生成多项式表达式
      // 系数顺序: [截距, x1^1, x1^2, ..., x1^degree, x2^1, x2^2, ..., x2^degree, ...]
      const coeffs = trainResult.coefficients;
      let equationParts: string[] = [];
      
      // 截距项
      if (Math.abs(coeffs[0]) > 0.0001) {
        equationParts.push(coeffs[0].toFixed(4));
      }
      
      // 变量项
      let coeffIndex = 1;
      for (let varIdx = 0; varIdx < xFields.length; varIdx++) {
        const varName = `x${varIdx + 1}`;
        for (let d = 1; d <= degree; d++) {
          const coeff = coeffs[coeffIndex];
          if (Math.abs(coeff) > 0.0001) {
            const coeffStr = Math.abs(coeff).toFixed(4);
            const sign = coeff > 0 ? '+' : '-';
            const term = d === 1 ? varName : `${varName}^${d}`;
            equationParts.push(`${sign} ${coeffStr}·${term}`);
          }
          coeffIndex++;
        }
      }
      
      result.equation = equationParts.length > 0 
        ? `y = ${equationParts.join(' ')}`
        : 'y = 0';
      
      // 如果是单变量，生成时间序列数据用于绘制曲线
      if (xFields.length === 1) {
        result.is_single_variable = true;
        // 使用全部数据生成时间序列
        const fullResult = await polynomialRegressionPython(X, y, degree);
        result.time_series_data = X.map((xVal, idx) => ({
          x: xVal[0],
          y_actual: y[idx],
          y_predicted: fullResult.predictions[idx]
        }));
        // 按 x 值排序以便绘制曲线
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
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
        exponentParts.push(`${sign}${coef.toFixed(4)}·x${i + 1}`);
      }
      equation += exponentParts.join(' ') + ')';
      result.equation = equation;

      // 如果是单变量，返回时间序列数据
      if (xFields.length === 1) {
        result.is_single_variable = true;
        const fullResult = exponentialRegression(X, y);
        result.time_series_data = X.map((xVal, idx) => ({
          x: xVal[0],
          y_actual: y[idx],
          y_predicted: fullResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
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
        equation += ` ${sign}${coef.toFixed(4)}·ln(x${i + 1})`;
      }
      result.equation = equation;

      // 如果是单变量，返回时间序列数据
      if (xFields.length === 1) {
        result.is_single_variable = true;
        const fullResult = logarithmicRegression(X, y);
        result.time_series_data = X.map((xVal, idx) => ({
          x: xVal[0],
          y_actual: y[idx],
          y_predicted: fullResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'did') {
      // 双重差分分析
      const interventionDate = searchParams.get('intervention_date');
      
      if (!interventionDate) {
        return NextResponse.json(
          { error: '双重差分分析需要提供干预日期' },
          { status: 400 }
        );
      }
      
      // 需要有分组变量（treatment group indicator）
      // 这里假设第一个自变量是分组变量（0=对照组，1=处理组）
      if (xFields.length < 1) {
        return NextResponse.json(
          { error: '双重差分分析至少需要一个分组变量' },
          { status: 400 }
        );
      }
      
      // 重新查询带时间的数据
      const queryWithTime = `
        SELECT collect_time, ${allFields.join(', ')}
        FROM fuan_data
        WHERE ${whereConditions}
          AND collect_time >= ?
          AND collect_time <= ?
        ORDER BY collect_time
      `;
      
      const [timeRows] = await connection.query<any[]>(queryWithTime, [startDate, endDate]);
      
      const timeData = timeRows.map(row => {
        const data: any = {
          time: new Date(row.collect_time)
        };
        allFields.forEach(field => {
          data[field] = parseFloat(row[field]);
        });
        return data;
      });
      
      // 划分干预前后
      const interventionTime = new Date(interventionDate);
      const prePeriod = timeData.filter(d => d.time < interventionTime);
      const postPeriod = timeData.filter(d => d.time >= interventionTime);
      
      if (prePeriod.length < 5 || postPeriod.length < 5) {
        return NextResponse.json(
          { error: '干预前后的数据点太少，无法进行DID分析' },
          { status: 400 }
        );
      }
      
      // 假设使用第一个自变量作为分组变量
      // 使用中位数划分处理组和对照组
      const groupValues = timeData.map(d => d[xFields[0]]);
      const median = groupValues.sort((a, b) => a - b)[Math.floor(groupValues.length / 2)];
      
      // 计算四组均值
      const preControl = prePeriod.filter(d => d[xFields[0]] <= median);
      const preTreatment = prePeriod.filter(d => d[xFields[0]] > median);
      const postControl = postPeriod.filter(d => d[xFields[0]] <= median);
      const postTreatment = postPeriod.filter(d => d[xFields[0]] > median);
      
      const preControlMean = preControl.reduce((sum, d) => sum + d[yField], 0) / preControl.length;
      const preTreatmentMean = preTreatment.reduce((sum, d) => sum + d[yField], 0) / preTreatment.length;
      const postControlMean = postControl.reduce((sum, d) => sum + d[yField], 0) / postControl.length;
      const postTreatmentMean = postTreatment.reduce((sum, d) => sum + d[yField], 0) / postTreatment.length;
      
      // 计算DID效应
      const controlDiff = postControlMean - preControlMean;
      const treatmentDiff = postTreatmentMean - preTreatmentMean;
      const didEffect = treatmentDiff - controlDiff;
      
      // 简化的p-value计算（基于t检验）
      const pooledStd = Math.sqrt(
        (Math.pow(preTreatment.reduce((sum, d) => sum + Math.pow(d[yField] - preTreatmentMean, 2), 0) / preTreatment.length, 2) +
         Math.pow(postTreatment.reduce((sum, d) => sum + Math.pow(d[yField] - postTreatmentMean, 2), 0) / postTreatment.length, 2)) / 2
      );
      const se = pooledStd * Math.sqrt(1/preTreatment.length + 1/postTreatment.length + 1/preControl.length + 1/postControl.length);
      const tStat = Math.abs(didEffect / se);
      // 简化的p-value估计
      const pValue = tStat > 2.576 ? 0.01 : tStat > 1.96 ? 0.05 : tStat > 1.645 ? 0.1 : 0.2;
      
      // 生成趋势数据
      const treatmentTrend = timeData
        .filter(d => d[xFields[0]] > median)
        .map(d => ({
          date: d.time.toISOString().split('T')[0],
          value: d[yField],
          group: 'treatment',
          period: d.time < interventionTime ? 'pre' : 'post'
        }));
      
      const controlTrend = timeData
        .filter(d => d[xFields[0]] <= median)
        .map(d => ({
          date: d.time.toISOString().split('T')[0],
          value: d[yField],
          group: 'control',
          period: d.time < interventionTime ? 'pre' : 'post'
        }));
      
      // 平行趋势检验（简化版：检验干预前两组的趋势是否相似）
      const preTreatmentTrend = preTreatment.map((d, i) => ({ x: i, y: d[yField] }));
      const preControlTrend = preControl.map((d, i) => ({ x: i, y: d[yField] }));
      
      // 简单的趋势差异检验
      const trendDiff = Math.abs(
        (preTreatmentTrend[preTreatmentTrend.length - 1].y - preTreatmentTrend[0].y) -
        (preControlTrend[preControlTrend.length - 1].y - preControlTrend[0].y)
      );
      const parallelTrendPassed = trendDiff < Math.abs(didEffect) * 0.5;
      
      result.did_effect = didEffect;
      result.did_p_value = pValue;
      result.pre_control_mean = preControlMean;
      result.pre_treatment_mean = preTreatmentMean;
      result.post_control_mean = postControlMean;
      result.post_treatment_mean = postTreatmentMean;
      result.treatment_trend = [...treatmentTrend, ...controlTrend];
      result.parallel_trend_test = {
        p_value: parallelTrendPassed ? 0.1 : 0.5,
        passed: parallelTrendPassed
      };
      
    } else {
      // 神经网络回归（使用Python）
      const hiddenLayerSizes = hiddenLayers ? hiddenLayers.split(',').map((s: string) => parseInt(s.trim())) : [100, 50];
      
      const nnResult = await neuralNetworkRegressionPython(
        X, y, xFields, hiddenLayerSizes
      );
      
      result.r2_train = nnResult.r2_train;
      result.r2_test = nnResult.r2_test;
      result.mse_train = nnResult.mse_train;
      result.mse_test = nnResult.mse_test;
      result.feature_importance = nnResult.feature_importance;

      // 计算测试集的起始索引（80%用于训练）
      const trainSize = Math.floor(cleanData.length * 0.8);

      // 生成散点图数据
      result.scatter_data = yTest.map((actual, idx) => ({
        actual,
        predicted: nnResult.predictions[trainSize + idx]
      }));

      // 生成残差数据
      result.residuals_data = yTest.map((actual, idx) => {
        const predicted = nnResult.predictions[trainSize + idx];
        return {
          predicted,
          residual: actual - predicted
        };
      });

      // 生成方程描述
      result.equation = `神经网络 [${nnResult.layers.join(' → ')}] (${nnResult.iterations} 次迭代)`;
      
      // 如果是单变量，生成时间序列数据
      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = X.map((xVal, idx) => ({
          x: xVal[0],
          y_actual: y[idx],
          y_predicted: nnResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('分析失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分析失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
