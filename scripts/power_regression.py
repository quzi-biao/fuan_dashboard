#!/usr/bin/env python3
"""
幂函数回归分析脚本
通过命令行接收JSON格式的数据，执行幂函数回归分析，返回JSON格式的结果
使用对数变换将幂函数关系转换为线性关系
"""

import sys
import json
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.model_selection import train_test_split


def power_regression(X, y, test_size=0.2, random_state=42):
    """
    执行幂函数回归分析
    模型形式: y = a * x^b 或 y = a * x1^b1 * x2^b2 * ...
    通过对数变换: ln(y) = ln(a) + b*ln(x)
    
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
    
    # 确保X和y中所有值都是正数（幂函数回归要求）
    if np.any(X <= 0):
        X_min = np.min(X, axis=0)
        for i in range(X.shape[1]):
            if X_min[i] <= 0:
                X[:, i] = X[:, i] - X_min[i] + 1
    
    if np.any(y <= 0):
        y_min = np.min(y)
        if y_min <= 0:
            y = y - y_min + 1
    
    # 对X和y都取对数
    log_X = np.log(X)
    log_y = np.log(y)
    
    # 分割训练集和测试集（随机打乱）
    log_X_train, log_X_test, log_y_train, log_y_test, y_train, y_test = train_test_split(
        log_X, log_y, y, test_size=test_size, random_state=random_state, shuffle=True
    )
    
    # 同时保存原始X用于后续使用
    X_train, X_test = train_test_split(
        X, test_size=test_size, random_state=random_state, shuffle=True
    )[0:2]
    
    # 训练线性回归模型（对log(X)和log(y)）
    model = LinearRegression()
    model.fit(log_X_train, log_y_train)
    
    # 预测log(y)
    log_y_pred_train = model.predict(log_X_train)
    log_y_pred_test = model.predict(log_X_test)
    log_y_pred_all = model.predict(log_X)
    
    # 转换回原始尺度
    y_pred_train = np.exp(log_y_pred_train)
    y_pred_test = np.exp(log_y_pred_test)
    y_pred_all = np.exp(log_y_pred_all)
    
    # 计算R²和MSE（在原始尺度上）
    r2_train = r2_score(y_train, y_pred_train)
    r2_test = r2_score(y_test, y_pred_test)
    mse_train = mean_squared_error(y_train, y_pred_train)
    mse_test = mean_squared_error(y_test, y_pred_test)
    
    # 获取系数
    # intercept = ln(a), coef = b
    a = np.exp(model.intercept_)
    b = model.coef_
    
    coefficients = {
        'a': float(a),
        'b': b.tolist() if len(b) > 1 else float(b[0])
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
        
        # 执行幂函数回归
        result = power_regression(X, y, test_size, random_state)
        
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
