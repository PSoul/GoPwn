# 11 — 使用指南

> 从安装到执行第一次渗透测试的完整操作指南。

---

## 11.1 环境准备

### 硬件要求

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+（Docker 靶场需额外资源） |
| 磁盘 | 10 GB | 20 GB+（含 Docker 镜像） |
| 网络 | 可访问 LLM API | 低延迟网络（SSE 流式调用对延迟敏感） |

### 软件依赖

| 软件 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | 20+ | 运行 Next.js 和 Worker |
| npm | 随 Node.js 安装 | 包管理器 |
| Docker Desktop | 最新版 | PostgreSQL + 靶场环境 |
| PostgreSQL | 16+（Docker 或本地） | 数据存储 + 任务队列 |
| Git | 最新版 | 克隆仓库 |

### LLM API 要求

GoPwn 支持任意 OpenAI 兼容 API（SSE 流式调用），包括：

- **OpenAI** — GPT-4、GPT-4o 等
- **Anthropic** — Claude 系列（需 OpenAI 兼容代理）
- **阿里云 DashScope** — qwen3.6-plus（已验证，推理模型）
- **SiliconFlow** — DeepSeek-V3.2（已验证）
- **任意反向代理** — 如 one-api、new-api 等

推荐使用具备强推理能力的模型（GPT-4 级别或以上），温度设为 0.1–0.3 以获得稳定输出。

## 11.2 安装步骤

### 方式一：Docker Compose 一键部署（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/PSoul/GoPwn.git
cd GoPwn

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 LLM_API_KEY、LLM_BASE_URL 等

# 3. 构建并启动
docker compose up -d --build
```

Docker Compose 自动完成：构建镜像 → 启动 PostgreSQL → 等待健康检查 → 数据库迁移 → 启动 Web（端口 3000）和 Worker。

### 方式二：本地开发模式

```bash
# 1. 克隆并安装依赖
git clone https://github.com/PSoul/GoPwn.git
cd GoPwn && npm install

# 2. 启动 PostgreSQL
cd docker/postgres && docker compose up -d && cd ../..

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env

# 4. 初始化数据库
npx prisma db push
npx tsx scripts/db/seed-database.ts

# 5. 启动 Next.js 开发服务器
npm run dev

# 6. 启动 Worker（另一个终端）
npx tsx watch worker.ts
```

**注意**：如果启动了 Docker 靶场的 Juice Shop（端口 3000），Next.js 需使用其他端口：`PORT=3001 npm run dev`。

## 11.3 首次登录与配置

### 登录

打开浏览器访问 `http://localhost:3000`（或你配置的端口），使用默认账号登录：

| 字段 | 值 |
|------|---|
| 账号 | `admin@company.local` |
| 密码 | `Prototype@2026` |

### 配置 LLM

登录后进入 **设置 → LLM 设置**，配置三个 Profile：

| Profile | 角色 | 说明 | 推荐配置 |
|---------|------|------|---------|
| orchestrator | ReAct 编排器 | 负责推理、选择工具、执行渗透测试 | 强模型，temperature 0.2 |
| analyzer | 输出分析器 | 分析 MCP 工具输出，提取资产和漏洞 | 中等模型即可，可复用 orchestrator |
| reviewer | 轮次审阅器 | 审阅每轮结果，决定是否继续 | 中等模型，temperature 0.1 |

每个 Profile 需填写：

- **API Key** — LLM 服务商的 API 密钥
- **Base URL** — API 基础地址（如 `https://dashscope.aliyuncs.com/compatible-mode/v1`）
- **Model** — 模型名称（如 `qwen3.6-plus`）
- **Timeout** — 请求超时（推理模型建议 300000ms，即 5 分钟）
- **Temperature** — 温度参数
- **Context Window Size** — 上下文窗口大小（默认 65536）

运行时优先读取数据库中的配置，只有未配置时才回退到环境变量。

### 检查 MCP 工具

进入 **设置 → 探测工具**，确认 38 个 MCP 工具已注册且处于启用状态。工具按 MCP Server 分组，以 Accordion 折叠展示。

如果工具列表为空，重启 Worker 进程即可触发自动发现和注册。

### 审批策略

进入 **设置 → 审批策略**，根据需要配置：

- `approvalEnabled` — 是否启用审批（建议启用）
- `autoApproveLowRisk` — 低风险操作（DNS 查询等）自动批准
- `autoApproveMediumRisk` — 中风险操作（端口扫描等）是否自动批准

生产环境建议保持高风险操作（代码执行、漏洞利用）需人工审批。

## 11.4 创建第一个渗透测试项目

### 启动靶场（推荐用于测试）

```bash
cd docker/local-labs && docker compose up -d
```

这将启动 13 个本地靶场（DVWA、Juice Shop、WebGoat、Redis、SSH 等），用于安全的测试环境。

### 创建项目

1. 进入 **仪表盘** 或 **项目列表**，点击 **新建项目**
2. 填写项目信息：
   - **项目名称** — 例如"本地靶场渗透测试"
   - **项目编码** — 唯一标识，如 `local-lab-test`
   - **目标** — 填入渗透目标（IP、域名或 URL），每行一个
   - **项目描述** — 描述测试范围和目标（会注入所有 LLM Prompt，影响智能 Scope 判断）
   - **最大轮次** — 建议 5–10 轮

3. 点击 **创建**

### 项目描述的重要性

项目描述不仅是备注，它会被注入到所有 LLM Prompt 中，帮助 LLM 做出智能的 Scope 判断：

- 描述哪些是授权目标、哪些子域名是关联资产
- 提示重点关注的攻击面（如"重点测试未授权访问和弱口令"）
- 说明环境特征（如"本地 Docker 靶场环境，允许深入测试"）

## 11.5 执行渗透测试

### 启动项目

在项目 **执行控制** Tab 中，点击 **启动** 按钮。项目生命周期状态将从 `idle` → `executing`。

### 执行过程

启动后，Worker 自动开始 ReAct 循环：

1. **ReAct 循环** — LLM 逐步推理，选择 MCP 工具（如 DNS 查询、端口扫描）并执行
2. **工具执行** — MCP 工具返回真实结果（开放端口、服务指纹、漏洞信息等）
3. **结果分析** — 分析器提取资产和安全发现，写入数据库
4. **轮次审阅** — 达到最大步骤数或 LLM 主动调用 `done` 后，审阅器评估本轮成果
5. **继续/停止** — 审阅器决定是否继续下一轮或完成测试

### 实时监控

执行过程中可通过多个渠道实时监控：

- **执行控制 Tab** — 查看 ReAct 轮次进度、每步的推理过程和工具调用
- **MCP 运行记录** — 按 round → step 分组查看所有工具执行详情
- **AI 日志 Tab** — 查看 LLM 调用的完整 prompt 和 response
- **AI 聊天悬浮窗** — 右下角实时推送当前执行状态

### 审批处理

如果 Worker 调用了高风险工具（如漏洞利用），项目状态将变为 `waiting_approval`：

1. 顶部出现琥珀色审批通知条
2. 查看工具名称、目标、风险等级
3. 选择 **批准**（继续执行）或 **拒绝**（跳过该操作）

## 11.6 查看结果

### 资产

项目 **资产** Tab 展示发现的所有资产，分为三个子 Tab：

- **域名** — 发现的域名和子域名
- **主机与端口** — IP 地址和开放端口（树形结构：IP → Port → Service）
- **Web 与 API** — Web 应用和 API 端点

点击 IP 地址可查看该主机的详细信息（开放端口、关联漏洞、Web 应用等）。

### 漏洞

项目 **漏洞** Tab 列出所有安全发现，按严重程度排序（Critical → Info）。每个漏洞包含：

- **标题和摘要** — 漏洞描述
- **严重程度** — Critical / High / Medium / Low / Info
- **状态** — Suspected → Verifying → Verified / False Positive
- **受影响目标** — 具体的 IP:端口或 URL
- **修复建议** — LLM 生成的修复方案
- **原始证据** — 工具输出、截图等
- **PoC 代码** — 如果有验证代码，显示代码和执行结果

### 报告导出

在执行控制 Tab 的报告导出面板中，可将渗透测试结果导出为结构化报告。

## 11.7 项目管理

### 生命周期操作

| 操作 | 说明 |
|------|------|
| 启动 | `idle` → `executing`，开始 ReAct 循环 |
| 停止 | 平滑停止当前轮次 |
| 重启 | 从当前状态继续执行 |
| 归档 | 标记项目为已归档 |

### 跨项目视图

- **仪表盘** — 所有项目的关键指标汇总
- **资产中心** — 跨项目资产总览
- **漏洞中心** — 跨项目漏洞总览与筛选

## 11.8 日常运维

### 查看日志

```bash
# Docker Compose 模式
docker compose logs -f web      # Web 日志
docker compose logs -f worker   # Worker 日志

# 本地开发模式
# Web 日志直接在终端输出
# Worker 日志在另一个终端输出
```

前端 **设置 → 工作日志** 页面提供 Pipeline 日志的可视化查询。

### 健康检查

```bash
curl http://localhost:3000/api/health
# 返回: {"status":"ok","database":"connected"}
```

### 系统状态

**设置 → 系统状态** 页面显示：
- 数据库连接状态
- MCP 工具注册状态
- LLM API 连接状态

### 数据库备份

```bash
# Docker 环境
docker compose exec db pg_dump -U pentest pentest > backup.sql

# 本地环境
pg_dump -U pentest pentest > backup.sql
```

## 11.9 常见问题

### Worker 不执行任务

- 确认 Worker 进程正在运行（`npx tsx watch worker.ts`）
- 检查 PostgreSQL 连接是否正常
- 重启 Worker 以清理可能的陈旧 pg-boss 作业

### LLM 调用失败

- 在 **设置 → LLM 设置** 中检查 API Key 和 Base URL 是否正确
- 推理模型（如 qwen3.6-plus）建议将 timeout 设为 300000ms（5 分钟）
- 在 **AI 日志** Tab 查看具体的错误信息
- 部分 provider 不支持 `response_format`，平台会自动降级处理

### MCP 工具列表为空

- 重启 Worker 进程触发自动发现
- 或调用 `POST /api/settings/mcp/sync` 手动同步
- 检查 `mcps/mcp-servers.json` 配置是否正确

### 项目卡在 waiting_approval

- 检查 **执行控制** Tab 是否有待审批的操作
- 批准或拒绝后项目自动恢复执行
- 如果不需要审批，可在 **设置 → 审批策略** 中调整

### IPv6 连接问题（Windows）

Worker 和 instrumentation.ts 已设置 `dns.setDefaultResultOrder("ipv4first")`，正常情况下不会遇到 IPv6 问题。如果仍有连接问题，检查防火墙和 DNS 配置。

### 端口冲突

Juice Shop 靶场默认使用 3000 端口，与 Next.js 开发服务器冲突。解决方法：
- Next.js 使用其他端口：`PORT=3001 npm run dev`
- 或修改靶场 compose 文件的端口映射
