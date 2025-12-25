# Python分析脚本

本目录包含用于数据分析的Python脚本，由Node.js后端调用。

## 安装依赖

### 方法1: 使用 --break-system-packages (快速方法)

```bash
pip3 install --break-system-packages -r scripts/requirements.txt
```

### 方法2: 使用虚拟环境 (推荐)

```bash
cd scripts
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或 venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

**注意**: 如果使用虚拟环境，需要修改 `lib/analysis/pythonRunner.ts` 中的 Python 路径为虚拟环境中的 Python。

### 方法3: 使用 --user 标志

```bash
pip3 install --user -r scripts/requirements.txt
```

## 脚本说明

### polynomial_regression.py

多项式回归分析脚本。

**输入格式** (通过stdin的JSON):
```json
{
  "X": [[x1_1, x1_2, ...], [x2_1, x2_2, ...], ...],
  "y": [y1, y2, ...],
  "degree": 2
}
```

**输出格式** (通过stdout的JSON):
```json
{
  "coefficients": [c0, c1, c2, ...],
  "r2": 0.95,
  "mse": 0.05,
  "predictions": [pred1, pred2, ...]
}
```

## 测试脚本

可以使用以下命令测试脚本：

```bash
echo '{"X": [[1], [2], [3], [4], [5]], "y": [2, 4, 6, 8, 10], "degree": 1}' | python3 polynomial_regression.py
```

预期输出应该是一个线性回归结果（R² 接近 1.0）。
