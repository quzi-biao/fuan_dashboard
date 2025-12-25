#!/bin/bash

# 福安水厂仪表盘 - 快速更新脚本
# 重新构建并重启容器（不删除旧镜像）

set -e

echo "⚡ 快速更新部署..."

# 1. 重新构建并启动
echo ""
echo "🔨 重新构建并启动..."
docker compose up -d --build

# 2. 查看容器状态
echo ""
echo "📊 容器状态:"
docker compose ps

# 3. 查看最近的日志
echo ""
echo "📋 最近的日志:"
docker compose logs --tail=30 -f

echo ""
echo "✅ 快速更新完成！"
