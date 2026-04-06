# GoPwn

> 下一代渗透测试平台。

**[English](README.en.md)**

GoPwn 是一个开源的 AI Agent 驱动渗透测试平台。LLM 作为大脑进行推理和规划，MCP 工具作为四肢执行真实探测，平台作为中枢负责调度和审计。从信息收集到漏洞验证，全流程自动编排。

## 架构

```
LLM (大脑)          ReAct 迭代推理、工具选择、审阅、风险判断
    ↕ ReAct Loop
Platform (中枢)     调度、审批、持久化、结果归一化、审计
    ↕ MCP stdio
MCP Tools (四肢)    真实探测、证据采集、结构化结果回传
```

平台采用 **ReAct（Reason + Act）执行引擎**：每轮次内，LLM 逐步推理并选取 MCP 工具执行，获取真实结果后继续推理，直到调用 `done`（完成本轮）或 `report_finding`（报告漏洞）。轮次间由 LLM 审阅决定是否继续深入。

## 核心特性

- **ReAct 自主编排** — LLM 动态选择工具和策略，不是固定流水线
- **38 MCP 安全工具** — 13 个 MCP Server 覆盖 DNS、Web、端口、漏洞验证、截图取证
- **多轮迭代执行** — LLM 审阅后自动推进下一轮，直到充分覆盖攻击面
- **实时可视化** — SSE 流式推送，实时展示 LLM 推理链和工具执行结果
- **审批与审计** — 高风险操作自动暂停等待审批，完整审计记录
- **Docker 靶场** — 内置 13 个靶场（DVWA / Juice Shop / WebGoat / Redis / SSH 等）

## 快速开始

### 前置要求

- Node.js 20+
- Docker Desktop
- npm

### 安装启动

```bash
# 克隆仓库
git clone https://github.com/PSoul/GoPwn.git
cd GoPwn && npm install

# 启动 PostgreSQL
cd docker/postgres && docker compose up -d && cd ../..

# 初始化数据库
npx prisma migrate dev

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000

### 默认账号

| 字段 | 值 |
|------|---|
| 账号 | `admin@company.local` |
| 密码 | `Prototype@2026` |

### LLM 配置

在 `/settings/llm` 页面配置，或通过环境变量：

```bash
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_ORCHESTRATOR_MODEL=Pro/deepseek-ai/DeepSeek-V3.2
LLM_REVIEWER_MODEL=Pro/deepseek-ai/DeepSeek-V3.2
```

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 15 (App Router) |
| 前端 | React 19, Tailwind CSS, shadcn/ui |
| 后端 | Next.js API Routes, TypeScript |
| 数据库 | PostgreSQL 16 + Prisma 7.x |
| MCP | `@modelcontextprotocol/sdk`, stdio |
| 测试 | Vitest (219 单元/集成) + Playwright (31 E2E) |
| 容器 | Docker Compose |

## MCP 工具体系

14 个 MCP Server 覆盖以下能力：

| 能力 | 服务 | 工具数 |
|------|------|--------|
| DNS / 子域 / 证书 | subfinder, whois | 3 |
| Web 页面探测 | httpx, wafw00f | 3 |
| HTTP / API 发现 | curl, dirsearch | 4 |
| 端口 / 服务 / 网络 | fscan, netcat | 3 |
| 受控验证 | curl (http-validation) | 2 |
| 截图与证据采集 | Playwright MCP | 2 |
| 编解码与密码学 | encode | 4 |
| 情报收集 | fofa, github-recon | 4 |
| 漏洞扫描 | afrog | 2 |
| 自主脚本执行 | script-mcp-server | 4 |

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
| Elasticsearch | 9200 | HTTP |
| WordPress | 8082 | HTTP |

## 项目结构

```
app/                    页面 (21) + API 路由 (51)
components/             UI 组件
lib/                    核心业务逻辑
  workers/              后台 Worker（ReAct / 审阅 / 分析）
  services/             应用服务
  repositories/         数据访问层
  domain/               领域模型（生命周期状态机）
  llm/                  LLM Prompt 与调用
  mcp/                  MCP 注册与执行引擎
  hooks/                React Hooks（SSE / ReAct 步骤）
  infra/                基础设施（Prisma / 事件总线 / 作业队列）
  types/                TypeScript 类型定义
mcps/                   13 个本地 MCP Server (38 工具)
docker/
  local-labs/           13 个 Docker 靶场
  postgres/             PostgreSQL 开发容器
prisma/
  schema.prisma         25 个数据模型
tests/                  单元测试 + API 测试
e2e/                    Playwright E2E 测试
docs/                   设计文档与指南
```

## 常用命令

```bash
npm run dev              # 开发服务器
npm run build            # 生产构建
npm run test             # 单元测试 (vitest)
npm run e2e              # E2E 测试 (playwright)
npm run lint             # 代码检查
npm run worker:dev       # 后台 Worker (开发模式)
```

## 文档

| 文档 | 用途 |
|------|------|
| [API 参考](docs/api-reference.md) | 51 个 API 端点 |
| [ReAct 引擎](docs/react-engine.md) | ReAct 引擎设计 |
| [平台架构](docs/v2-architecture.md) | 整体架构设计 |
| [开发指南](docs/development-guide.md) | 开发指南 |
| [Prompt 工程](docs/prompt-engineering.md) | Prompt 设计原则 |
| [品牌规范](docs/brand-guidelines.md) | 品牌与命名 |

## 许可证

MIT

## 链接

- 官网: [gopwn.ai](https://gopwn.ai)
- GitHub: [PSoul/GoPwn](https://github.com/PSoul/GoPwn)
