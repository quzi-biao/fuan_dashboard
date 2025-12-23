# 福安数据分析仪表板

基于 Next.js 的福安水厂数据分析系统，提供实时数据监控、流量分时段分析和能效分析功能。

## 功能特性

### 1. 实时数据监控
- 显示最新一条数据的关键指标
- 包含城东流量、岩湖流量、岩湖压力、日供水量、日耗电量
- 自动每30秒刷新一次

### 2. 流量数据分时段分析
- 按电价时段（谷、平、峰）分析流量数据
- 显示最近7天的分析结果
- 支持导出 Excel 报表

### 3. 岩湖水厂能效分析
- 计算压力加权平均值
- 分析千吨水电耗和能效比
- 显示最近7天的分析结果
- 支持导出 Excel 报表

## 数据库信息

### 数据库配置
- **Host**: gz-cdb-e3z4b5ql.sql.tencentcdb.com
- **Port**: 63453
- **Database**: fuan_data
- **Table**: fuan_data

### 字段说明
| 字段名 | 说明 | 单位 |
|--------|------|------|
| `collect_time` | 采集时间 | - |
| `i_1102` | 城东水厂瞬时流量 | m³/h |
| `i_1034` | 岩湖水厂瞬时流量 | m³/h |
| `i_1030` | 岩湖水厂出水压力 | MPa |
| `i_1072` | 岩湖水厂日供水量 | m³ |
| `i_1073` | 岩湖水厂日耗电量 | kWh |

## 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: MySQL (mysql2)
- **图标**: Lucide React
- **日期处理**: date-fns

## 安装和运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 3. 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
fuan_dashboard/
├── app/
│   ├── api/                    # API 路由
│   │   ├── latest/            # 最新数据接口
│   │   ├── flow-analysis/     # 流量分析接口
│   │   └── efficiency-analysis/ # 能效分析接口
│   ├── page.tsx               # 主页面
│   └── layout.tsx             # 布局
├── components/
│   ├── LatestDataPanel.tsx    # 最新数据面板
│   ├── FlowAnalysisTable.tsx  # 流量分析表格
│   └── EfficiencyAnalysisTable.tsx # 能效分析表格
├── lib/
│   ├── db.ts                  # 数据库连接
│   └── analysis.ts            # 数据分析逻辑
└── README.md
```

## API 接口

### GET /api/latest
获取最新一条数据

**响应示例**:
```json
{
  "success": true,
  "data": {
    "collect_time": "2024-12-23T10:00:00.000Z",
    "chengdong_flow": 1234.56,
    "yanhu_flow": 2345.67,
    "yanhu_pressure": 0.456,
    "yanhu_daily_water": 50000,
    "yanhu_daily_power": 15000
  }
}
```

### GET /api/flow-analysis?days=7
获取流量分时段分析数据

**参数**:
- `days`: 查询天数（默认7天）

### GET /api/efficiency-analysis?days=7
获取能效分析数据

**参数**:
- `days`: 查询天数（默认7天）

## 电价时段定义

- **谷电价**: 0:00-8:00 (8小时)
- **平电价**: 8:00-10:00, 12:00-15:00, 20:00-21:00, 22:00-24:00 (8小时)
- **峰电价**: 10:00-12:00, 15:00-20:00, 21:00-22:00 (8小时)

## 分析算法

### 流量累积计算
```
累积流量 = 平均瞬时流量 × 时段时长
```

### 压力加权平均
```
加权平均压力 = Σ(压力 × 流量) / Σ(流量)
```

### 千吨水电耗
```
千吨水电耗 = 日耗电量 / 日供水量 × 1000
```

### 能效比
```
能效比 = 千吨水电耗 / 压力加权均值
```

## 参考脚本

- 流量分析: `/Users/zhengbiaoxie/Workspace/water/work-script/fuan_anlysis/flow_analysis_by_electricity_price.py`
- 能效分析: `/Users/zhengbiaoxie/Workspace/water/work-script/fuan_anlysis/weighted_average_calculator.py`

## 开发说明

### 添加新功能
1. 在 `lib/analysis.ts` 中添加分析逻辑
2. 在 `app/api/` 中创建新的 API 路由
3. 在 `components/` 中创建展示组件
4. 在 `app/page.tsx` 中集成组件

### 数据库连接
数据库连接配置在 `lib/db.ts` 中，使用连接池管理连接。

### 样式定制
使用 Tailwind CSS，可在 `tailwind.config.ts` 中自定义主题。

## 注意事项

1. 确保数据库可访问
2. 数据采集频率为每分钟一次
3. 日供水量和日耗电量数据有一天的偏移
4. 建议在生产环境中使用环境变量管理数据库配置

## License

MIT
