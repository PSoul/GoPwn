# LLM 渗透测试平台

AI Agent 驱动的授权安全评估全栈平台。

## 核心架构

```
LLM = 大脑     ReAct 迭代推理、工具选择、审阅、解释、风险判断
MCP = 四肢     接触目标、调用外部工具、采集证据、回传结构化结果
平台 = 中枢     审批、调度、持久化、结果归一化、审计、状态推进
```

### ReAct 执行引擎

平台采用 **ReAct（Reason+Act）迭代执行模式**：在每一轮次内，LLM 通过 OpenAI Function Calling（现代 `tools` 格式）逐步推理并选取 MCP 工具，获取真实执行结果后继续推理，直到调用 `done`（完成本轮）或 `report_finding`（报告漏洞）为止。

## 当前状态

- 版本: `v1.0.0`
- 数据层: PostgreSQL via Prisma 7.x (`@prisma/adapter-pg`)
- 测试: 206+ 单元测试 + 14 E2E 测试
- MCP: 14 个本地 MCP Server（36+ 工具）
- 靶场: 13 个 Docker 容器（DVWA / Juice Shop / WebGoat / Redis / SSH / Tomcat / Elasticsearch / MongoDB 等）
- 执行引擎: **ReAct 迭代执行** — LLM 通过 OpenAI tools 格式逐步推理并选取工具
- LLM 分析: 三级 LLM profile（orchestrator / reviewer / analyzer）

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 15 (App Router) |
| 前端 | React 19, Tailwind CSS, shadcn/ui |
| 后端 | Next.js API Routes, TypeScript |
| 数据库 | PostgreSQL 16 + Prisma 7.x (`@prisma/adapter-pg`) |
| MCP | `@modelcontextprotocol/sdk`, stdio 连接器 |
| 测试 | Vitest, Playwright |
| 容器 | Docker Compose (靶场 + PostgreSQL) |

## 快速启动

### 前置要求

- Node.js 20+
- Docker Desktop (用于 PostgreSQL + 靶场)
- npm

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 PostgreSQL

```bash
cd docker/postgres && docker compose up -d
```

### 3. 初始化数据库

```bash
npx prisma migrate dev
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 `http://127.0.0.1:3000`

### 5. 默认账号

| 字段 | 值 |
|------|---|
| 账号 | `admin@company.local` |
| 密码 | `Prototype@2026` |
| 验证码 | `7K2Q` |

## 使用流程

1. 登录平台
2. 新建项目 — 填写项目名称、目标、说明
3. 点击 **开始项目** — 触发 ReAct 执行引擎
4. 运行中可查看每步 LLM 推理链与工具执行结果；高风险操作会暂停请求审批
5. 轮次完成后 LLM 审阅决定是否继续下一轮
6. 项目完成后自动生成最终报告

## 仓库结构

```
app/                    页面 (21) + API 路由 (51)
components/             业务 UI 组件
lib/                    核心业务层（9 个领域子目录）
  workers/              后台作业 Worker（ReAct / 审阅 / 分析 / 验证）
  services/             应用服务（项目 / 审批 / 资产 / 设置）
  repositories/         数据访问层
  domain/               领域模型（生命周期状态机 / 阶段 / 错误）
  llm/                  LLM prompt 工程与调用
  mcp/                  MCP 注册与执行引擎
  hooks/                React Hooks（SSE 订阅 / ReAct 步骤）
  infra/                基础设施（Prisma / 事件总线 / 作业队列）
  types/                TypeScript 类型定义
mcps/                   14 个本地 MCP Server (36+ 工具)
docker/
  local-labs/           13 个 Docker 靶场定义
  postgres/             PostgreSQL 开发容器
prisma/
  schema.prisma         25 个数据模型
tests/                  单元测试 + API 测试
e2e/                    Playwright E2E 测试
docs/                   设计文档与操作手册
```

## 常用命令

```bash
npm run dev              # 启动开发服务器
npm run build            # 生产构建
npm run test             # 运行单元测试 (vitest)
npm run e2e              # 运行 E2E 测试 (playwright)
npm run lint             # 代码检查
```

## Docker 靶场

```bash
cd docker/local-labs && docker compose up -d
```

| 靶场 | 端口 | 协议 |
|------|------|------|
| DVWA | 8081 | HTTP |
| Juice Shop | 3000 | HTTP |
| WebGoat | 18080 / 19090 | HTTP |
| Redis | 6379 | TCP |
| SSH | 2222 | TCP |
| MySQL | 13307 | TCP |
| MongoDB | 27017 | TCP |
| Tomcat | 8888 | HTTP |
| Elasticsearch | 9201 | HTTP |
| WordPress | 8082 | HTTP |

## LLM 配置

在 `/settings/llm` 页面配置，或通过环境变量：

```bash
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_ORCHESTRATOR_MODEL=Pro/deepseek-ai/DeepSeek-V3.2
LLM_REVIEWER_MODEL=Pro/deepseek-ai/DeepSeek-V3.2
```

## MCP 工具体系

14 个本地 MCP Server 覆盖以下能力族：

| 能力族 | MCP Server | 工具数 |
|--------|-----------|--------|
| DNS / 子域 / 证书 | subfinder, whois | 3 |
| Web 页面探测 | httpx, wafw00f | 3 |
| HTTP / API 结构发现 | curl, dirsearch | 4 |
| 端口 / 服务 / 网络 | fscan, netcat | 3 |
| 受控验证类 | curl (http-validation) | 2 |
| 截图与证据采集 | Playwright MCP | 2 |
| 编解码与密码学 | encode | 4 |
| 情报收集 | fofa, github-recon | 4 |
| 漏洞扫描 | afrog | 2 |
| 自主脚本执行 | script-mcp-server | 4 |

## 核心能力

### AI Agent
- **ReAct 迭代执行引擎** — LLM 通过 OpenAI tools 格式逐步选取工具，实时响应结果
- 三级 LLM profile（orchestrator / reviewer / analyzer）
- LLM 语义化工具输出分析（自动提取 assets / evidence / findings）
- 滑动窗口上下文压缩（TOKEN_BUDGET=80k，RECENT_WINDOW=5 步）
- 控制函数：`done`（结束轮次）、`report_finding`（报告漏洞）

### 项目生命周期
- 状态机: idle → executing → reviewing → settling → completed
- 手动启动 → LLM 多轮自动编排 → 审批阻塞/恢复 → 自动收束
- 重复作业防护（singletonKey + 状态守卫）

### 安全
- HMAC 签名 session cookie
- CSRF 双重提交 cookie
- 滑动窗口速率限制（登录 5/min, API 60/min）
- bcrypt 密码验证
- 多用户 RBAC（admin / researcher / approver）

## 已验证的真实闭环

- **DVWA** — 多轮自动编排，发现 Apache 版本泄露
- **DVWA Redis** — TCP 通用协议探测 + 未授权访问检测
- **Juice Shop** — Web 探测 + 审批恢复 + 结果沉淀
- **WebGoat** — Actuator 匿名暴露发现 + 报告导出

## 文档索引

| 文档 | 用途 |
|------|------|
| `code_index.md` | 全量代码索引 |
| `roadmap.md` | 阶段规划与完成记录 |
| `docs/api-reference.md` | API 接口参考（51 端点） |
| `docs/react-engine.md` | ReAct 引擎设计文档 |
| `docs/v2-architecture.md` | 平台架构设计 |
| `docs/development-guide.md` | 开发指南 |
| `docs/prompt-engineering.md` | Prompt 工程设计原则 |
