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
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    print_message "Docker 环境检查通过"
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
    docker-compose build --no-cache
    print_message "镜像构建完成"
}

# 启动服务
start_service() {
    print_message "启动 ${PROJECT_NAME} 服务..."
    docker-compose up -d
    print_message "服务启动成功"
    print_message "访问地址: http://localhost:3000"
}

# 停止服务
stop_service() {
    print_message "停止 ${PROJECT_NAME} 服务..."
    docker-compose down
    print_message "服务已停止"
}

# 重启服务
restart_service() {
    print_message "重启 ${PROJECT_NAME} 服务..."
    docker-compose restart
    print_message "服务重启完成"
}

# 查看日志
view_logs() {
    print_message "查看服务日志 (Ctrl+C 退出)..."
    docker-compose logs -f
}

# 查看状态
check_status() {
    print_message "服务状态:"
    docker-compose ps
}

# 清理资源
cleanup() {
    print_warning "清理所有容器、镜像和数据..."
    read -p "确认删除所有资源? (y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        docker-compose down -v --rmi all
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
