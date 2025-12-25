/**
 * Python脚本执行工具
 * 用于从Node.js调用Python脚本并获取结果
 */

import { spawn } from 'child_process';
import path from 'path';

export interface PythonScriptResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 执行Python脚本
 * @param scriptName - Python脚本文件名（位于scripts目录下）
 * @param inputData - 传递给Python脚本的数据（将通过stdin以JSON格式传递）
 * @returns Promise<PythonScriptResult>
 */
export async function runPythonScript(
  scriptName: string,
  inputData: any
): Promise<PythonScriptResult> {
  return new Promise((resolve) => {
    // 构建脚本路径
    const scriptPath = path.join(process.cwd(), 'scripts', scriptName);
    
    // 启动Python进程
    const pythonProcess = spawn('python3', [scriptPath]);
    
    let stdoutData = '';
    let stderrData = '';
    
    // 收集stdout数据
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    // 收集stderr数据
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    // 处理进程结束
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdoutData);
          resolve({
            success: true,
            data: result
          });
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to parse Python output: ${e instanceof Error ? e.message : 'Unknown error'}`
          });
        }
      } else {
        // 尝试解析stderr中的错误信息
        let errorMessage = stderrData;
        try {
          const errorObj = JSON.parse(stderrData);
          errorMessage = errorObj.error || stderrData;
        } catch {
          // 如果stderr不是JSON，直接使用原始内容
        }
        
        resolve({
          success: false,
          error: errorMessage || `Python script exited with code ${code}`
        });
      }
    });
    
    // 处理进程错误
    pythonProcess.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to start Python process: ${error.message}`
      });
    });
    
    // 将输入数据写入stdin
    try {
      pythonProcess.stdin.write(JSON.stringify(inputData));
      pythonProcess.stdin.end();
    } catch (e) {
      resolve({
        success: false,
        error: `Failed to write to Python stdin: ${e instanceof Error ? e.message : 'Unknown error'}`
      });
    }
  });
}

/**
 * 执行多项式回归分析（Python版本）
 */
export async function polynomialRegressionPython(
  X: number[][],
  y: number[],
  degree: number
): Promise<{
  coefficients: number[];
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('polynomial_regression.py', {
    X,
    y,
    degree
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Python script execution failed');
  }
  
  return result.data;
}

/**
 * 执行神经网络回归分析（Python版本）
 */
export async function neuralNetworkRegressionPython(
  X: number[][],
  y: number[],
  X_fields: string[],
  hidden_layers: number[] = [100, 50],
  max_iter: number = 1000
): Promise<{
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  feature_importance: Record<string, number>;
  layers: number[];
  iterations: number;
  loss_curve?: number[];
}> {
  const result = await runPythonScript('neural_network_regression.py', {
    X,
    y,
    X_fields,
    hidden_layers,
    max_iter,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Neural network Python script execution failed');
  }
  
  return result.data;
}

/**
 * 执行指数回归分析（Python版本）
 */
export async function exponentialRegressionPython(
  X: number[][],
  y: number[]
): Promise<{
  coefficients: { a: number; b: number | number[] };
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('exponential_regression.py', {
    X,
    y,
    test_size: 0.2,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Exponential regression Python script execution failed');
  }
  
  return result.data;
}

/**
 * 执行对数回归分析（Python版本）
 */
export async function logarithmicRegressionPython(
  X: number[][],
  y: number[]
): Promise<{
  coefficients: { intercept: number; coef: number | number[] };
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('logarithmic_regression.py', {
    X,
    y,
    test_size: 0.2,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Logarithmic regression Python script execution failed');
  }
  
  return result.data;
}

/**
 * 线性回归（Python实现）
 */
export async function linearRegressionPython(
  X: number[][],
  y: number[]
): Promise<{
  coefficients: { intercept: number; coef: number | number[] };
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('linear_regression.py', {
    X,
    y,
    test_size: 0.2,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Linear regression Python script execution failed');
  }
  
  return result.data;
}

/**
 * 幂函数回归（Python实现）
 */
export async function powerRegressionPython(
  X: number[][],
  y: number[]
): Promise<{
  coefficients: { a: number; b: number | number[] };
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('power_regression.py', {
    X,
    y,
    test_size: 0.2,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Power regression Python script execution failed');
  }
  
  return result.data;
}

/**
 * 岭回归（Python实现）
 */
export async function ridgeRegressionPython(
  X: number[][],
  y: number[],
  alpha: number = 1.0
): Promise<{
  coefficients: { intercept: number; coef: number | number[]; alpha: number };
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('ridge_regression.py', {
    X,
    y,
    alpha,
    test_size: 0.2,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Ridge regression Python script execution failed');
  }
  
  return result.data;
}

/**
 * Lasso回归（Python实现）
 */
export async function lassoRegressionPython(
  X: number[][],
  y: number[],
  alpha: number = 1.0
): Promise<{
  coefficients: { intercept: number; coef: number | number[]; alpha: number; non_zero_features: number; total_features: number };
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('lasso_regression.py', {
    X,
    y,
    alpha,
    test_size: 0.2,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Lasso regression Python script execution failed');
  }
  
  return result.data;
}

/**
 * 弹性网络回归（Python实现）
 */
export async function elasticNetRegressionPython(
  X: number[][],
  y: number[],
  alpha: number = 1.0,
  l1_ratio: number = 0.5
): Promise<{
  coefficients: { intercept: number; coef: number | number[]; alpha: number; l1_ratio: number; non_zero_features: number; total_features: number };
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('elastic_net_regression.py', {
    X,
    y,
    alpha,
    l1_ratio,
    test_size: 0.2,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'ElasticNet regression Python script execution failed');
  }
  
  return result.data;
}

/**
 * 支持向量回归（Python实现）
 */
export async function svrRegressionPython(
  X: number[][],
  y: number[],
  kernel: string = 'rbf',
  C: number = 1.0,
  epsilon: number = 0.1
): Promise<{
  model_params: { kernel: string; C: number; epsilon: number; n_support_vectors: number | null };
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('svr_regression.py', {
    X,
    y,
    kernel,
    C,
    epsilon,
    test_size: 0.2,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'SVR Python script execution failed');
  }
  
  return result.data;
}

/**
 * 随机森林回归（Python实现）
 */
export async function randomForestRegressionPython(
  X: number[][],
  y: number[],
  n_estimators: number = 100,
  max_depth: number | null = null
): Promise<{
  model_params: { n_estimators: number; max_depth: number | null; n_features: number };
  feature_importance: number[];
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('random_forest_regression.py', {
    X,
    y,
    n_estimators,
    max_depth,
    test_size: 0.2,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Random Forest Python script execution failed');
  }
  
  return result.data;
}

/**
 * 梯度提升回归（Python实现）
 */
export async function gradientBoostingRegressionPython(
  X: number[][],
  y: number[],
  n_estimators: number = 100,
  learning_rate: number = 0.1,
  max_depth: number = 3
): Promise<{
  model_params: { n_estimators: number; learning_rate: number; max_depth: number; n_features: number; n_estimators_used: number };
  feature_importance: number[];
  r2_train: number;
  r2_test: number;
  mse_train: number;
  mse_test: number;
  predictions: number[];
  scatter_data: Array<{ actual: number; predicted: number }>;
  residuals_data: Array<{ predicted: number; residual: number }>;
}> {
  const result = await runPythonScript('gradient_boosting_regression.py', {
    X,
    y,
    n_estimators,
    learning_rate,
    max_depth,
    test_size: 0.2,
    random_state: 42
  });
  
  if (!result.success) {
    throw new Error(result.error || 'Gradient Boosting Python script execution failed');
  }
  
  return result.data;
}
