# 代码索引 (Code Index)

> 本文件是项目代码的完整索引，帮助开发者和 LLM 快速了解每个文件的用途。
> 最后更新: 2026-04-05 | 项目版本: v0.9.4 (全面代码审计 + 孤儿清理 + API 格式统一)

## 项目概览

**授权外网安全评估平台** — 基于 Next.js 15 + TypeScript 的漏洞扫描驾驶舱，集成 LLM 编排、MCP 工具执行、审批工作流和项目生命周期管理。

**技术栈**: Next.js 15 (App Router) · TypeScript 5 · PostgreSQL 16 via Prisma 7.x · Tailwind CSS 3.4 · shadcn/ui · Radix UI · Vitest 3.0 · Playwright 1.58

---

## 1. 顶层配置

| 文件 | 用途 |
|------|------|
| `package.json` | 依赖声明、脚本命令 |
| `tsconfig.json` | TypeScript 编译器配置 |
| `next.config.mjs` | Next.js 框架配置 |
| `tailwind.config.ts` | Tailwind 主题（语义圆角 token: hero/card/panel/item）、深色模式、动画（fade-in） |
| `instrumentation.ts` | **[Phase 24b 新增]** 服务启动钩子（IPv4-first DNS 设置） |
| `middleware.ts` | 身份认证检查、CSRF 双重提交 Cookie、滑动窗口速率限制 |
| `Dockerfile` | 容器镜像构建 |
| `.env.example` | 环境变量模板 |

---

## 2. App 目录：页面与 API

### 2.1 控制台页面 (16 页)

所有 `app/(console)/**/page.tsx` 均为 async Server Component。

**仪表盘**: `/dashboard` — 关键指标、系统概览、资产预览、空平台引导

**项目工作区**:
- `/projects` — 项目列表（表格布局、搜索、归档确认）
- `/projects/new` — 新建项目（react-hook-form + zod 字段级验证）
- `/projects/[id]` — **[Phase 24b 重设计]** 项目概览（`ProjectOverview`），安全发现/资产发现统计卡片 + 最近活动
- `/projects/[id]/assets` — **[Phase 24b 新增]** 资产页，3 子 Tab：域名/主机与端口/Web与API（`AssetPageTabs`）
- `/projects/[id]/assets/ip/[assetId]` — **[Phase 24b 新增]** IP 详情页（开放端口/关联漏洞/Web应用）
- `/projects/[id]/findings` — **[Phase 24b 新增]** 漏洞列表页（按严重程度排序）
- `/projects/[id]/operations` — 执行控制面板（审批状态 + 调度开关 + 报告导出）
- `/projects/[id]/ai-logs` — **[Phase 24b 新增]** AI 日志页（LLM 调用记录 + 结构化展示）
- `/projects/[id]/vuln/[findingId]` — 漏洞详情（含原始输入输出、证据、修复建议）

**资产中心**: `/assets` `/assets/[id]`
**漏洞中心**: `/vuln-center` — 跨项目漏洞总览与筛选
**设置 (8 页)**: `/settings` (hub) + `llm` `mcp-tools`(Accordion 折叠) `users` `approval-policy` `audit-logs` `work-logs` `system-status`

**Phase 24 删除页面**: `/evidence/*`（证据降级为内部概念）、`/approvals`（审批改为项目内联）、`/projects/[id]/results/*`（合并到项目工作区）

**Loading/Error 体系**:
- 每个路由组都有专属 `loading.tsx`（Settings 共享 `SettingsSubPageSkeleton`）
- 控制台 + 项目工作区各有 `error.tsx` 错误边界
- 页面切换有 CSS fade-in 过渡动画（`app-shell.tsx` + `key={pathname}`）

### 2.2 API 路由 (51 端点)

**认证**: `/api/auth/login` `logout` `captcha` | **用户**: `/api/users` `[userId]`
**仪表盘**: `/api/dashboard` `/api/health`
**项目**: `/api/projects` `[projectId]` `archive` `context` `flow` `results/*` `report-export`
**编排**: `/api/projects/[id]/orchestrator/plan` `local-validation`
**ReAct**: `/api/projects/[projectId]/rounds/[round]/steps` — **[ReAct 新增]** 获取指定轮次的 ReAct 步骤列表（工具调用历史与推理链），供前端 ReAct 步骤面板消费
**调度**: `/api/projects/[id]/scheduler-control` `scheduler-tasks/[taskId]`
**MCP**: `/api/projects/[id]/mcp-runs` (GET+POST) `mcp-workflow/smoke-run`
**审批**: `/api/approvals` `[approvalId]` (PUT+PATCH) `/api/projects/[id]/approval-control`
**资产/证据**: `/api/assets` `[assetId]` `/api/evidence` `[evidenceId]`
**LLM**: `/api/llm-logs/recent` `stream` `/api/projects/[id]/llm-logs` `[logId]`
**设置**: `/api/settings/llm` (GET+PUT+PATCH) `mcp-tools/[id]` (PATCH) `mcp-tools/[id]/health-check` (POST) `mcp-servers/register` `agent-config` `approval-policy` (GET+PATCH) `audit-logs` `work-logs` `system-status` `sections`

---

## 3. Components (102 文件)

### 布局 (4)
`layout/app-shell.tsx` — SidebarProvider + 路由动画 | `app-header.tsx` — 面包屑 + 用户菜单
`app-sidebar.tsx` — 三分组导航 + 动态 badge | `ai-chat-widget.tsx` — SSE 实时 AI 日志

### 项目 (20+)
`project-list-client.tsx` — **[Phase 24c 修改]** 表格布局（项目名/状态/阶段/轮次/操作列）+ 归档确认 AlertDialog
`project-form.tsx` — 项目创建表单（react-hook-form + zod，仅创建模式）
**[Phase 24b 新增]** `project-overview.tsx` — 概览页（安全发现/资产发现统计卡片 + 最近活动）
**[Phase 24b 新增]** `project-summary.tsx` — 项目状态摘要（含启动/重启按钮）
**[Phase 24b 新增]** `project-workspace-nav.tsx` — 5-Tab 工作区导航（概览/资产/漏洞/执行控制/AI日志）
**[Phase 24b 新增]** `asset-page-tabs.tsx` — 资产页 3 子 Tab 容器（域名/主机与端口/Web与API）
**[Phase 24b 新增]** `asset-domains-table.tsx` — 域名资产表（含 IP 解析链接）
**[Phase 24c 修改]** `asset-hosts-table.tsx` — 主机与端口表（含父子层级关系 + IP 详情链接 + HTTP 协议自动检测 + label fallback 服务名）
**[Phase 24c 修改]** `asset-web-table.tsx` — Web/API 折叠分组（按 host:port 分组，可展开/收起，组内精简3列表格）
**[Phase 24b 新增]** `findings-list-table.tsx` — 漏洞列表（按严重程度排序，无状态列）
**[Phase 24b 新增]** `ip-detail.tsx` — IP 详情页（开放端口/关联漏洞/Web 应用）
**[Phase 24b 新增]** `finding-detail.tsx` — 漏洞详情（含证据展示、修复建议）
`project-operations-panel.tsx` — 执行控制综合面板（审批状态 + 调度开关）
`project-scheduler-runtime-panel.tsx` — 调度控制 + 停止/取消确认
`project-orchestrator-panel.tsx` — **[ReAct 修改]** 展示 ReAct 执行轮次（标题改为"ReAct 执行轮次"），使用 `use-react-steps` Hook 实时渲染每步 LLM 推理与工具调用
`project-mcp-runs-panel.tsx` — **[ReAct 修改]** MCP 运行记录面板，适配 ReAct 迭代执行产生的 mcp-run 记录格式
`project-llm-log-panel.tsx` — **[Phase 24c 修改]** AI 日志面板（结构化 JSON 展示 + 自动刷新 + ReAct 角色过滤 + Function Call 渲染）
`project-approval-bar.tsx` — 审批内联通知条（琥珀色可折叠），已集成至项目详情页
`project-report-export-panel.tsx` — 报告导出面板，已集成至项目详情页
`project-pipeline-log-panel.tsx` — 执行日志面板，已集成至 operations 页
`operations-collapsible-section.tsx` — 可折叠面板容器

**Phase 24b 删除**: `project-live-dashboard.tsx`、`project-vuln-tab.tsx`、`project-asset-tab.tsx`、`project-findings-table.tsx`、`project-stats-bar.tsx`
**Phase 24 删除**: `project-results-hub.tsx`、`approval-center-client.tsx`、`approval-list.tsx`、`approval-detail-sheet.tsx`、`evidence-detail.tsx`
**Phase 23 删除**: `stat-card.tsx`、`project-task-board.tsx`、`project-inventory-table.tsx`、`evidence-table.tsx`、9 个 kokonutui 组件

### 资产/仪表盘
**Phase 24c 审计删除**: `asset-center-client.tsx` `asset-table.tsx` `asset-profile-panel.tsx` `asset-relations.tsx` `dashboard-asset-preview.tsx` `project-card.tsx`（孤儿组件，无页面引用）
### 设置 (9): settings-hub-grid, settings-subnav, settings-sub-page-skeleton, llm-settings-panel, mcp-gateway-client(Accordion), mcp-tool-table, system-control-panel, system-status-grid, settings-log-table
### 共享 (4): page-header, section-card, status-badge, pagination
### shadcn/ui 基础库 (58): 表单输入、弹窗层、布局容器、文本显示、导航、工具类

---

## 4. Lib 目录：业务逻辑

> **ReAct 迭代执行引擎**（feature/react-iterative-execution）将批量"计划→执行→审阅"模型替换为单一 `react_round` 作业驱动的迭代循环；同步删除了 `planning-worker.ts` / `execution-worker.ts` 及其测试。
> lib/ 目录当前组织：`workers/` `hooks/` `services/` `repositories/` `domain/` `llm/` `mcp/` `infra/` `types/` `generated/`

### 根目录 (2 文件)
`prototype-types.ts` — 桶文件 | `utils.ts` — 通用工具函数

### lib/infra/ — 基础设施
`prisma.ts` — PrismaClient 单例（PrismaPg max:10 连接池） | `event-bus.ts` — 进程内 EventEmitter SSE 事件总线（按 projectId 分发）
`job-queue.ts` — pg-boss 作业队列封装 | `abort-registry.ts` — 运行中任务中断注册表
`pipeline-logger.ts` — 流水线结构化日志 | `api-handler.ts` — API 路由通用处理
`api-client.ts` — 前端 fetch 封装

### lib/types/ — TypeScript 类型定义
`labels.ts` — **[ReAct 修改]** UI 标签映射（lifecycle/phase/severity/risk 等）；生命周期状态已覆盖 ReAct 执行路径中的 `executing` / `reviewing` 状态标签

### lib/domain/ — 领域模型与规则
`lifecycle.ts` — 项目生命周期状态机；**[ReAct 修改]** 新增 `START_REACT` / `CONTINUE_REACT` / `RETRY_REACT` 三个事件，`idle` / `reviewing` / `failed` 状态直接转为 `executing`（跳过规划状态）
`phases.ts` — 渗透测试阶段定义与排序 | `scope-policy.ts` — 目标范围约束策略
`errors.ts` — 领域异常类型

### lib/llm/ — LLM 集成 (8 文件)
`prompts.ts` — **[ReAct 修改]** 保留审阅/分析/总结等提示词，已移除批量规划器（planner）提示词
`react-prompt.ts` — **[ReAct 新增]** ReAct 循环系统提示词构建器；根据项目上下文（目标/阶段/轮次/历史步骤摘要）生成 Thought→Action→Observation 结构化提示，导出 `ReactContext` 类型
`index.ts` — **[ReAct 修改]** LLM 模块入口；移除 `buildPlannerPrompt` 导出，保留 `buildReviewerPrompt` / `parseLlmJson` / `getLlmProvider`
`function-calling.ts` — OpenAI Function Calling 工具定义转换；将 MCP 工具列表映射为 OpenAI tools 格式，提供 `getControlFunctions()`（done / report_finding 控制函数）
`tool-input-mapper.ts` — 将 LLM tool call 参数映射为 MCP 工具输入格式
`call-logger.ts` — **[Phase 24c 修改]** LLM 调用日志记录（新增 Function Call 详情记录）| `openai-provider.ts` — **[Phase 24c 修改]** OpenAI 兼容 LLM 客户端（含 response_format 自动降级 + 现代 tools 格式支持）
`provider.ts` — LLM Provider 类型与接口定义 | `system-prompt.ts` — 系统级提示词基础模板

### lib/workers/ — 后台作业 Worker
`react-worker.ts` — **[ReAct 新增]** 处理 `react_round` 作业；运行 ReAct 循环（LLM tool call → MCP 工具执行 → 结果回填 → 下一步），支持 done / report_finding 两种终止路径；单轮最多 `MAX_STEPS_PER_ROUND=30` 步，工具超时 5 分钟
`react-context.ts` — **[ReAct 新增]** ReAct 循环上下文管理器（`ReactContextManager`）；维护迭代消息列表，实现滑动窗口压缩（RECENT_WINDOW=5，TOKEN_BUDGET=80000），防止上下文超限
`lifecycle-worker.ts` — **[ReAct 修改]** 处理 `round_completed` / `settle_closure` 作业；轮次审阅通过后发布下一轮 `react_round` 作业（`CONTINUE_REACT` 路径），替代原 plan_round 作业发布
`analysis-worker.ts` — 处理 `analyze_output` 作业；LLM 语义分析 MCP 工具输出，提取资产/证据/漏洞并写回数据库
`verification-worker.ts` — 处理 `verify_finding` 作业；对已发现漏洞执行二次验证
**[已删除]** ~~`planning-worker.ts`~~ — 原批量规划 worker（`plan_round` 作业），已由 ReAct 循环取代
**[已删除]** ~~`execution-worker.ts`~~ — 原批量执行 worker（`execute_tool` 作业），已由 ReAct 循环取代

### lib/hooks/ — React Hooks
`use-react-steps.ts` — **[ReAct 新增]** 客户端 Hook，订阅 SSE 事件流并维护当前轮次的 ReAct 步骤列表（`ReactStepEvent[]`）和轮次进度（`ReactRoundProgress`），用于 UI 实时展示 LLM 推理过程
`use-project-events.ts` — 订阅 `/api/projects/[id]/events` SSE 端点，分发 `ProjectEvent`（含 tool_started/tool_completed/react_step/round_completed 等事件类型）

### lib/services/ — 应用服务
`project-service.ts` — **[ReAct 修改]** 项目 CRUD 与生命周期管理；`startProject()` 直接发布 `react_round` 作业（使用 `START_REACT` / `RETRY_REACT` 事件），不再经过规划阶段
`approval-service.ts` — 审批决策处理，恢复等待审批的步骤 | `asset-service.ts` — 资产增删查改
`dashboard-service.ts` — 仪表盘聚合数据 | `settings-service.ts` — 平台配置读写
`mcp-bootstrap.ts` — MCP 服务器注册与工具发现初始化

### lib/mcp/ — MCP 调度与连接
MCP 调用入口、工具注册、stdio 连接器、服务器配置存储等（结构同前，详见各文件 JSDoc）

### lib/repositories/ — 数据访问层
`project-repo.ts` `mcp-run-repo.ts` `asset-repo.ts` `finding-repo.ts` `audit-repo.ts` `mcp-tool-repo.ts` 等 Prisma 封装层

### lib/generated/ — 代码生成
`prisma/` — Prisma Client 自动生成类型（`Severity` `PentestPhase` `RiskLevel` `Prisma` 等）

---

## 5. MCP 服务器 (mcps/, 13 个独立项目)

| 服务器 | 用途 | 关键工具 |
|--------|------|----------|
| `curl-mcp-server` | HTTP 请求 | request, raw_request, batch |
| `netcat-mcp-server` | TCP/UDP | tcp_connect, banner_grab |
| `encode-mcp-server` | 编解码 | encode_decode, hash_compute |
| `subfinder-mcp-server` | 子域名 | enum, verify |
| `whois-mcp-server` | WHOIS/ICP | whois_query, icp_query |
| `fofa-mcp-server` | FOFA 搜索 | search, host |
| `github-recon-mcp-server` | GitHub 侦察 | code_search, repo_search |
| `afrog-mcp-server` | 漏洞扫描 | scan, list_pocs |
| `fscan-mcp-server` | 内网扫描 | full_scan, port_scan |
| `dirsearch-mcp-server` | 目录爆破 | scan, recursive |
| `httpx-mcp-server` | HTTP 探测 | probe, tech_detect |
| `wafw00f-mcp-server` | WAF 检测 | detect, list |
| `script-mcp-server` | LLM 脚本 | execute_code, execute_command |

---

## 6. Tests (60+ 文件, 178+ 用例)

API (15+) · 单元 (12+) · UI (8+) · E2E Playwright (14) · 集成 (10+, 默认跳过)

---

## 7. Docker

`docker/postgres/compose.yaml` — PostgreSQL 16
`docker/local-labs/compose.yaml` — 12 个靶场

---

## 8. 术语表

| 领域 | 术语/值 | 说明 |
|------|---------|------|
| 资产状态 (`scopeStatus`) | 已确认 / 待验证 / 需人工判断 | 结果页 StatusBadge 映射: success / warning / info |
| 项目状态 (`ProjectStatus`) | 待启动 / 等待审批 / 运行中 / 已暂停 / 已停止 / 已完成 | 项目生命周期 |
| UI 标签 | ReAct 步骤 | 单轮内 LLM 推理+工具调用的一次迭代 |
| UI 标签 | AI规划 | 原编排器计划生成步骤（ReAct 引擎中已内嵌于每一步推理） |
| UI 标签 | 探测工具 | MCP 工具的面向用户称呼（设置页/空状态/通知） |
| 作业类型 | react_round | ReAct 执行引擎作业（替代原 plan_round + execute_tool） |
| 生命周期事件 | START_REACT | 从 idle 状态启动 ReAct 执行轮次 |
| 生命周期事件 | CONTINUE_REACT | 轮次审阅通过后继续下一轮 ReAct 执行 |
| 生命周期事件 | RETRY_REACT | 从 failed 状态重试 ReAct 执行 |
| UI 标签 | 执行控制 | 原"调度面板"，现为工作区第 6 个 Tab |
| UI 标签 | 自动收尾 | 项目完成阶段的自动化总结 |
| UI 标签 | 信息 | scopeStatus "需人工判断" 对应的 tone |

---

## 9. 架构演进

- **Phase 19** (2026-03-30): 类型拆分 + 门面消除 + 编排器分解
- **Phase 20** (2026-03-31): 5 个大文件拆为 14 个子模块
- **Phase 21** (2026-03-31): UI/UX 全站审查修复（loading/确认对话框/过渡动画/折叠面板/字段验证/圆角统一/空状态差异化）
- **Phase 21 Debug R1-R3** (2026-03-31): 14 个真实使用 bug 修复（LLM 上下文窗口/超时/文案清理/审批策略/subfinder 提取）
- **Phase 21 Debug R4** (2026-03-31): 7 个问题（统计卡片跳转/进度横幅状态/fscan ENOENT/AI 日志结构化/失败工具摘要注入/参数修复/maxRounds 文案）
- **Phase 21 Debug R5** (2026-03-31): 7 个问题（资产提取管线重写: seed-normalizer→host, tcp→port, webEntry→host+port; fscan.exe 编译; TLS 证书; whois 超时; extractSummaryLines 增强; target 格式约束）
- **Phase 21 Debug R6** (2026-03-31): Tab 重构 + 术语清理（8 Tab→7 Tab: 删除上下文/流程页，新增站点页; result 页改用 `listStoredAssetsByTypes` 直查 DB; 删除 project-knowledge-tabs/project-stage-flow 组件; 全站术语统一: scopeStatus/ProjectStatus/探测工具/执行控制/AI规划/自动收尾）
- **Phase 22 Real Validation** (2026-04-01): 真实渗透测试闭环验证修复 — MCP 超时检测（英文消息匹配）、maxRounds 10→5 全局统一、高失败率提前收敛（>60%+≥3轮）、LLM 收敛原则引导、MCP setup/tool 超时分离、reviewer 结论客观性约束、host.docker.internal→localhost 目标规范化、覆盖不足检测
- **Phase 22b LLM Writeback** (2026-04-03): LLM 语义分析替代全部工具特定解析器 — `mcp-execution-service.ts` 从 1445 行缩减至 ~330 行，删除 ~900 行工具特定 normalizer 代码；新增 `llm-writeback-service.ts` 通过 analyzer LLM 语义解析任意工具输出并生成平台记录（assets/evidence/findings）；三级 LLM profile（orchestrator/reviewer/analyzer）独立配置；extractor→analyzer 全站重命名；LLM 不可用时优雅降级为 evidence 保存
- **Phase 23 架构演进** (2026-04-03): lib/ 领域化重组 + 连接器工厂 + 死代码清理 —
  (1) **目录重组**: 62 个扁平 lib/ 文件重组为 9 个领域子目录（orchestration/mcp/llm/project/auth/settings/infra/analysis/data），根目录仅保留 3 个文件；
  (2) **连接器工厂**: 新增 `real-mcp-connector-base.ts` 提供 `createRealMcpConnector()` 工厂函数，4 个真实 MCP 连接器改用统一 base 消除重复样板代码；`stdio-mcp-connector` 改用通用 TCP 横幅抓取替代端口硬编码探针；
  (3) **死代码清理**: 删除 `prototype-data.ts` `prototype-store.ts` `artifact-normalizer-stdio.ts` `execution-runner.ts` `api-error-messages.ts` `dispatch-helpers.ts`、9 个 kokonutui 组件、`stat-card.tsx` `project-task-board.tsx` `project-inventory-table.tsx` `evidence-table.tsx` 及相关测试文件；
  (4) **WebGoat 去特化**: `orchestrator-local-lab.ts` 和 `orchestrator-target-scope.ts` 移除 `isWebGoatBaseUrl` 等 WebGoat 特化逻辑；
  (5) **本地连接器清理**: `local-foundational-connectors.ts` 清除假数据生成
- **Phase 23b TCP 通用化与实战验证** (2026-04-03): TCP 服务渗透流水线 + LLM 代码持久化 + 多轮上下文增强 —
  (1) **TCP 通用协议探测**: `stdio-mcp-connector.ts` fallback 脚本从无效 `\r\n` 改为 `PING\r\n`+`INFO\r\n` 多协议探针，自动识别 Redis/SSH/MySQL/MongoDB/Elasticsearch/FTP/SMTP；
  (2) **llmCode 数据库持久化**: 新增 `McpRun.llmCode` 字段（Prisma schema + types + transforms），LLM 生成的 execute_code 脚本从内存 Map 迁移到 PostgreSQL，解决审批-恢复周期代码丢失；
  (3) **TCP 服务测试方法论**: `llm-brain-prompt.ts` 新增 5 步 TCP 测试方法论（banner→未授权→弱口令→配置→信息泄露）+ analyzer 规则 #7（TCP 未授权访问判定标准）；
  (4) **TCP fallback 计划增强**: `orchestrator-service.ts` TCP 兜底从 1 项扩展为 3 项（banner 探测 + 未授权访问 + 弱口令/配置检测）；
  (5) **多轮上下文增强**: `orchestrator-context-builder.ts` 注入 execute_code 实际 rawOutput（截断 2000 字符）给 LLM 下一轮规划；
  (6) **OpenAI 兼容层**: `openai-compatible-provider.ts` 新增 `fetchWithJsonFormatFallback()` 自动降级 response_format；
  (7) **Redis 实战验证**: DVWA Redis(6379) 端到端测试 — 4 资产、23 证据、1 高危发现（未授权访问）
- **Phase 24 概念精简 + 实时仪表盘** (2026-04-04): 用户概念从 11 个压缩到 4 个 + SSE 实时推送 + 路由清理 —
  (1) **数据模型增强**: Finding 新增 rawInput/rawOutput/screenshotPath/capturedUrl/remediationNote/createdAt 字段，Evidence 新增 createdAt/updatedAt，GlobalApprovalControl 新增 autoApproveMediumRisk，新增 5 个缺失索引；
  (2) **Bug 修复**: 证据 ID 碰撞（MD5 hash 替代 slice）、审批事务保护（syncStoredMcpRunsAfterApprovalDecision 重试）；
  (3) **SSE 实时推送**: `project-event-bus.ts` 进程内 EventEmitter + SSE API 端点 + `useProjectEvents` React Hook + 8 个写入点发射事件；
  (4) **LLM Writeback 调整**: Finding 创建时填充 rawInput/rawOutput/remediationNote；
  (5) **前端重设计**: 项目首页改为 `ProjectLiveDashboard`（3-Tab: 漏洞/资产/执行日志），7 个新组件（stats-bar/vuln-tab/asset-tab/activity-log/approval-bar/live-dashboard/finding-detail），新增 `/projects/[id]/vuln/[findingId]` 漏洞详情页；
  (6) **路由清理**: 删除 `/evidence/*` `/approvals` `/projects/[id]/results/*` 共 9 个页面 + 5 个孤立组件（-1512 行），6 处残留链接更新，导航精简为 5 项；
  (7) **审批自动化**: 中风险操作默认自动执行（autoApproveMediumRisk）
- **feature/react-iterative-execution ReAct 迭代执行引擎** (2026-04-05): 批量"计划→执行→审阅"模型替换为 ReAct 迭代循环 —
  (1) **ReAct Worker**: 新增 `react-worker.ts` 处理 `react_round` 作业，在单轮内通过 OpenAI Function Calling 逐步选择 MCP 工具，获取结果后决定下一动作，替代原来的 `plan_round`+`execute_tool` 双作业模型；
  (2) **上下文管理器**: 新增 `react-context.ts` 实现 `ReactContextManager`，维护迭代消息历史并以滑动窗口压缩（RECENT_WINDOW=5，TOKEN_BUDGET=80 k）防止超限；
  (3) **ReAct 提示词**: 新增 `react-prompt.ts` 构建 Thought→Action→Observation 系统提示，`prompts.ts` 移除 planner 相关提示词；
  (4) **生命周期更新**: `lifecycle.ts` 新增 `START_REACT` / `CONTINUE_REACT` / `RETRY_REACT` 事件，跳过规划状态直接进入执行；`project-service.ts` 和 `lifecycle-worker.ts` 对应更新作业发布逻辑；
  (5) **前端适配**: 新增 `use-react-steps.ts` Hook 和 `app/api/projects/[projectId]/rounds/[round]/steps/route.ts` API 端点支持实时步骤展示；`project-orchestrator-panel.tsx` / `project-mcp-runs-panel.tsx` 适配新数据结构；
  (6) **删除**: `planning-worker.ts` / `execution-worker.ts` 及其配套测试文件
- **Phase 24b 前端重设计 + 平台稳定性修复** (2026-04-05): 项目工作区 5-Tab 重设计 + 11 个平台 bug 修复 —
  (1) **工作区重设计**: 从 3-Tab Live Dashboard 改为 5 独立路由 Tab（概览/资产/漏洞/执行控制/AI日志），删除 `ProjectLiveDashboard` 等 5 个旧组件，新增 11 个组件；
  (2) **资产分类展示**: 资产页 3 子 Tab（`AssetPageTabs`），域名/主机与端口/Web与API 各自独立表格，IP 详情页支持跨页导航；
  (3) **P0 修复**: `instrumentation.ts` IPv4-first DNS + `stdio-connector.ts` RPC timeout 时 SIGKILL 强杀子进程；
  (4) **P1 修复**: PrismaPg 连接池 max:10 + `mcp-run-repo.ts` terminal 状态自动检查 round_completed；
  (5) **P2 修复**: `finding-repo.ts` normalizeTitle 模糊去重 + `execution-worker.ts` rawRequest 自动构造；
  (6) **UI 修复**: light/dark 双主题适配、LLM profile 查找 role 修正、API 返回格式修正、findings 按严重程度排序
- **Phase 24c E2E Bug 修复 + 前端优化** (2026-04-05): 9 个 E2E 测试 Bug 修复 + 前端优化 —
  (1) **OpenAI tools 格式升级**: `openai-provider.ts` 从废弃的 `functions` 格式升级为现代 `tools` 格式，修复 LLM 不返回 function call 的核心问题；
  (2) **call-logger Function Call 记录**: `call-logger.ts` 在 response 中附加 `[Function Call] name(args)` 详情，解决 ReAct 日志 "暂无内容" 问题；
  (3) **AI 日志增强**: `project-llm-log-panel.tsx` 新增 `react` 角色过滤 + Function Call 结构化渲染；
  (4) **项目列表改表格**: `project-list-client.tsx` 从卡片网格重写为 Table 组件表格布局；
  (5) **资产折叠分组**: `asset-web-table.tsx` 从扁平表格重写为按 host:port 折叠分组，可展开/收起；
  (6) **协议自动检测**: `asset-hosts-table.tsx` 根据 webapp/api_endpoint 子资产自动判断 HTTP 协议；服务名用 portAsset.label 做 fallback；
  (7) **布局精简**: `layout.tsx` 删除无意义的 target 标签和 phase badge；
  (8) **IPv4 DNS 修复**: `worker.ts` 添加 `dns.setDefaultResultOrder("ipv4first")`；
  (9) **重复作业防护**: `lifecycle-worker.ts` / `project-service.ts` 为 `react_round` 作业添加 `singletonKey`
- **Phase 24c 代码审计 + API 格式统一** (2026-04-05): 全面代码审计修复 18 个隐藏问题 —
  (1) **API 响应格式统一**: 修复 `projects POST` / `approval-policy GET` / `settings/llm PUT` / `approvals PUT` 等 6 个端点返回裸对象问题，统一为 `{ key: data }` 包装格式；
  (2) **缺失端点创建**: 新增 `/api/llm-logs/recent`（全局 LLM 日志）、`/api/settings/mcp-tools/[id]` PATCH（工具配置）、`/api/settings/mcp-tools/[id]/health-check` POST（健康巡检）、`/api/projects/[id]/mcp-runs` POST（手动调度）、`/api/projects/[id]/report-export` POST（报告导出）；
  (3) **审批接口完善**: `/api/approvals/[id]` 新增 PATCH 方法适配前端 `{ status }` 参数格式；
  (4) **孤儿组件清理**: 删除 6 个无页面引用的孤儿组件（asset-center-client/asset-table/asset-profile-panel/asset-relations/dashboard-asset-preview/project-card）；
  (5) **组件集成**: `ProjectApprovalBar` 集成至项目详情页、`ProjectReportExportPanel` 集成至项目详情页、`ProjectPipelineLogPanel` 集成至 operations 页；
  (6) **死代码清除**: `project-form.tsx` 移除未使用的 edit 模式分支；
  (7) **文档同步**: 7 个文档文件术语更新（function_call→tool_calls, finish_round→done）+ API 参考/代码索引同步
