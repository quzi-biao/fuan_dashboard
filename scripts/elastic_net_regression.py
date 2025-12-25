#!/usr/bin/env python3
"""
弹性网络回归分析脚本（L1+L2正则化）
通过命令行接收JSON格式的数据，执行弹性网络回归分析，返回JSON格式的结果
结合了Ridge和Lasso的优点
"""

import sys
import json
import numpy as np
from sklearn.linear_model import ElasticNet
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.model_selection import train_test_split


def elastic_net_regression(X, y, alpha=1.0, l1_ratio=0.5, test_size=0.2, random_state=42):
    """
    执行弹性网络回归分析
    模型形式: y = b0 + b1*x1 + b2*x2 + ... + L1和L2正则化项
    
    参数:
        X: 自变量数据 (n_samples, n_features)
        y: 因变量数据 (n_samples,)
        alpha: 正则化强度
        l1_ratio: L1正则化比例（0-1之间，0为纯Ridge，1为纯Lasso）
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
    
    # 数据标准化
    scaler_X = StandardScaler()
    scaler_y = StandardScaler()
    
    X_train_scaled = scaler_X.fit_transform(X_train)
    X_test_scaled = scaler_X.transform(X_test)
    X_scaled = scaler_X.transform(X)
    
    y_train_scaled = scaler_y.fit_transform(y_train.reshape(-1, 1)).ravel()
    
    # 训练弹性网络回归模型
    model = ElasticNet(alpha=alpha, l1_ratio=l1_ratio, random_state=random_state, max_iter=10000)
    model.fit(X_train_scaled, y_train_scaled)
    
    # 预测（标准化空间）
    y_pred_train_scaled = model.predict(X_train_scaled)
    y_pred_test_scaled = model.predict(X_test_scaled)
    y_pred_all_scaled = model.predict(X_scaled)
    
    # 反标准化
    y_pred_train = scaler_y.inverse_transform(y_pred_train_scaled.reshape(-1, 1)).ravel()
    y_pred_test = scaler_y.inverse_transform(y_pred_test_scaled.reshape(-1, 1)).ravel()
    y_pred_all = scaler_y.inverse_transform(y_pred_all_scaled.reshape(-1, 1)).ravel()
    
    # 计算R²和MSE
    r2_train = r2_score(y_train, y_pred_train)
    r2_test = r2_score(y_test, y_pred_test)
    mse_train = mean_squared_error(y_train, y_pred_train)
    mse_test = mean_squared_error(y_test, y_pred_test)
    
    # 获取系数
    coef = model.coef_
    
    # 统计非零系数
    non_zero_features = np.sum(np.abs(coef) > 1e-10)
    
    coefficients = {
        'intercept': float(model.intercept_),
        'coef': coef.tolist() if len(coef) > 1 else float(coef[0]),
        'alpha': float(alpha),
        'l1_ratio': float(l1_ratio),
        'non_zero_features': int(non_zero_features),
        'total_features': int(len(coef))
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
        alpha = input_data.get('alpha', 1.0)
        l1_ratio = input_data.get('l1_ratio', 0.5)
        test_size = input_data.get('test_size', 0.2)
        random_state = input_data.get('random_state', 42)
        
        # 执行弹性网络回归
        result = elastic_net_regression(X, y, alpha, l1_ratio, test_size, random_state)
        
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
