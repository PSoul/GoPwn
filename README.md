# GoPwn

> The Next Generation of Penetration Testing.

GoPwn 是一个开源的 AI Agent 驱动渗透测试平台。LLM 作为大脑进行推理和规划，MCP 工具作为四肢执行真实探测，平台作为中枢负责调度和审计。从信息收集到漏洞验证，全流程自动编排。

## Architecture

```
LLM (大脑)          ReAct 迭代推理、工具选择、审阅、风险判断
    ↕ ReAct Loop
Platform (中枢)     调度、审批、持久化、结果归一化、审计
    ↕ MCP stdio
MCP Tools (四肢)    真实探测、证据采集、结构化结果回传
```

平台采用 **ReAct（Reason + Act）执行引擎**：每轮次内，LLM 逐步推理并选取 MCP 工具执行，获取真实结果后继续推理，直到调用 `done`（完成本轮）或 `report_finding`（报告漏洞）。轮次间由 LLM 审阅决定是否继续深入。

## Features

- **ReAct 自主编排** — LLM 动态选择工具和策略，不是固定流水线
- **36+ MCP 安全工具** — 14 个 MCP Server 覆盖 DNS、Web、端口、漏洞验证、截图取证
- **多轮迭代执行** — LLM 审阅后自动推进下一轮，直到充分覆盖攻击面
- **实时可视化** — SSE 流式推送，实时展示 LLM 推理链和工具执行结果
- **审批与审计** — 高风险操作自动暂停等待审批，完整审计记录
- **Docker 靶场** — 内置 13 个靶场（DVWA / Juice Shop / WebGoat / Redis / SSH 等）

## Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop
- npm

### Setup

```bash
# Clone
git clone https://github.com/PSoul/LLMPentest.git
cd LLMPentest && npm install

# Start PostgreSQL
cd docker/postgres && docker compose up -d && cd ../..

# Initialize database
npx prisma migrate dev

# Launch
npm run dev
```

Open http://localhost:3000

### Default Account

| Field | Value |
|-------|-------|
| Account | `admin@company.local` |
| Password | `Prototype@2026` |

### LLM Configuration

Configure in `/settings/llm` or via environment variables:

```bash
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_ORCHESTRATOR_MODEL=Pro/deepseek-ai/DeepSeek-V3.2
LLM_REVIEWER_MODEL=Pro/deepseek-ai/DeepSeek-V3.2
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Frontend | React 19, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, TypeScript |
| Database | PostgreSQL 16 + Prisma 7.x |
| MCP | `@modelcontextprotocol/sdk`, stdio |
| Testing | Vitest (200+ unit) + Playwright (14 E2E) |
| Containers | Docker Compose |

## MCP Tools

14 MCP Servers covering:

| Capability | Servers | Tools |
|-----------|---------|-------|
| DNS / Subdomain / Cert | subfinder, whois | 3 |
| Web Probing | httpx, wafw00f | 3 |
| HTTP / API Discovery | curl, dirsearch | 4 |
| Port / Service / Network | fscan, netcat | 3 |
| Controlled Validation | curl (http-validation) | 2 |
| Screenshot & Evidence | Playwright MCP | 2 |
| Encoding & Crypto | encode | 4 |
| Intelligence | fofa, github-recon | 4 |
| Vulnerability Scanning | afrog | 2 |
| Script Execution | script-mcp-server | 4 |

## Docker Labs

```bash
cd docker/local-labs && docker compose up -d
```

| Lab | Port | Protocol |
|-----|------|----------|
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

## Project Structure

```
app/                    Pages (21) + API Routes (51)
components/             UI Components
lib/                    Core Business Logic
  workers/              Background Workers (ReAct / Review / Analyze)
  services/             Application Services
  repositories/         Data Access Layer
  domain/               Domain Models (Lifecycle State Machine)
  llm/                  LLM Prompts & Invocation
  mcp/                  MCP Registry & Execution Engine
  hooks/                React Hooks (SSE / ReAct Steps)
  infra/                Infrastructure (Prisma / Event Bus / Job Queue)
  types/                TypeScript Types
mcps/                   14 Local MCP Servers (36+ tools)
docker/
  local-labs/           13 Docker Lab Environments
  postgres/             PostgreSQL Dev Container
prisma/
  schema.prisma         25 Data Models
tests/                  Unit & API Tests
e2e/                    Playwright E2E Tests
docs/                   Design Docs & Guides
```

## Commands

```bash
npm run dev              # Dev server
npm run build            # Production build
npm run test             # Unit tests (vitest)
npm run e2e              # E2E tests (playwright)
npm run lint             # Lint
npm run worker:dev       # Background worker (dev)
```

## Documentation

| Document | Purpose |
|----------|---------|
| [API Reference](docs/api-reference.md) | 51 API Endpoints |
| [ReAct Engine](docs/react-engine.md) | ReAct Engine Design |
| [Architecture](docs/v2-architecture.md) | Platform Architecture |
| [Development Guide](docs/development-guide.md) | Dev Guide |
| [Prompt Engineering](docs/prompt-engineering.md) | Prompt Design |
| [Brand Guidelines](docs/brand-guidelines.md) | Brand & Naming |

## License

MIT

## Links

- Website: [gopwn.ai](https://gopwn.ai)
- GitHub: [PSoul/LLMPentest](https://github.com/PSoul/LLMPentest)
