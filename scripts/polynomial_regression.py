#!/usr/bin/env python3
"""
多项式回归分析脚本
通过命令行接收JSON格式的数据，执行多项式回归分析，返回JSON格式的结果
"""

import sys
import json
import numpy as np
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_squared_error


def polynomial_regression(X, y, degree=2):
    """
    执行多项式回归分析
    
    参数:
        X: 自变量数据 (n_samples, n_features)
        y: 因变量数据 (n_samples,)
        degree: 多项式阶数
    
    返回:
        dict: 包含系数、R²、预测值等结果
    """
    # 转换为numpy数组
    X = np.array(X)
    y = np.array(y)
    
    # 生成多项式特征
    poly = PolynomialFeatures(degree=degree, include_bias=True)
    X_poly = poly.fit_transform(X)
    
    # 训练线性回归模型
    model = LinearRegression(fit_intercept=False)  # 已经包含了截距项
    model.fit(X_poly, y)
    
    # 预测
    predictions = model.predict(X_poly)
    
    # 计算R²
    r2 = r2_score(y, predictions)
    
    # 计算MSE
    mse = mean_squared_error(y, predictions)
    
    # 获取系数
    coefficients = model.coef_.tolist()
    
    return {
        'coefficients': coefficients,
        'r2': float(r2),
        'mse': float(mse),
        'predictions': predictions.tolist()
    }


def main():
    """
    主函数：从stdin读取JSON数据，执行分析，输出JSON结果
    """
    try:
        # 从stdin读取输入数据
        input_data = json.loads(sys.stdin.read())
        
        X = input_data['X']
        y = input_data['y']
        degree = input_data.get('degree', 2)
        
        # 执行多项式回归
        result = polynomial_regression(X, y, degree)
        
        # 输出结果
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        # 输出错误信息
        error_result = {
            'error': str(e),
            'type': type(e).__name__
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
