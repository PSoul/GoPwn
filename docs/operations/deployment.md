# 生产部署指南

## 架构概览

GoPwn 生产环境由 3 个服务组成：

```
┌─────────────────────────────────────┐
│          Docker Compose             │
│                                     │
│  ┌─────────┐  ┌────────┐  ┌─────┐  │
│  │   Web   │  │ Worker │  │ DB  │  │
│  │ Next.js │  │ pg-boss│  │ PG  │  │
│  │  :3000  │  │ + MCP  │  │:5432│  │
│  └────┬────┘  └───┬────┘  └──┬──┘  │
│       └───────────┴──────────┘      │
│            PostgreSQL               │
└─────────────────────────────────────┘
```

| 服务 | 职责 |
|------|------|
| **web** | Next.js Web 服务器 — UI + API |
| **worker** | 后台 Worker — ReAct 执行循环、结果分析、漏洞验证、MCP 工具调用 |
| **db** | PostgreSQL 数据库 |

## 快速启动（Docker Compose）

### 1. 准备环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少配置：

```bash
# 必填：LLM API 凭据
LLM_API_KEY="your-api-key"
LLM_BASE_URL="https://your-llm-provider/v1"
LLM_ORCHESTRATOR_MODEL="your-model-name"

# 必填：会话密钥（生产环境务必修改）
PROTOTYPE_SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

# 可选：修改数据库密码
DB_PASSWORD="strong-password-here"

# 可选：修改 Web 端口
PORT=3000
```

### 2. 构建并启动

```bash
docker compose up -d --build
```

这会：
1. 构建 Web 和 Worker 镜像
2. 启动 PostgreSQL 并等待健康检查
3. 运行 `prisma migrate deploy` 初始化/迁移数据库
4. 启动 Web (端口 3000) 和 Worker

### 3. 首次登录

打开 `http://your-server:3000`，使用默认账号登录：

| 字段 | 值 |
|------|---|
| 账号 | `admin@company.local` |
| 密码 | `Prototype@2026` |

### 4. 配置 LLM

登录后进入 **设置 → LLM 设置** 页面，或确保 `.env` 中已配置 LLM 凭据。

Worker 需要以下 LLM profile（通过设置页面或数据库直接配置）：

| Profile ID | 用途 |
|------------|------|
| `planner` | ReAct 执行循环（也被 `react` 角色复用） |
| `analyzer` | MCP 工具结果分析 |
| `reviewer` | 轮次审阅决策 |

## 裸机部署（不用 Docker）

### 前置要求

- Node.js 20+
- PostgreSQL 16+
- npm

### 步骤

```bash
# 1. 安装依赖
npm ci

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DATABASE_URL、LLM 凭据等

# 3. 数据库迁移
npx prisma migrate deploy

# 4. 构建 Next.js
npm run build

# 5. 启动 Web 服务器（前台或用 pm2/systemd）
npm run start

# 6. 启动 Worker（另一个进程）
npm run worker
```

### 使用 PM2 管理进程

```bash
npm install -g pm2

# 启动 Web
pm2 start npm --name "gopwn-web" -- run start

# 启动 Worker
pm2 start npx --name "gopwn-worker" -- tsx worker.ts

# 开机自启
pm2 startup
pm2 save
```

## 可选：Docker 靶场

如果需要测试本地靶场环境：

```bash
cd docker/local-labs
docker compose up -d
```

靶场端口列表见 [local-docker-labs.md](./local-docker-labs.md)。

## 运维

### 查看日志

```bash
# Docker Compose
docker compose logs -f web
docker compose logs -f worker

# PM2
pm2 logs gopwn-web
pm2 logs gopwn-worker
```

### 数据库备份

```bash
docker compose exec db pg_dump -U pentest pentest > backup.sql
```

### 更新版本

```bash
git pull
docker compose up -d --build    # Docker 方式
# 或
npm ci && npm run build         # 裸机方式，然后重启 web + worker
```

### 健康检查

```bash
curl http://localhost:3000/api/health
# 预期返回: {"status":"ok","database":"connected"}
```

## 注意事项

1. **Worker 是必需的** — 没有 Worker，项目启动后不会执行任何渗透测试任务
2. **Worker 只能运行一个实例** — pg-boss 使用 singleton key 防止重复作业，但多实例可能导致竞态
3. **MCP 子进程** — Worker 会为每个启用的 MCP Server 启动一个子进程，正常关闭时会自动清理
4. **会话密钥** — 生产环境必须设置 `PROTOTYPE_SESSION_SECRET`，否则 cookie 签名不安全
5. **数据库密码** — 默认密码是 `pentest`，生产环境务必修改
6. **LLM API** — Provider 使用 SSE 流式调用，支持任意 OpenAI 兼容 API（包括反向代理），无需配置额外参数
7. **fscan 版本** — 内置 fscan MCP server 已适配 v2.0 参数格式，请使用 fscan 2.0+ 二进制文件
