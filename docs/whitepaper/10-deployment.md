# 10 — 部署与运维

> GoPwn 支持 Docker Compose 一键部署和裸机部署两种方式，生产环境由 Web + Worker + PostgreSQL 三个服务组成。

---

## 10.1 生产架构

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
| **Web** | Next.js 服务器 — UI 渲染 + 36 个 API 端点 + SSE 事件推送 |
| **Worker** | 后台任务处理 — ReAct 循环 + LLM 分析 + PoC 验证 + 轮次审阅 + MCP 子进程管理 |
| **DB** | PostgreSQL 16 — 数据存储 + pg-boss 任务队列 + LISTEN/NOTIFY 事件 |

## 10.2 Docker Compose 部署（推荐）

### 步骤 1：准备环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```bash
# 必填：LLM API 凭据
LLM_API_KEY="your-api-key"
LLM_BASE_URL="https://your-llm-provider/v1"
LLM_ORCHESTRATOR_MODEL="your-model-name"

# 必填：会话密钥（生产环境务必修改）
PROTOTYPE_SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

# 可选：数据库密码（默认 pentest）
DB_PASSWORD="strong-password-here"

# 可选：Web 端口（默认 3000）
PORT=3000
```

### 步骤 2：构建并启动

```bash
docker compose up -d --build
```

自动执行：
1. 构建 Web 和 Worker 镜像
2. 启动 PostgreSQL 并等待健康检查通过
3. 运行 `prisma migrate deploy` 初始化/迁移数据库
4. 启动 Web（端口 3000）和 Worker

### 步骤 3：首次登录

打开 `http://your-server:3000`，使用默认账号：

| 字段 | 值 |
|------|---|
| 账号 | `admin@company.local` |
| 密码 | `Prototype@2026` |

### 步骤 4：配置 LLM

登录后进入 **设置 → LLM 设置** 页面配置三个 Profile：

| Profile | 用途 | 推荐配置 |
|---------|------|---------|
| planner (react) | ReAct 执行循环 | 强模型（GPT-4/Claude/qwen3.6-plus），temperature 0.2 |
| analyzer | 工具输出分析 | 中等模型即可，可复用 planner |
| reviewer | 轮次审阅 | 中等模型即可，temperature 0.1 |

## 10.3 裸机部署

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

# 5. 启动 Web 服务器
npm run start

# 6. 启动 Worker（另一个终端/进程）
npm run worker
```

### 使用 PM2 管理

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

## 10.4 Docker 靶场（可选）

用于测试和演示：

```bash
cd docker/local-labs && docker compose up -d
```

### 靶场清单

| 靶场 | 端口 | 协议 | 漏洞类型 |
|------|------|------|----------|
| DVWA | 8081 | HTTP | SQL注入、XSS、命令注入、文件上传 |
| Juice Shop | 3000 | HTTP | OWASP Top 10 |
| WebGoat | 18080/19090 | HTTP | 教学型 Web 漏洞 |
| WordPress | 8082 | HTTP | CMS 弱口令 |
| phpMyAdmin | 8083 | HTTP | 管理面板暴露 |
| Tomcat | 8888 | HTTP | 管理面板弱口令 (tomcat/tomcat) |
| Redis | 6379 | TCP | 未授权访问 |
| SSH | 2222 | TCP | 弱口令 (root/root) |
| MySQL | 13307 | TCP | 弱口令 (root/123456) |
| MongoDB | 27017 | TCP | 未授权访问 |
| Elasticsearch | 9200 | HTTP | 集群信息泄露 |

**注意**: Juice Shop 占用 3000 端口，Next.js 开发服务器建议用 3001（`PORT=3001 npm run dev`）。

## 10.5 运维操作

### 查看日志

```bash
# Docker Compose
docker compose logs -f web
docker compose logs -f worker

# PM2
pm2 logs gopwn-web
pm2 logs gopwn-worker
```

### 健康检查

```bash
curl http://localhost:3000/api/health
# 预期: {"status":"ok","database":"connected"}
```

### 数据库备份

```bash
# Docker 环境
docker compose exec db pg_dump -U pentest pentest > backup.sql

# 裸机环境
pg_dump -U pentest pentest > backup.sql
```

### 版本更新

```bash
# Docker 方式
git pull
docker compose up -d --build

# 裸机方式
git pull
npm ci && npm run build
# 重启 web + worker
pm2 restart all
```

### 数据库管理

```bash
# 可视化查看数据
npx prisma studio

# 重置数据库（危险！清空所有数据）
npx prisma db push --force-reset
npx tsx scripts/db/seed-database.ts
```

## 10.6 注意事项

1. **Worker 是必需的** — 没有 Worker，项目启动后不会执行任何渗透测试
2. **Worker 只运行一个实例** — pg-boss 使用 singletonKey 防止重复作业，但多实例可能导致竞态
3. **MCP 子进程** — Worker 为每个启用的 MCP Server 启动子进程，正常关闭时自动清理（SIGTERM/SIGINT）
4. **会话密钥** — 生产环境必须设置 `PROTOTYPE_SESSION_SECRET`
5. **数据库密码** — 默认 `pentest`，生产环境务必修改
6. **LLM API** — 支持任意 OpenAI 兼容 API（含反向代理），SSE 流式调用
7. **fscan 版本** — 内置 fscan MCP Server 适配 v2.0 参数格式
8. **IPv4 优先** — Worker 和 instrumentation.ts 已设置 `dns.setDefaultResultOrder("ipv4first")`，解决 Windows 环境 IPv6 连接问题
9. **推理模型超时** — qwen3.6-plus 等推理模型建议 `timeoutMs` 设为 300000（5 分钟）
