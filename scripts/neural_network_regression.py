#!/usr/bin/env python3
"""
神经网络回归分析脚本
通过命令行接收JSON格式的数据，执行神经网络回归分析，返回JSON格式的结果
"""

import sys
import json
import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.model_selection import train_test_split
import warnings

warnings.filterwarnings('ignore')


def calculate_feature_importance(model, scaler_X, X_train, y_train):
    """
    计算特征重要性（基于权重分析）
    """
    try:
        # 获取第一层的权重
        first_layer_weights = model.coefs_[0]
        
        # 计算每个特征的平均绝对权重
        feature_importance = np.abs(first_layer_weights).mean(axis=1)
        
        # 归一化到0-1范围
        if feature_importance.max() > 0:
            feature_importance = feature_importance / feature_importance.max()
        
        return feature_importance.tolist()
    except Exception as e:
        # 如果计算失败，返回均等重要性
        return [1.0 / X_train.shape[1]] * X_train.shape[1]


def neural_network_regression(X, y, X_fields, hidden_layers=(100, 50), max_iter=1000, random_state=42):
    """
    执行神经网络回归分析
    
    参数:
        X: 自变量数据 (n_samples, n_features)
        y: 因变量数据 (n_samples,)
        X_fields: 自变量字段名列表
        hidden_layers: 隐藏层结构，例如 (100, 50)
        max_iter: 最大迭代次数
        random_state: 随机种子
    
    返回:
        dict: 包含R²、MSE、预测值、特征重要性等结果
    """
    # 转换为numpy数组
    X = np.array(X)
    y = np.array(y)
    
    # 分割训练集和测试集 (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=random_state
    )
    
    # 数据标准化
    scaler_X = StandardScaler()
    scaler_y = StandardScaler()
    
    X_train_scaled = scaler_X.fit_transform(X_train)
    X_test_scaled = scaler_X.transform(X_test)
    y_train_scaled = scaler_y.fit_transform(y_train.reshape(-1, 1)).ravel()
    
    # 创建神经网络模型
    model = MLPRegressor(
        hidden_layer_sizes=hidden_layers,
        max_iter=max_iter,
        random_state=random_state,
        alpha=0.001,
        learning_rate_init=0.001,
        solver='adam',
        activation='relu',
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=10,
        verbose=False
    )
    
    # 训练模型
    model.fit(X_train_scaled, y_train_scaled)
    
    # 预测（训练集）
    y_pred_train_scaled = model.predict(X_train_scaled)
    y_pred_train = scaler_y.inverse_transform(y_pred_train_scaled.reshape(-1, 1)).ravel()
    
    # 预测（测试集）
    y_pred_test_scaled = model.predict(X_test_scaled)
    y_pred_test = scaler_y.inverse_transform(y_pred_test_scaled.reshape(-1, 1)).ravel()
    
    # 预测（全部数据，用于时间序列绘图）
    X_all_scaled = scaler_X.transform(X)
    y_pred_all_scaled = model.predict(X_all_scaled)
    y_pred_all = scaler_y.inverse_transform(y_pred_all_scaled.reshape(-1, 1)).ravel()
    
    # 评估指标
    r2_train = r2_score(y_train, y_pred_train)
    r2_test = r2_score(y_test, y_pred_test)
    mse_train = mean_squared_error(y_train, y_pred_train)
    mse_test = mean_squared_error(y_test, y_pred_test)
    
    # 计算特征重要性
    feature_importance_values = calculate_feature_importance(model, scaler_X, X_train, y_train)
    feature_importance = {
        X_fields[i]: float(feature_importance_values[i])
        for i in range(len(X_fields))
    }
    
    # 获取网络结构信息
    # hidden_layers 可能是元组或列表，统一转换为列表
    hidden_layers_list = list(hidden_layers) if isinstance(hidden_layers, (tuple, list)) else [hidden_layers]
    layers = [X.shape[1]] + hidden_layers_list + [1]
    
    # 获取训练迭代次数
    n_iter = model.n_iter_
    
    # 获取损失曲线（如果可用）
    loss_curve = None
    if hasattr(model, 'loss_curve_'):
        loss_curve_data = model.loss_curve_
        # 确保转换为列表
        if isinstance(loss_curve_data, list):
            loss_curve = loss_curve_data
        else:
            loss_curve = loss_curve_data.tolist() if hasattr(loss_curve_data, 'tolist') else list(loss_curve_data)
    
    return {
        'r2_train': float(r2_train),
        'r2_test': float(r2_test),
        'mse_train': float(mse_train),
        'mse_test': float(mse_test),
        'predictions': y_pred_all.tolist(),
        'feature_importance': feature_importance,
        'layers': layers,
        'iterations': int(n_iter),
        'loss_curve': loss_curve
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
        X_fields = input_data.get('X_fields', [f'x{i+1}' for i in range(len(X[0]))])
        hidden_layers = tuple(input_data.get('hidden_layers', [100, 50]))
        max_iter = input_data.get('max_iter', 1000)
        random_state = input_data.get('random_state', 42)
        
        # 执行神经网络回归
        result = neural_network_regression(
            X, y, X_fields, hidden_layers, max_iter, random_state
        )
        
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
