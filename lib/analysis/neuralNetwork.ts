/**
 * 神经网络回归分析
 */
import * as synaptic from 'synaptic';
import { normalizeData } from './dataUtils';

export interface NeuralNetworkResult {
  r2Train: number;
  r2Test: number;
  mseTrain: number;
  mseTest: number;
  predictions: number[];
  featureImportance: Record<string, number>;
  iterations: number;
  layers: number[];
}

/**
 * 训练神经网络并进行预测
 */
export function trainNeuralNetwork(
  XTrain: number[][],
  yTrain: number[],
  XTest: number[][],
  yTest: number[],
  X: number[][],
  y: number[],
  xFields: string[],
  hiddenLayerSizes: number[]
): NeuralNetworkResult {
  // 数据标准化
  const { data: XTrainNorm, mean: XMean, std: XStd } = normalizeData(XTrain);
  const { data: yTrainNorm, mean: yMean, std: yStd } = normalizeData(yTrain.map((v: number) => [v]));
  const yTrainNormFlat = yTrainNorm.map((v: number[]) => v[0]);
  
  // 创建神经网络
  const { Architect } = synaptic;
  const inputSize = XTrain[0].length;
  const layers = [inputSize, ...hiddenLayerSizes, 1];
  const network = new Architect.Perceptron(...layers);
  
  // 训练参数
  const learningRate = 0.001;
  const maxIterations = 1000;
  const errorThreshold = 0.0001;
  
  // 训练网络
  let iterations = 0;
  let prevError = Infinity;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let totalError = 0;
    
    for (let i = 0; i < XTrainNorm.length; i++) {
      const output = network.activate(XTrainNorm[i]);
      network.propagate(learningRate, [yTrainNormFlat[i]]);
      totalError += Math.pow(output[0] - yTrainNormFlat[i], 2);
    }
    
    const avgError = totalError / XTrainNorm.length;
    iterations = iter + 1;
    
    // 早停
    if (Math.abs(prevError - avgError) < errorThreshold) {
      break;
    }
    prevError = avgError;
  }
  
  // 预测训练集
  const yPredTrainNorm = XTrainNorm.map((x: number[]) => network.activate(x)[0]);
  const yPredTrain = yPredTrainNorm.map((v: number) => v * yStd[0] + yMean[0]);
  
  // 预测测试集
  const XTestNorm = XTest.map((row, i) => 
    row.map((val, j) => (val - XMean[j]) / XStd[j])
  );
  const yPredTestNorm = XTestNorm.map((x: number[]) => network.activate(x)[0]);
  const yPredTest = yPredTestNorm.map((v: number) => v * yStd[0] + yMean[0]);
  
  // 计算R²和MSE
  const yTrainMean = yTrain.reduce((a, b) => a + b, 0) / yTrain.length;
  const ssTrainTot = yTrain.reduce((sum, val) => sum + Math.pow(val - yTrainMean, 2), 0);
  const ssTrainRes = yTrain.reduce((sum, val, idx) => sum + Math.pow(val - yPredTrain[idx], 2), 0);
  const r2Train = 1 - (ssTrainRes / ssTrainTot);
  
  const yTestMean = yTest.reduce((a, b) => a + b, 0) / yTest.length;
  const ssTestTot = yTest.reduce((sum, val) => sum + Math.pow(val - yTestMean, 2), 0);
  const ssTestRes = yTest.reduce((sum, val, idx) => sum + Math.pow(val - yPredTest[idx], 2), 0);
  const r2Test = 1 - (ssTestRes / ssTestTot);
  
  const mseTrain = yTrain.reduce((sum, val, idx) => 
    sum + Math.pow(val - yPredTrain[idx], 2), 0) / yTrain.length;
  const mseTest = yTest.reduce((sum, val, idx) => 
    sum + Math.pow(val - yPredTest[idx], 2), 0) / yTest.length;

  // 特征重要性（基于扰动分析）
  const featureImportance: Record<string, number> = {};
  
  for (let featureIdx = 0; featureIdx < inputSize; featureIdx++) {
    let importanceSum = 0;
    
    for (let i = 0; i < Math.min(100, XTestNorm.length); i++) {
      const original = [...XTestNorm[i]];
      const perturbed = [...original];
      perturbed[featureIdx] = 0; // 扰动特征
      
      const originalPred = network.activate(original)[0];
      const perturbedPred = network.activate(perturbed)[0];
      importanceSum += Math.abs(originalPred - perturbedPred);
    }
    
    featureImportance[xFields[featureIdx]] = importanceSum / Math.min(100, XTestNorm.length);
  }
  
  // 归一化特征重要性
  const importanceValues = Object.values(featureImportance) as number[];
  const totalImportance = importanceValues.reduce((a, b) => a + b, 0);
  if (totalImportance > 0) {
    Object.keys(featureImportance).forEach(key => {
      featureImportance[key] /= totalImportance;
    });
  }

  // 预测完整数据集（用于时间序列）
  const XNorm = X.map(row => row.map((val, j) => (val - XMean[j]) / XStd[j]));
  const yPredNorm = XNorm.map((x: number[]) => network.activate(x)[0]);
  const predictions = yPredNorm.map((v: number) => v * yStd[0] + yMean[0]);

  return {
    r2Train,
    r2Test,
    mseTrain,
    mseTest,
    predictions,
    featureImportance,
    iterations,
    layers
  };
}
