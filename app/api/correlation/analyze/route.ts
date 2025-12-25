/**
 * API: 执行关联分析
 */
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { 
  polynomialRegressionPython, 
  neuralNetworkRegressionPython,
  exponentialRegressionPython,
  logarithmicRegressionPython,
  linearRegressionPython,
  powerRegressionPython,
  ridgeRegressionPython,
  lassoRegressionPython,
  elasticNetRegressionPython,
  svrRegressionPython,
  randomForestRegressionPython,
  gradientBoostingRegressionPython
} from '@/lib/analysis/pythonRunner';
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
    console.log('日期参数:', startDate, endDate);
    console.log('查询:', query);
    console.log(`查询到原始数据: ${rows?.length || 0} 条`);

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

    console.log(`转换后数据: ${data.length} 条`);

    // 移除异常值
    const cleanData = removeOutliers(data, allFields);

    console.log(`移除异常值后数据: ${cleanData.length} 条`);
    console.log(`分析字段: X=${xFields.join(',')}, Y=${yField}`);

    if (cleanData.length < 10) {
      return NextResponse.json(
        { 
          error: '有效数据点太少，无法进行分析',
          details: {
            原始数据: rows.length,
            转换后: data.length,
            清洗后: cleanData.length,
            最少需要: 10
          }
        },
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
      // 多项式回归（使用Python，内部进行train/test分割）
      const polyResult = await polynomialRegressionPython(X, y, degree);

      result.r2_train = polyResult.r2_train;
      result.r2_test = polyResult.r2_test;
      result.mse_train = polyResult.mse_train;
      result.mse_test = polyResult.mse_test;

      // 使用Python返回的散点图和残差数据
      result.scatter_data = polyResult.scatter_data;
      result.residuals_data = polyResult.residuals_data;

      // 生成多项式表达式
      // 系数顺序: [截距, x1^1, x1^2, ..., x1^degree, x2^1, x2^2, ..., x2^degree, ...]
      const coeffs = polyResult.coefficients;
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
        result.time_series_data = X.map((xVal, idx) => ({
          x: xVal[0],
          y_actual: y[idx],
          y_predicted: polyResult.predictions[idx]
        }));
        // 按 x 值排序以便绘制曲线
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'exponential') {
      // 指数回归（使用Python，内部进行train/test分割）
      const expResult = await exponentialRegressionPython(X, y);

      result.r2_train = expResult.r2_train;
      result.r2_test = expResult.r2_test;
      result.mse_train = expResult.mse_train;
      result.mse_test = expResult.mse_test;

      // 使用Python返回的散点图和残差数据
      result.scatter_data = expResult.scatter_data;
      result.residuals_data = expResult.residuals_data;

      // 生成方程: y = a * e^(b1*x1 + b2*x2 + ...)
      const { a, b } = expResult.coefficients;
      if (xFields.length === 1) {
        const bVal = typeof b === 'number' ? b : b[0];
        result.equation = `y = ${a.toFixed(4)} · e^(${bVal.toFixed(4)}·x)`;
      } else {
        const bArray = typeof b === 'number' ? [b] : b;
        const exponentParts = bArray.map((coef, i) => {
          const sign = coef >= 0 && i > 0 ? '+' : '';
          return `${sign}${coef.toFixed(4)}·x${i + 1}`;
        });
        result.equation = `y = ${a.toFixed(4)} · e^(${exponentParts.join(' ')})`;
      }

      // 如果是单变量，返回时间序列数据
      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = X.map((xVal, idx) => ({
          x: xVal[0],
          y_actual: y[idx],
          y_predicted: expResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'logarithmic') {
      // 对数回归（使用Python，内部进行train/test分割）
      const logResult = await logarithmicRegressionPython(X, y);

      result.r2_train = logResult.r2_train;
      result.r2_test = logResult.r2_test;
      result.mse_train = logResult.mse_train;
      result.mse_test = logResult.mse_test;

      // 使用Python返回的散点图和残差数据
      result.scatter_data = logResult.scatter_data;
      result.residuals_data = logResult.residuals_data;

      // 生成方程: y = a + b1*ln(x1) + b2*ln(x2) + ...
      const { intercept, coef } = logResult.coefficients;
      if (xFields.length === 1) {
        const coefVal = typeof coef === 'number' ? coef : coef[0];
        const sign = coefVal >= 0 ? '+' : '';
        result.equation = `y = ${intercept.toFixed(4)} ${sign}${coefVal.toFixed(4)}·ln(x)`;
      } else {
        const coefArray = typeof coef === 'number' ? [coef] : coef;
        let equation = `y = ${intercept.toFixed(4)}`;
        coefArray.forEach((c, i) => {
          const sign = c >= 0 ? '+' : '';
          equation += ` ${sign}${c.toFixed(4)}·ln(x${i + 1})`;
        });
        result.equation = equation;
      }

      // 如果是单变量，返回时间序列数据
      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = X.map((xVal, idx) => ({
          x: xVal[0],
          y_actual: y[idx],
          y_predicted: logResult.predictions[idx]
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
      
    } else if (analysisType === 'linear') {
      // 线性回归（使用Python）
      const linearResult = await linearRegressionPython(X, y);

      result.r2_train = linearResult.r2_train;
      result.r2_test = linearResult.r2_test;
      result.mse_train = linearResult.mse_train;
      result.mse_test = linearResult.mse_test;
      result.scatter_data = linearResult.scatter_data;
      result.residuals_data = linearResult.residuals_data;

      // 生成方程
      const { intercept, coef } = linearResult.coefficients;
      if (xFields.length === 1) {
        const coefVal = typeof coef === 'number' ? coef : coef[0];
        const sign = coefVal >= 0 ? '+' : '';
        result.equation = `y = ${intercept.toFixed(4)} ${sign}${coefVal.toFixed(4)}·${xFields[0]}`;
      } else {
        const coefArray = typeof coef === 'number' ? [coef] : coef;
        let equation = `y = ${intercept.toFixed(4)}`;
        coefArray.forEach((c, i) => {
          const sign = c >= 0 ? '+' : '';
          equation += ` ${sign}${c.toFixed(4)}·${xFields[i]}`;
        });
        result.equation = equation;
      }

      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: linearResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'power') {
      // 幂函数回归（使用Python）
      const powerResult = await powerRegressionPython(X, y);

      result.r2_train = powerResult.r2_train;
      result.r2_test = powerResult.r2_test;
      result.mse_train = powerResult.mse_train;
      result.mse_test = powerResult.mse_test;
      result.scatter_data = powerResult.scatter_data;
      result.residuals_data = powerResult.residuals_data;

      // 生成方程: y = a * x^b
      const { a, b } = powerResult.coefficients;
      if (xFields.length === 1) {
        const bVal = typeof b === 'number' ? b : b[0];
        result.equation = `y = ${a.toFixed(4)} · ${xFields[0]}^${bVal.toFixed(4)}`;
      } else {
        const bArray = typeof b === 'number' ? [b] : b;
        const terms = bArray.map((exp, i) => `${xFields[i]}^${exp.toFixed(4)}`);
        result.equation = `y = ${a.toFixed(4)} · ${terms.join(' · ')}`;
      }

      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: powerResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'ridge') {
      // 岭回归（使用Python）
      const ridgeResult = await ridgeRegressionPython(X, y);

      result.r2_train = ridgeResult.r2_train;
      result.r2_test = ridgeResult.r2_test;
      result.mse_train = ridgeResult.mse_train;
      result.mse_test = ridgeResult.mse_test;
      result.scatter_data = ridgeResult.scatter_data;
      result.residuals_data = ridgeResult.residuals_data;

      const { intercept, coef, alpha } = ridgeResult.coefficients;
      result.equation = `岭回归 (α=${alpha.toFixed(2)})`;

      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: ridgeResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'lasso') {
      // Lasso回归（使用Python）
      const lassoResult = await lassoRegressionPython(X, y);

      result.r2_train = lassoResult.r2_train;
      result.r2_test = lassoResult.r2_test;
      result.mse_train = lassoResult.mse_train;
      result.mse_test = lassoResult.mse_test;
      result.scatter_data = lassoResult.scatter_data;
      result.residuals_data = lassoResult.residuals_data;

      const { alpha, non_zero_features, total_features } = lassoResult.coefficients;
      result.equation = `Lasso回归 (α=${alpha.toFixed(2)}, 选中${non_zero_features}/${total_features}特征)`;

      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: lassoResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'elastic_net') {
      // 弹性网络回归（使用Python）
      const elasticResult = await elasticNetRegressionPython(X, y);

      result.r2_train = elasticResult.r2_train;
      result.r2_test = elasticResult.r2_test;
      result.mse_train = elasticResult.mse_train;
      result.mse_test = elasticResult.mse_test;
      result.scatter_data = elasticResult.scatter_data;
      result.residuals_data = elasticResult.residuals_data;

      const { alpha, l1_ratio, non_zero_features, total_features } = elasticResult.coefficients;
      result.equation = `弹性网络 (α=${alpha.toFixed(2)}, L1比=${l1_ratio.toFixed(2)}, 选中${non_zero_features}/${total_features}特征)`;

      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: elasticResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'svr') {
      // 支持向量回归（使用Python）
      const svrResult = await svrRegressionPython(X, y);

      result.r2_train = svrResult.r2_train;
      result.r2_test = svrResult.r2_test;
      result.mse_train = svrResult.mse_train;
      result.mse_test = svrResult.mse_test;
      result.scatter_data = svrResult.scatter_data;
      result.residuals_data = svrResult.residuals_data;

      const { kernel, C, epsilon } = svrResult.model_params;
      result.equation = `SVR (kernel=${kernel}, C=${C.toFixed(2)}, ε=${epsilon.toFixed(2)})`;

      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: svrResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'random_forest') {
      // 随机森林回归（使用Python）
      const rfResult = await randomForestRegressionPython(X, y);

      result.r2_train = rfResult.r2_train;
      result.r2_test = rfResult.r2_test;
      result.mse_train = rfResult.mse_train;
      result.mse_test = rfResult.mse_test;
      result.scatter_data = rfResult.scatter_data;
      result.residuals_data = rfResult.residuals_data;
      result.feature_importance = rfResult.feature_importance;

      const { n_estimators, max_depth } = rfResult.model_params;
      result.equation = `随机森林 (${n_estimators}棵树, 最大深度=${max_depth || '无限制'})`;

      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: rfResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'gradient_boosting') {
      // 梯度提升回归（使用Python）
      const gbResult = await gradientBoostingRegressionPython(X, y);

      result.r2_train = gbResult.r2_train;
      result.r2_test = gbResult.r2_test;
      result.mse_train = gbResult.mse_train;
      result.mse_test = gbResult.mse_test;
      result.scatter_data = gbResult.scatter_data;
      result.residuals_data = gbResult.residuals_data;
      result.feature_importance = gbResult.feature_importance;

      const { n_estimators_used, learning_rate, max_depth } = gbResult.model_params;
      result.equation = `梯度提升 (${n_estimators_used}次迭代, lr=${learning_rate.toFixed(2)}, 深度=${max_depth})`;

      if (xFields.length === 1) {
        result.is_single_variable = true;
        result.time_series_data = cleanData.map((row, idx) => ({
          x: row[xFields[0]],
          y_actual: row[yField],
          y_predicted: gbResult.predictions[idx]
        }));
        result.time_series_data.sort((a: any, b: any) => a.x - b.x);
      }

    } else if (analysisType === 'neural_network') {
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
    } else {
      // 未实现的分析类型
      return NextResponse.json(
        { 
          error: `分析类型 "${analysisType}" 暂未实现`,
          message: '该分析方法的后端实现正在开发中，请选择其他分析方法。',
          available_types: [
            'linear', 'polynomial', 'exponential', 'logarithmic', 'power',
            'ridge', 'lasso', 'elastic_net', 'svr', 'random_forest', 
            'gradient_boosting', 'neural_network', 'did'
          ]
        },
        { status: 501 }  // 501 Not Implemented
      );
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
