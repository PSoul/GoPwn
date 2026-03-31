# Phase 22: 真实渗透测试闭环验证 (Real Pentest Closure Validation)

## 背景

平台已完成 Phase 21 UI/UX 全站修复，当前处于功能完整、UI 可用状态。核心架构：
- Next.js 15 App Router + Prisma 7.x + PostgreSQL 16
- 13 个 MCP 服务器（34+ 工具）通过 stdio 连接器驱动
- LLM 编排器支持多轮自动编排（autoReplan + maxRounds）
- Docker 靶场：DVWA (8081), Juice Shop (3000), WebGoat (18080/19090), 共 12 个服务

## 目标

1. **三靶场闭环验证** — 对 DVWA、WebGoat、Juice Shop 各执行一次完整的 LLM 编排 → MCP 执行 → 发现 → 报告闭环，验证 Prisma 数据层下全链路正确性
2. **多目标项目编排** — 创建一个包含多个靶场目标的项目，验证并行调度和作用域隔离
3. **MCP 连接器增强** — 超时/重试改进、结构化错误返回、执行日志可视化增强
4. **CI 就绪化** — GitHub Actions 配置 PostgreSQL service + vitest + playwright
5. **剩余 UI/UX** — P1-5 审批策略页重构、P1-8 验证码交互改造（可选）

## 前置条件

- 启动 PostgreSQL: `docker compose -f docker/postgres/compose.yaml up -d`
- 启动靶场: `docker compose -f docker/local-labs/compose.yaml up -d`
- 确认 LLM 配置: 数据库 `llm_profiles` 表已有 SiliconFlow DeepSeek-V3.2 配置
- 启动 dev server: `npm run dev` (默认端口 4500)

## LLM 配置

```
api_key=sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc
base_url=https://api.siliconflow.cn/
model=Pro/deepseek-ai/DeepSeek-V3.2
```

## 关键文件

- `code_index.md` — 项目完整代码索引
- `roadmap.md` — 开发路线图和阶段历史
- `docs/ui-ux-review-report.md` — UI/UX 审查报告（含剩余 P1/P2 待修复项）
- `lib/orchestrator-service.ts` — 编排器主入口
- `lib/mcp-connectors/stdio-mcp-connector.ts` — 通用 stdio 连接器
- `mcps/mcp-servers.json` — MCP 服务器配置

## 注意事项

1. 开发前新建分支（如 `feat/phase22-pentest-closure`）
2. 完成后更新 `code_index.md` 和 `roadmap.md`
3. MCP 服务器不在本仓库开发新的，使用现有 `mcps/` 目录
4. 保持 "LLM = brain, MCP = limbs" 边界
5. Docker 靶场端口：DVWA (8081), Juice Shop (3000), WebGoat (18080/19090)
6. 完成后运行完整测试：`npx vitest run` + `npx playwright test`
