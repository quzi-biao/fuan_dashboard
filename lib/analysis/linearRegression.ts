/**
 * 线性回归分析
 */
import { transpose, matrixMultiply, matrixVectorMultiply, solveLinearSystem } from './matrixUtils';
import { normalizeData } from './dataUtils';

export function linearRegression(
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
