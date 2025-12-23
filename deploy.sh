#!/bin/bash

# 福安数据仪表盘 Docker 部署脚本
# 使用方法: ./deploy.sh [start|stop|restart|logs|build]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目名称
PROJECT_NAME="fuan-dashboard"

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    # 检查 docker-compose 或 docker compose
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    print_message "Docker 环境检查通过 (使用 $DOCKER_COMPOSE)"
}

# 检查环境变量文件
check_env() {
    if [ ! -f .env ]; then
        print_warning ".env 文件不存在"
        if [ -f env.example ]; then
            print_message "从 env.example 复制配置文件..."
            cp env.example .env
            print_warning "请编辑 .env 文件，填入正确的配置信息"
            exit 1
        else
            print_error "env.example 文件不存在"
            exit 1
        fi
    fi
    print_message "环境变量文件检查通过"
}

# 构建镜像
build_image() {
    print_message "开始构建 Docker 镜像..."
    $DOCKER_COMPOSE build --no-cache
    print_message "镜像构建完成"
}

# 启动服务
start_service() {
    print_message "启动 ${PROJECT_NAME} 服务..."
    
    # 先尝试拉取基础镜像
    print_message "检查基础镜像..."
    docker pull node:20-alpine || print_warning "无法拉取基础镜像，将使用本地缓存"
    
    # 启动服务，添加错误处理
    if $DOCKER_COMPOSE up -d; then
        print_message "服务启动成功"
        print_message "访问地址: http://localhost:5656"
        
        # 等待几秒后检查状态
        sleep 3
        print_message "检查容器状态..."
        $DOCKER_COMPOSE ps
    else
        print_error "服务启动失败"
        print_message "查看详细日志:"
        $DOCKER_COMPOSE logs --tail=50
        exit 1
    fi
}

# 停止服务
stop_service() {
    print_message "停止 ${PROJECT_NAME} 服务..."
    $DOCKER_COMPOSE down
    print_message "服务已停止"
}

# 重启服务
restart_service() {
    print_message "重启 ${PROJECT_NAME} 服务..."
    $DOCKER_COMPOSE restart
    print_message "服务重启完成"
}

# 查看日志
view_logs() {
    print_message "查看服务日志 (Ctrl+C 退出)..."
    $DOCKER_COMPOSE logs -f
}

# 查看状态
check_status() {
    print_message "服务状态:"
    $DOCKER_COMPOSE ps
}

# 诊断环境
diagnose() {
    print_message "=== 环境诊断 ==="
    echo ""
    
    print_message "Docker 版本:"
    docker --version
    echo ""
    
    print_message "Docker Compose 版本:"
    $DOCKER_COMPOSE version
    echo ""
    
    print_message "Docker 运行状态:"
    docker info | grep -E "Server Version|Operating System|Total Memory|CPUs"
    echo ""
    
    print_message "现有容器:"
    docker ps -a
    echo ""
    
    print_message "现有镜像:"
    docker images | grep -E "fuan|node"
    echo ""
    
    if [ -f .env ]; then
        print_message "环境变量文件存在: ✓"
    else
        print_warning "环境变量文件不存在: ✗"
    fi
}

# 清理资源
cleanup() {
    print_warning "清理所有容器、镜像和数据..."
    read -p "确认删除所有资源? (y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        $DOCKER_COMPOSE down -v --rmi all
        print_message "清理完成"
    else
        print_message "取消清理"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
福安数据仪表盘 Docker 部署脚本

使用方法:
    ./deploy.sh [命令]

可用命令:
    start       启动服务
    stop        停止服务
    restart     重启服务
    build       重新构建镜像
    logs        查看日志
    status      查看服务状态
    diagnose    诊断环境
    cleanup     清理所有资源
    help        显示帮助信息

示例:
    ./deploy.sh start       # 启动服务
    ./deploy.sh logs        # 查看日志
    ./deploy.sh restart     # 重启服务

EOF
}

# 主函数
main() {
    check_docker
    
    case "${1:-}" in
        start)
            check_env
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        build)
            check_env
            build_image
            ;;
        logs)
            view_logs
            ;;
        status)
            check_status
            ;;
        diagnose)
            check_docker
            diagnose
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: ${1:-}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
