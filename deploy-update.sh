#!/bin/bash

# 福安水厂仪表盘 - Docker 更新部署脚本
# 用于重新构建镜像并更新运行中的容器

set -e

echo "🔄 开始更新 Docker 部署..."

# 设置镜像名称
IMAGE_NAME="fuan-dashboard"
CONTAINER_NAME="fuan-dashboard"

# 1. 停止并删除旧容器
echo ""
echo "📦 停止并删除旧容器..."
docker-compose down

# 2. 删除旧镜像（可选，释放空间）
echo ""
echo "🗑️  删除旧镜像..."
docker rmi ${IMAGE_NAME}:latest 2>/dev/null || echo "旧镜像不存在，跳过删除"

# 3. 重新构建镜像
echo ""
echo "🔨 重新构建镜像..."
docker-compose build --no-cache

# 4. 启动新容器
echo ""
echo "🚀 启动新容器..."
docker-compose up -d

# 5. 查看容器状态
echo ""
echo "📊 容器状态:"
docker-compose ps

# 6. 查看最近的日志
echo ""
echo "📋 最近的日志:"
docker-compose logs --tail=50

echo ""
echo "✅ 更新部署完成！"
echo ""
echo "🎯 下一步操作:"
echo "  1. 查看实时日志: docker-compose logs -f"
echo "  2. 查看容器状态: docker-compose ps"
echo "  3. 进入容器: docker-compose exec fuan-dashboard sh"
echo "  4. 停止服务: docker-compose down"
