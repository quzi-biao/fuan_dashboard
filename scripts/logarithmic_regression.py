#!/usr/bin/env python3
"""
对数回归分析脚本
通过命令行接收JSON格式的数据，执行对数回归分析，返回JSON格式的结果
使用对数变换将对数关系转换为线性关系
"""

import sys
import json
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.model_selection import train_test_split


def logarithmic_regression(X, y, test_size=0.2, random_state=42):
    """
    执行对数回归分析
    模型形式: y = a + b*ln(x) 或 y = a + b1*ln(x1) + b2*ln(x2) + ...
    
    参数:
        X: 自变量数据 (n_samples, n_features)
        y: 因变量数据 (n_samples,)
        test_size: 测试集比例
        random_state: 随机种子
    
    返回:
        dict: 包含系数、R²、预测值等结果
    """
    # 转换为numpy数组
    X = np.array(X)
    y = np.array(y)
    
    # 确保X中所有值都是正数（对数回归要求）
    if np.any(X <= 0):
        # 将所有值平移到正数区域
        X_min = np.min(X, axis=0)
        for i in range(X.shape[1]):
            if X_min[i] <= 0:
                X[:, i] = X[:, i] - X_min[i] + 1
    
    # 对X取对数
    log_X = np.log(X)
    
    # 分割训练集和测试集（随机打乱）
    log_X_train, log_X_test, y_train, y_test = train_test_split(
        log_X, y, test_size=test_size, random_state=random_state, shuffle=True
    )
    
    # 同时保存原始X用于后续使用
    X_train, X_test = train_test_split(
        X, test_size=test_size, random_state=random_state, shuffle=True
    )[0:2]
    
    # 训练线性回归模型（对log(X)）
    model = LinearRegression()
    model.fit(log_X_train, y_train)
    
    # 预测
    y_pred_train = model.predict(log_X_train)
    y_pred_test = model.predict(log_X_test)
    y_pred_all = model.predict(log_X)
    
    # 计算R²和MSE
    r2_train = r2_score(y_train, y_pred_train)
    r2_test = r2_score(y_test, y_pred_test)
    mse_train = mean_squared_error(y_train, y_pred_train)
    mse_test = mean_squared_error(y_test, y_pred_test)
    
    # 获取系数
    # y = intercept + coef[0]*ln(x1) + coef[1]*ln(x2) + ...
    intercept = model.intercept_
    coef = model.coef_
    
    coefficients = {
        'intercept': float(intercept),
        'coef': coef.tolist() if len(coef) > 1 else float(coef[0])
    }
    
    # 计算散点图数据（使用测试集）
    scatter_data = [
        {'actual': float(y_test[i]), 'predicted': float(y_pred_test[i])}
        for i in range(len(y_test))
    ]
    
    # 计算残差数据（使用测试集）
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
        'predictions': y_pred_all.tolist(),
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
        test_size = input_data.get('test_size', 0.2)
        random_state = input_data.get('random_state', 42)
        
        # 执行对数回归
        result = logarithmic_regression(X, y, test_size, random_state)
        
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
