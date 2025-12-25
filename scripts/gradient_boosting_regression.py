#!/usr/bin/env python3
"""
梯度提升回归分析脚本（GBDT）
通过命令行接收JSON格式的数据，执行梯度提升回归分析，返回JSON格式的结果
高精度的集成学习方法，通常比随机森林更准确
"""

import sys
import json
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.model_selection import train_test_split


def gradient_boosting_regression(X, y, n_estimators=100, learning_rate=0.1, max_depth=3, test_size=0.2, random_state=42):
    """
    执行梯度提升回归分析
    
    参数:
        X: 自变量数据 (n_samples, n_features)
        y: 因变量数据 (n_samples,)
        n_estimators: 提升迭代次数（树的数量）
        learning_rate: 学习率
        max_depth: 每棵树的最大深度
        test_size: 测试集比例
        random_state: 随机种子
    
    返回:
        dict: 包含R²、预测值、特征重要性等结果
    """
    # 转换为numpy数组
    X = np.array(X)
    y = np.array(y)
    
    # 分割训练集和测试集（随机打乱）
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, shuffle=True
    )
    
    # 训练梯度提升模型
    model = GradientBoostingRegressor(
        n_estimators=n_estimators,
        learning_rate=learning_rate,
        max_depth=max_depth,
        random_state=random_state,
        validation_fraction=0.1,
        n_iter_no_change=10  # 早停
    )
    model.fit(X_train, y_train)
    
    # 预测
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)
    y_pred_all = model.predict(X)
    
    # 计算R²和MSE
    r2_train = r2_score(y_train, y_pred_train)
    r2_test = r2_score(y_test, y_pred_test)
    mse_train = mean_squared_error(y_train, y_pred_train)
    mse_test = mean_squared_error(y_test, y_pred_test)
    
    # 获取特征重要性
    feature_importance = model.feature_importances_.tolist()
    
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
        'model_params': {
            'n_estimators': int(n_estimators),
            'learning_rate': float(learning_rate),
            'max_depth': int(max_depth),
            'n_features': int(X.shape[1]),
            'n_estimators_used': int(model.n_estimators_)  # 实际使用的估计器数量（考虑早停）
        },
        'feature_importance': feature_importance,
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
        n_estimators = input_data.get('n_estimators', 100)
        learning_rate = input_data.get('learning_rate', 0.1)
        max_depth = input_data.get('max_depth', 3)
        test_size = input_data.get('test_size', 0.2)
        random_state = input_data.get('random_state', 42)
        
        # 执行梯度提升回归
        result = gradient_boosting_regression(X, y, n_estimators, learning_rate, max_depth, test_size, random_state)
        
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
