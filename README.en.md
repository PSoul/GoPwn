# GoPwn

> The Next Generation of Penetration Testing.

**[中文](README.md)**

GoPwn is an open-source AI Agent-driven penetration testing platform. LLM serves as the brain for reasoning and planning, MCP tools serve as the hands for real-world probing, and the platform serves as the central hub for orchestration and auditing. Fully automated from reconnaissance to vulnerability verification.

## Architecture

```
LLM (Brain)         ReAct iterative reasoning, tool selection, review, risk assessment
    ↕ ReAct Loop
Platform (Hub)      Scheduling, approval, persistence, normalization, auditing
    ↕ MCP stdio
MCP Tools (Hands)   Real probing, evidence collection, structured result reporting
```

The platform uses a **ReAct (Reason + Act) execution engine**: within each round, the LLM reasons step-by-step and selects MCP tools to execute, continues reasoning after receiving real results, until calling `done` (round complete) or `report_finding` (report vulnerability). Between rounds, the LLM reviews results to decide whether to continue deeper.

## Features

- **ReAct Autonomous Orchestration** — LLM dynamically selects tools and strategies, not a fixed pipeline
- **36+ MCP Security Tools** — 14 MCP Servers covering DNS, Web, ports, vulnerability validation, screenshot evidence
- **Multi-Round Iterative Execution** — LLM reviews and automatically advances to next round until attack surface is covered
- **Real-Time Visualization** — SSE streaming, real-time display of LLM reasoning chains and tool execution results
- **Approval & Auditing** — High-risk operations auto-pause for approval, complete audit trail
- **Docker Labs** — Built-in 13 lab environments (DVWA / Juice Shop / WebGoat / Redis / SSH, etc.)

## Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop
- npm

### Setup

```bash
# Clone
git clone https://github.com/PSoul/GoPwn.git
cd GoPwn && npm install

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
- GitHub: [PSoul/GoPwn](https://github.com/PSoul/GoPwn)
