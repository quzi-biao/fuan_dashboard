# 福安数据仪表盘 Docker 部署指南

## 📋 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

## 🚀 快速开始

### 1. 配置环境变量

复制环境变量示例文件并编辑配置：

```bash
cp env.example .env
```

编辑 `.env` 文件，填入正确的数据库连接信息：

```env
# InfluxDB 配置
INFLUXDB_URL=http://your-influxdb-host:8086
INFLUXDB_TOKEN=your-influxdb-token
INFLUXDB_ORG=fuan
INFLUXDB_BUCKET=water_data

# MySQL 配置
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your-mysql-password
MYSQL_DATABASE=water_monitor
```

### 2. 部署服务

使用部署脚本快速启动：

```bash
# 赋予执行权限
chmod +x deploy.sh

# 启动服务
./deploy.sh start
```

服务启动后，访问 http://localhost:5656

## 📝 部署脚本命令

```bash
./deploy.sh start       # 启动服务
./deploy.sh stop        # 停止服务
./deploy.sh restart     # 重启服务
./deploy.sh build       # 重新构建镜像
./deploy.sh logs        # 查看日志
./deploy.sh status      # 查看服务状态
./deploy.sh cleanup     # 清理所有资源
./deploy.sh help        # 显示帮助信息
```

## 🔧 手动部署

如果不使用部署脚本，可以手动执行以下命令：

### 构建镜像

```bash
docker-compose build
```

### 启动服务

```bash
docker-compose up -d
```

### 查看日志

```bash
docker-compose logs -f
```

### 停止服务

```bash
docker-compose down
```

## 🌐 端口配置

默认端口为 5656，如需修改，编辑 `docker-compose.yml`：

```yaml
ports:
  - "8080:3000"  # 将本地 8080 端口映射到容器 3000 端口
```

## 🔍 健康检查

容器包含健康检查功能，每 30 秒检查一次服务状态：

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' fuan-dashboard
```

## 📊 资源限制

如需限制容器资源使用，在 `docker-compose.yml` 中添加：

```yaml
services:
  fuan-dashboard:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## 🔄 更新部署

当代码更新后，重新构建并部署：

```bash
# 停止服务
./deploy.sh stop

# 重新构建镜像
./deploy.sh build

# 启动服务
./deploy.sh start
```

或者一键重启：

```bash
./deploy.sh restart
```

## 🐛 故障排查

### 查看容器日志

```bash
./deploy.sh logs
```

### 进入容器调试

```bash
docker exec -it fuan-dashboard sh
```

### 检查容器状态

```bash
./deploy.sh status
```

### 重置所有数据

```bash
./deploy.sh cleanup
```

## 🔐 生产环境建议

1. **使用 HTTPS**：配置反向代理（如 Nginx）
2. **环境变量安全**：不要将 `.env` 文件提交到版本控制
3. **定期备份**：备份数据库和配置文件
4. **监控日志**：使用日志聚合工具监控应用状态
5. **资源限制**：设置合理的 CPU 和内存限制

## 📦 文件说明

- `Dockerfile` - Docker 镜像构建文件
- `docker-compose.yml` - Docker Compose 配置
- `.dockerignore` - Docker 构建忽略文件
- `deploy.sh` - 部署脚本
- `env.example` - 环境变量示例

## 🆘 获取帮助

如遇到问题，请检查：

1. Docker 和 Docker Compose 版本是否符合要求
2. 环境变量配置是否正确
3. 数据库连接是否可用
4. 端口是否被占用

查看详细日志：

```bash
docker-compose logs -f fuan-dashboard
```
