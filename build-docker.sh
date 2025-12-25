#!/bin/bash

# 福安水厂仪表盘 Docker 构建脚本
# 包含 Node.js 和 Python 运行环境

set -e

echo "🚀 开始构建 Docker 镜像..."

# 设置镜像名称和标签
IMAGE_NAME="fuan-dashboard"
IMAGE_TAG="${1:-latest}"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo "📦 镜像名称: ${FULL_IMAGE_NAME}"

# 检查 Dockerfile 是否存在
if [ ! -f "Dockerfile" ]; then
    echo "❌ 错误: Dockerfile 不存在"
    exit 1
fi

# 检查 Python 依赖文件
if [ ! -f "scripts/requirements.txt" ]; then
    echo "❌ 错误: scripts/requirements.txt 不存在"
    exit 1
fi

echo "📋 Python 依赖:"
cat scripts/requirements.txt

# 构建镜像
echo ""
echo "🔨 开始构建镜像..."
docker build -t ${FULL_IMAGE_NAME} .

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 镜像构建成功: ${FULL_IMAGE_NAME}"
    echo ""
    echo "📊 镜像信息:"
    docker images ${IMAGE_NAME}
    echo ""
    echo "🎯 下一步操作:"
    echo "  1. 运行容器: docker-compose up -d"
    echo "  2. 查看日志: docker-compose logs -f"
    echo "  3. 停止容器: docker-compose down"
else
    echo ""
    echo "❌ 镜像构建失败"
    exit 1
fi
