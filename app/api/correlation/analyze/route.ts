/**
 * API: 执行关联分析
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

// 多项式回归分析
function polynomialRegression(
  X: number[][],
  y: number[],
  degree: number
): {
  coefficients: number[];
  r2: number;
  predictions: number[];
} {
  const n = X.length;
  const m = X[0].length;

  // 生成多项式特征
  const XPoly: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = [1]; // 截距项
    for (let j = 0; j < m; j++) {
      for (let d = 1; d <= degree; d++) {
        row.push(Math.pow(X[i][j], d));
      }
    }
    XPoly.push(row);
  }

  // 使用正规方程求解: β = (X^T X)^(-1) X^T y
  const XT = transpose(XPoly);
  const XTX = matrixMultiply(XT, XPoly);
  const XTy = matrixVectorMultiply(XT, y);
  
  const coefficients = solveLinearSystem(XTX, XTy);
  
  // 计算预测值
  const predictions = XPoly.map(row => 
    row.reduce((sum, val, idx) => sum + val * coefficients[idx], 0)
  );

  // 计算 R²
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
  const ssRes = y.reduce((sum, val, idx) => sum + Math.pow(val - predictions[idx], 2), 0);
  const r2 = 1 - (ssRes / ssTot);

  return { coefficients, r2, predictions };
}

// 线性回归（用于神经网络的简化版本）
function linearRegression(
  X: number[][],
  y: number[]
): {
  coefficients: number[];
  intercept: number;
  r2: number;
  predictions: number[];
} {
  const n = X.length;
  const m = X[0].length;

  // 标准化数据
  const XNorm = normalizeData(X);
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const yNorm = y.map(val => val - yMean);

  // 使用正规方程
  const XT = transpose(XNorm.data);
  const XTX = matrixMultiply(XT, XNorm.data);
  const XTy = matrixVectorMultiply(XT, yNorm);
  
  const coefficients = solveLinearSystem(XTX, XTy);
  
  // 反标准化系数
  const realCoefficients = coefficients.map((coef, idx) => 
    coef / XNorm.std[idx]
  );
  
  const intercept = yMean - realCoefficients.reduce((sum, coef, idx) => 
    sum + coef * XNorm.mean[idx], 0
  );

  // 计算预测值
  const predictions = X.map(row => 
    intercept + row.reduce((sum, val, idx) => sum + val * realCoefficients[idx], 0)
  );

  // 计算 R²
  const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
  const ssRes = y.reduce((sum, val, idx) => sum + Math.pow(val - predictions[idx], 2), 0);
  const r2 = 1 - (ssRes / ssTot);

  return { coefficients: realCoefficients, intercept, r2, predictions };
}

// 矩阵转置
function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

// 矩阵乘法
function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < A.length; i++) {
    result[i] = [];
    for (let j = 0; j < B[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < A[0].length; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

// 矩阵向量乘法
function matrixVectorMultiply(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((sum, val, idx) => sum + val * v[idx], 0));
}

// 求解线性方程组（高斯消元法）
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  // 前向消元
  for (let i = 0; i < n; i++) {
    // 找主元
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // 消元
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  // 回代
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }

  return x;
}

// 数据标准化
function normalizeData(X: number[][]): {
  data: number[][];
  mean: number[];
  std: number[];
} {
  const n = X.length;
  const m = X[0].length;
  
  const mean = new Array(m).fill(0);
  const std = new Array(m).fill(0);
  
  // 计算均值
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      mean[j] += X[i][j];
    }
    mean[j] /= n;
  }
  
  // 计算标准差
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      std[j] += Math.pow(X[i][j] - mean[j], 2);
    }
    std[j] = Math.sqrt(std[j] / n);
    if (std[j] === 0) std[j] = 1; // 避免除零
  }
  
  // 标准化
  const data = X.map(row => 
    row.map((val, j) => (val - mean[j]) / std[j])
  );
  
  return { data, mean, std };
}

// 移除异常值
function removeOutliers(data: any[], fields: string[]): any[] {
  let filtered = [...data];
  
  for (const field of fields) {
    const values = filtered.map(row => row[field]).sort((a, b) => a - b);
    const q1 = values[Math.floor(values.length * 0.25)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    filtered = filtered.filter(row => 
      row[field] >= lowerBound && row[field] <= upperBound
    );
  }
  
  return filtered;
}

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

    if (!xFieldsStr || !yField || !startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const xFields = xFieldsStr.split(',').map(f => f.trim());

    // 连接数据库
    connection = await mysql.createConnection(DB_CONFIG);

    // 构建查询
    const allFields = [...xFields, yField];
    const whereConditions = allFields.map(f => `${f} > 0`).join(' AND ');
    
    const query = `
      SELECT ${allFields.join(', ')}
      FROM fuan_data
      WHERE ${whereConditions}
        AND collect_time >= ?
        AND collect_time <= ?
      ORDER BY collect_time
    `;

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
      // 多项式回归
      const trainResult = polynomialRegression(XTrain, yTrain, degree);
      const testResult = polynomialRegression(XTest, yTest, degree);

      result.r2_train = trainResult.r2;
      result.r2_test = testResult.r2;
      result.mse_train = yTrain.reduce((sum, val, idx) => 
        sum + Math.pow(val - trainResult.predictions[idx], 2), 0) / yTrain.length;
      result.mse_test = yTest.reduce((sum, val, idx) => 
        sum + Math.pow(val - testResult.predictions[idx], 2), 0) / yTest.length;

      // 生成散点图数据
      result.scatter_data = yTest.map((actual, idx) => ({
        actual,
        predicted: testResult.predictions[idx]
      }));

      // 生成残差数据
      result.residuals_data = testResult.predictions.map((pred, idx) => ({
        predicted: pred,
        residual: yTest[idx] - pred
      }));

      result.equation = `多项式回归 (阶数=${degree})`;

    } else {
      // 线性回归（作为神经网络的简化实现）
      const trainResult = linearRegression(XTrain, yTrain);
      const testPredictions = XTest.map(row => 
        trainResult.intercept + row.reduce((sum, val, idx) => 
          sum + val * trainResult.coefficients[idx], 0)
      );

      const yTestMean = yTest.reduce((a, b) => a + b, 0) / yTest.length;
      const ssTot = yTest.reduce((sum, val) => sum + Math.pow(val - yTestMean, 2), 0);
      const ssRes = yTest.reduce((sum, val, idx) => sum + Math.pow(val - testPredictions[idx], 2), 0);
      const r2Test = 1 - (ssRes / ssTot);

      result.r2_train = trainResult.r2;
      result.r2_test = r2Test;
      result.mse_train = yTrain.reduce((sum, val, idx) => 
        sum + Math.pow(val - trainResult.predictions[idx], 2), 0) / yTrain.length;
      result.mse_test = yTest.reduce((sum, val, idx) => 
        sum + Math.pow(val - testPredictions[idx], 2), 0) / yTest.length;

      result.coefficients = {};
      xFields.forEach((field, idx) => {
        result.coefficients[field] = trainResult.coefficients[idx];
      });
      result.intercept = trainResult.intercept;

      // 特征重要性（基于系数的绝对值）
      const totalImportance = trainResult.coefficients.reduce((sum, coef) => 
        sum + Math.abs(coef), 0);
      result.feature_importance = {};
      xFields.forEach((field, idx) => {
        result.feature_importance[field] = Math.abs(trainResult.coefficients[idx]) / totalImportance;
      });

      // 生成散点图数据
      result.scatter_data = yTest.map((actual, idx) => ({
        actual,
        predicted: testPredictions[idx]
      }));

      // 生成残差数据
      result.residuals_data = testPredictions.map((pred, idx) => ({
        predicted: pred,
        residual: yTest[idx] - pred
      }));

      // 生成回归方程
      const equationParts = xFields.map((field, idx) => 
        `${trainResult.coefficients[idx].toFixed(4)} × ${field}`
      );
      result.equation = `${yField} = ${equationParts.join(' + ')} + ${trainResult.intercept.toFixed(4)}`;
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
