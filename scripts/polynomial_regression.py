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
from sklearn.model_selection import train_test_split


def polynomial_regression(X, y, degree=2, test_size=0.2, random_state=42):
    """
    执行多项式回归分析
    
    参数:
        X: 自变量数据 (n_samples, n_features)
        y: 因变量数据 (n_samples,)
        degree: 多项式阶数
        test_size: 测试集比例
        random_state: 随机种子
    
    返回:
        dict: 包含系数、R²、预测值等结果
    """
    # 转换为numpy数组
    X = np.array(X)
    y = np.array(y)
    
    # 分割训练集和测试集（随机打乱）
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, shuffle=True
    )
    
    # 生成多项式特征
    poly = PolynomialFeatures(degree=degree, include_bias=True)
    X_train_poly = poly.fit_transform(X_train)
    X_test_poly = poly.transform(X_test)
    X_poly = poly.transform(X)  # 全部数据的多项式特征
    
    # 训练线性回归模型
    model = LinearRegression(fit_intercept=False)  # 已经包含了截距项
    model.fit(X_train_poly, y_train)
    
    # 预测
    y_pred_train = model.predict(X_train_poly)
    y_pred_test = model.predict(X_test_poly)
    predictions = model.predict(X_poly)  # 全部数据的预测
    
    # 计算R²和MSE
    r2_train = r2_score(y_train, y_pred_train)
    r2_test = r2_score(y_test, y_pred_test)
    mse_train = mean_squared_error(y_train, y_pred_train)
    mse_test = mean_squared_error(y_test, y_pred_test)
    
    # 获取系数
    coefficients = model.coef_.tolist()
    
    # 计算残差数据（使用测试集）
    scatter_data = [
        {'actual': float(y_test[i]), 'predicted': float(y_pred_test[i])}
        for i in range(len(y_test))
    ]
    
    residuals_data = [
        {'predicted': float(y_pred_test[i]), 'residual': float(y_test[i] - y_pred_test[i])}
        for i in range(len(y_test))
    ]
    
    return {
        'coefficients': coefficients,
        'r2_train': float(r2_train),
        'r2_test': float(r2_test),
        'mse_train': float(mse_train),
        'mse_test': float(mse_test),
        'predictions': predictions.tolist(),
        'scatter_data': scatter_data,
        'residuals_data': residuals_data
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
