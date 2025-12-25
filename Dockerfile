# 多阶段构建 - 构建阶段
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM node:20-alpine AS runner

WORKDIR /app

# 安装 Python 和必要的系统依赖
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-numpy \
    py3-scipy \
    build-base \
    python3-dev \
    openblas-dev \
    && ln -sf python3 /usr/bin/python

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PYTHONUNBUFFERED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制 Python 脚本和依赖文件
COPY --from=builder /app/scripts ./scripts

# 安装 Python 依赖（Alpine Linux 需要 --break-system-packages）
RUN pip3 install --no-cache-dir --break-system-packages -r scripts/requirements.txt

# 复制必要的文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 设置文件所有者
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["node", "server.js"]
