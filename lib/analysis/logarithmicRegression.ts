/**
 * 对数回归分析
 * 模型形式: y = a + b*ln(x) 或多变量: y = a + b1*ln(x1) + b2*ln(x2) + ...
 */
import { transpose, matrixMultiply, matrixVectorMultiply, solveLinearSystem } from './matrixUtils';

export function logarithmicRegression(
  X: number[][],
  y: number[],
): {
  coefficients: number[];
  r2: number;
  predictions: number[];
} {
  const n = X.length;
  const m = X[0].length;

  // 过滤掉 x <= 0 的数据点，因为对数变换要求 x > 0
  const validIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    let allPositive = true;
    for (let j = 0; j < m; j++) {
      if (X[i][j] <= 0) {
        allPositive = false;
        break;
      }
    }
    if (allPositive) {
      validIndices.push(i);
    }
  }

  if (validIndices.length < 3) {
    throw new Error('对数回归需要至少3个正数据点');
  }

  // 对 X 进行对数变换
  const lnX: number[][] = [];
  const yFiltered: number[] = [];
  
  for (const i of validIndices) {
    const lnRow = X[i].map(val => Math.log(val));
    lnX.push(lnRow);
    yFiltered.push(y[i]);
  }

  // 构建设计矩阵 [1, ln(x1), ln(x2), ...]
  const XDesign: number[][] = [];
  for (let i = 0; i < lnX.length; i++) {
    const row = [1, ...lnX[i]];
    XDesign.push(row);
  }

  // 使用正规方程求解: β = (X^T X)^(-1) X^T y
  const XT = transpose(XDesign);
  const XTX = matrixMultiply(XT, XDesign);
  const XTy = matrixVectorMultiply(XT, yFiltered);
  
  const coefficients = solveLinearSystem(XTX, XTy);
  
  // 计算预测值: y = a + b1*ln(x1) + b2*ln(x2) + ...
  const predictions = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = coefficients[0]; // 截距项
    let allPositive = true;
    for (let j = 0; j < m; j++) {
      if (X[i][j] <= 0) {
        allPositive = false;
        break;
      }
      sum += coefficients[j + 1] * Math.log(X[i][j]);
    }
    // 如果有非正值，预测为均值
    predictions[i] = allPositive ? sum : yFiltered.reduce((a, b) => a + b, 0) / yFiltered.length;
  }

  // 计算 R² (使用原始 y 值)
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
  const ssRes = y.reduce((sum, val, idx) => sum + Math.pow(val - predictions[idx], 2), 0);
  const r2 = 1 - (ssRes / ssTot);

  return { coefficients, r2, predictions };
}
