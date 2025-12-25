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
  r2: number;
  predictions: number[];
  mse?: number;
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
