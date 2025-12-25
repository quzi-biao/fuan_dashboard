/**
 * 指数回归分析
 * 模型形式: y = a * e^(b*x) 或多变量: y = a * e^(b1*x1 + b2*x2 + ...)
 * 通过对数变换转换为线性回归: ln(y) = ln(a) + b*x
 */
import { transpose, matrixMultiply, matrixVectorMultiply, solveLinearSystem } from './matrixUtils';

export function exponentialRegression(
  X: number[][],
  y: number[],
): {
  coefficients: number[];
  r2: number;
  predictions: number[];
  equation?: string;
} {
  const n = X.length;
  const m = X[0].length;

  // 过滤掉 y <= 0 的数据点，因为对数变换要求 y > 0
  const validIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (y[i] > 0) {
      validIndices.push(i);
    }
  }

  if (validIndices.length < 3) {
    throw new Error('指数回归需要至少3个正数据点');
  }

  // 对 y 进行对数变换
  const lnY = validIndices.map(i => Math.log(y[i]));
  const XFiltered = validIndices.map(i => X[i]);

  // 构建设计矩阵 [1, x1, x2, ...]
  const XDesign: number[][] = [];
  for (let i = 0; i < XFiltered.length; i++) {
    const row = [1, ...XFiltered[i]];
    XDesign.push(row);
  }

  // 使用正规方程求解: β = (X^T X)^(-1) X^T ln(y)
  const XT = transpose(XDesign);
  const XTX = matrixMultiply(XT, XDesign);
  const XTlnY = matrixVectorMultiply(XT, lnY);
  
  const coefficients = solveLinearSystem(XTX, XTlnY);
  
  // coefficients[0] = ln(a), coefficients[1..m] = b1, b2, ...
  // 转换回原始参数: a = e^(coefficients[0])
  const a = Math.exp(coefficients[0]);
  const bCoeffs = coefficients.slice(1);

  // 计算预测值: y = a * e^(b1*x1 + b2*x2 + ...)
  const predictions = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let exponent = 0;
    for (let j = 0; j < m; j++) {
      exponent += bCoeffs[j] * X[i][j];
    }
    predictions[i] = a * Math.exp(exponent);
  }

  // 计算 R² (使用原始 y 值)
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
  const ssRes = y.reduce((sum, val, idx) => sum + Math.pow(val - predictions[idx], 2), 0);
  const r2 = 1 - (ssRes / ssTot);

  // 返回原始系数形式 [a, b1, b2, ...]
  const finalCoefficients = [a, ...bCoeffs];

  return { coefficients: finalCoefficients, r2, predictions };
}
