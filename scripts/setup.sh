#!/bin/bash

# Python分析脚本依赖安装脚本

echo "正在安装Python依赖..."

# 尝试使用 --break-system-packages 安装
if pip3 install --break-system-packages -r requirements.txt 2>/dev/null; then
    echo "✓ 依赖安装成功 (使用 --break-system-packages)"
    exit 0
fi

# 如果失败，提示用户手动安装
echo ""
echo "自动安装失败。请手动执行以下命令之一："
echo ""
echo "方法1 (推荐): 使用 --break-system-packages"
echo "  pip3 install --break-system-packages numpy scikit-learn"
echo ""
echo "方法2: 使用虚拟环境"
echo "  python3 -m venv venv"
echo "  source venv/bin/activate"
echo "  pip install numpy scikit-learn"
echo ""
echo "方法3: 使用 Homebrew"
echo "  brew install numpy"
echo "  # scikit-learn 可能需要通过 pip 安装"
echo ""

exit 1
