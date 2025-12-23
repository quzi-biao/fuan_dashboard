/**
 * 多项式回归分析
 */
import { transpose, matrixMultiply, matrixVectorMultiply, solveLinearSystem } from './matrixUtils';

export function polynomialRegression(
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
