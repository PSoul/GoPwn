# Plan 5: 端到端实跑验证

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Docker 靶场上完整跑一次 V2 流水线，验证从项目创建到完成（或手动停止）的全链路，用调试日志定位并修复实际运行中的问题。

**Architecture:** 手动操作验证，不自动化。启动靶场 + worker → 创建项目 → 启动 → 观察调试日志 → 记录问题 → 修复。

**Tech Stack:** Docker Compose + Next.js dev server + worker process

**依赖:** Plan 1-4 全部完成

---

### Task 1: 环境准备

- [ ] **Step 1: 确认 Docker 靶场运行**

Run: `cd docker/local-labs && docker compose up -d`

验证 DVWA 可访问：`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081`
Expected: `200` 或 `302`

- [ ] **Step 2: 确认 PostgreSQL 运行**

Run: `cd docker/postgres && docker compose up -d`

- [ ] **Step 3: 运行 migration**

Run: `npx prisma migrate dev`

- [ ] **Step 4: 启动 Next.js dev server（终端 1）**

Run: `npm run dev`

- [ ] **Step 5: 启动 worker 进程（终端 2）**

Run: `npm run worker`

验证：看到 "MCP bootstrap complete" 和 "all handlers registered" 日志。
如果看到 "found stale projects, attempting recovery"，说明 Plan 2 的恢复机制生效。

---

### Task 2: 配置 LLM

- [ ] **Step 1: 登录平台**

浏览器打开 `http://127.0.0.1:3000`，用 `admin@company.local` / `Prototype@2026` 登录。

- [ ] **Step 2: 配置 LLM provider**

进入 Settings → LLM，配置 planner、analyzer、reviewer 三个角色的：
- Base URL
- API Key
- Model name

- [ ] **Step 3: 同步 MCP 工具**

进入 Settings → MCP Servers，点击"同步工具"。
验证：工具列表显示 30+ 工具。

---

### Task 3: 创建项目并启动

- [ ] **Step 1: 创建项目**

进入 Projects，点击新建：
- 名称：`E2E Validation`
- 目标：`http://127.0.0.1:8081`（DVWA）

- [ ] **Step 2: 启动项目**

进入项目详情页，点击"启动"按钮。

- [ ] **Step 3: 观察调试日志 tab**

切换到"调试日志" tab，验证：
- 能看到 `plan_round | started` 日志
- 能看到 `plan_round | llm_call` 日志
- 能看到 `plan_round | llm_response` 日志（含计划项数量）
- 能看到 `execute_tool | started` 日志

---

### Task 4: 验证全链路

- [ ] **Step 1: 等待第 1 轮完成**

观察调试日志，等待看到 `round_completed | started`。

验证清单：
| 检查项 | 验证方式 |
|--------|---------|
| plan_round 有 LLM 调用/响应日志 | 调试日志 tab |
| execute_tool 有工具调用/结果日志 | 调试日志 tab |
| analyze_result 有分析结果日志 | 调试日志 tab |
| round_completed 有 reviewer 决策日志 | 调试日志 tab |
| Assets 列表有数据 | 资产 tab |
| McpRun 有 rawOutput | 数据库检查 |
| LlmCallLog 有记录 | Operations 页面 |

- [ ] **Step 2: 如果流程卡住，查看调试日志定位问题**

常见问题及排查：
- `plan_round | failed` → 检查 LLM 配置是否正确
- `execute_tool | failed` → 检查 MCP server 是否启动
- `analyze_result | failed` → 检查 LLM JSON 解析日志
- 没有新日志产生 → worker 终端看 Pino 输出

- [ ] **Step 3: 等待第 2 轮或手动停止**

如果 reviewer 决定 continue，等第 2 轮开始。验证 planner 能看到第 1 轮的 rawOutput（在 LlmCallLog 中检查 prompt 是否包含"上一轮执行结果"）。

如果想测试停止功能，点"停止"按钮。验证：
- 项目状态变为 stopped
- 如有进行中的 LLM 调用，被 abort
- settle_closure 被触发，生成报告

---

### Task 5: 问题修复

- [ ] **Step 1: 记录发现的问题**

在每个问题上创建简短笔记，包含：
- 症状（哪个日志条目显示了问题）
- 原因
- 修复方案

- [ ] **Step 2: 逐个修复**

- [ ] **Step 3: 重新运行验证**

删除项目，重新创建并启动，验证修复有效。

- [ ] **Step 4: Commit 所有修复**

```bash
git add -A
git commit -m "fix: resolve issues found during E2E validation"
```

---

### Task 6: 验证停止/恢复

- [ ] **Step 1: 测试项目停止**

在项目执行中点击"停止"。验证：
- lifecycle 变为 stopped
- 调试日志显示 abort 相关信息
- 结算报告被生成

- [ ] **Step 2: 测试 worker 崩溃恢复**

1. 创建新项目并启动
2. 等项目进入 executing 状态
3. 杀掉 worker 进程（Ctrl+C）
4. 重启 worker：`npm run worker`
5. 验证：看到 "stale_recovery" 日志，项目继续执行

- [ ] **Step 3: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve stop/recovery issues from E2E validation"
```
