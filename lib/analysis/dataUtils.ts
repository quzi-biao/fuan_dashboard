/**
 * 数据处理工具函数
 */

/**
 * 数据标准化
 */
export function normalizeData(X: number[][]): {
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

/**
 * 移除异常值（使用IQR方法）
 */
export function removeOutliers(data: any[], fields: string[]): any[] {
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
