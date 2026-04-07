# GoPwn — Claude Code 项目指南

## 项目概述

GoPwn 是 AI Agent 驱动的渗透测试平台。LLM 通过 ReAct 循环自主推理选取 MCP 工具执行真实探测。

## 技术栈

- **框架**: Next.js 15 (App Router) + React 19
- **后端**: TypeScript, Prisma 7.x, PostgreSQL 16, pg-boss
- **测试**: Vitest (219 单元/集成) + Playwright (31 E2E)
- **MCP**: 13 servers, 38 tools via `@modelcontextprotocol/sdk`

## 关键架构

```
app/          页面 + API 路由（Next.js App Router）
lib/
  workers/    后台 Worker（react-worker, analysis-worker, verification-worker, lifecycle-worker）
  services/   应用服务层
  repositories/ 数据访问层（Prisma）
  domain/     领域模型（lifecycle 状态机）
  llm/        LLM 调用（openai-provider, call-logger, prompts, react-prompt）
  mcp/        MCP 连接器（stdio-connector, registry）
  infra/      基础设施（prisma, event-bus, job-queue, pg-listener）
mcps/         13 个本地 MCP Server
worker.ts     Worker 入口（pg-boss 作业处理）
```

## 编码规范

- 使用中文注释和日志消息
- API 路由使用 `apiHandler` + `json` 封装
- LLM profile IDs: `planner`（react 复用）, `analyzer`, `reviewer`
- 生命周期状态机在 `lib/domain/lifecycle.ts`
- 所有 MCP 工具调用通过 `lib/mcp/registry.ts` 统一路由

## 常用命令

```bash
npm run dev                    # Next.js 开发服务器
npx tsx watch worker.ts        # Worker 进程
npx vitest run                 # 单元/集成测试
npx playwright test            # E2E 测试
npx tsc --noEmit               # 类型检查
cd docker/local-labs && docker compose up -d  # 启动靶场
```

## 测试

- **E2E seed**: `node scripts/e2e-seed-database.mjs`（清空数据库 + 插入测试用户和 LLM profiles）
- **E2E 模式**: `E2E_TEST_MODE=true` 环境变量绕过 CSRF
- 测试账号: `researcher@company.local` / `Prototype@2026`
- 真实渗透测试 E2E 需要 Docker 靶场 + Worker + LLM API 配置

## 注意事项

- LLM prompt 中**不能包含具体攻击代码示例**，只教方法论
- MCP 子进程管理：Worker 退出时需调用 `closeAll()` 清理所有 stdio 连接器
- pg-boss 作业队列：seed 数据库后需重启 Worker 以避免处理陈旧作业
