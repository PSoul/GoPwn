# 代码索引 (Code Index)

> 本文件是项目代码的完整索引，帮助开发者和 LLM 快速了解每个文件的用途。
> 最后更新: 2026-04-03 | 项目版本: v0.7.0 (Phase 23 — 架构演进: lib/ 领域化重组 + 连接器工厂 + 死代码清理)

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
| `middleware.ts` | 身份认证检查、CSRF 双重提交 Cookie、滑动窗口速率限制 |
| `Dockerfile` | 容器镜像构建 |
| `.env.example` | 环境变量模板 |

---

## 2. App 目录：页面与 API

### 2.1 控制台页面 (25 页)

所有 `app/(console)/**/page.tsx` 均为 async Server Component。

**仪表盘**: `/dashboard` — 关键指标、系统概览、资产预览、空平台引导

**项目工作区 (7 Tab)**:
工作区导航 (`project-workspace-nav.tsx`) 提供 7 个标签页: **概览 / 域名 / 站点 / 端口 / 漏洞 / 执行控制 / AI 日志**

- `/projects` — 项目列表（卡片网格、搜索、归档确认）
- `/projects/new` — 新建项目（react-hook-form + zod 字段级验证）
- `/projects/[id]` — 项目概览（含 `ProjectResultsHub` 4 宫格跳转: 域名/站点/端口/漏洞）
- `/projects/[id]/edit` — 编辑项目
- `/projects/[id]/operations` — 执行控制面板（折叠式高级面板 + 确认对话框）
- `/projects/[id]/ai-logs` — AI 日志（SSE 实时流）

**结果 (4 页)** — 各自独立空状态，直接通过 `listStoredAssetsByTypes()` 查询 DB（不再依赖 assetGroups 缓存）:
- `/projects/[id]/results/domains` — 域名（Globe 图标，查 domain/subdomain 类型）
- `/projects/[id]/results/sites` — **[新增]** 站点（Globe 图标，查 entry/web/api 类型，含 extractField 辅助解析）
- `/projects/[id]/results/network` — 端口/服务（Network 图标，查 host/ip/port/service 类型）
- `/projects/[id]/results/findings` — 漏洞（ShieldAlert 图标，查 findings via `listStoredProjectFindings`）

**已删除页面**: `/projects/[id]/context`（上下文）和 `/projects/[id]/flow`（阶段流程）的前端页面已移除，相关功能合并到概览页。对应 API 路由 `/api/projects/[id]/context` 和 `/api/projects/[id]/flow` 仍保留供后端使用。

**资产与证据**: `/assets` `/assets/[id]` `/evidence` `/evidence/[id]`
**系统功能**: `/approvals` — 审批（确认对话框） | `/vuln-center` — 漏洞中心
**设置 (8 页)**: `/settings` (hub) + `llm` `mcp-tools`(Accordion 折叠) `users` `approval-policy` `audit-logs` `work-logs` `system-status`

**Loading/Error 体系**:
- 每个路由组都有专属 `loading.tsx`（Settings 共享 `SettingsSubPageSkeleton`）
- 控制台 + 项目工作区各有 `error.tsx` 错误边界
- 页面切换有 CSS fade-in 过渡动画（`app-shell.tsx` + `key={pathname}`）

### 2.2 API 路由 (47 端点)

**认证**: `/api/auth/login` `logout` `captcha` | **用户**: `/api/users` `[userId]`
**仪表盘**: `/api/dashboard` `/api/health`
**项目**: `/api/projects` `[projectId]` `archive` `context` `flow` `results/*` `report-export`
**编排**: `/api/projects/[id]/orchestrator/plan` `local-validation`
**调度**: `/api/projects/[id]/scheduler-control` `scheduler-tasks/[taskId]`
**MCP**: `/api/projects/[id]/mcp-runs` `mcp-workflow/smoke-run`
**审批**: `/api/approvals` `[approvalId]` `/api/projects/[id]/approval-control`
**资产/证据**: `/api/assets` `[assetId]` `/api/evidence` `[evidenceId]`
**LLM**: `/api/llm-logs/recent` `stream` `/api/projects/[id]/llm-logs` `[logId]`
**设置**: `/api/settings/llm` `mcp-tools` `[toolId]` `mcp-servers/register` `agent-config` `approval-policy` `audit-logs` `work-logs` `system-status` `sections`

---

## 3. Components (102 文件)

### 布局 (4)
`layout/app-shell.tsx` — SidebarProvider + 路由动画 | `app-header.tsx` — 面包屑 + 用户菜单
`app-sidebar.tsx` — 三分组导航 + 动态 badge | `ai-chat-widget.tsx` — SSE 实时 AI 日志

### 项目 (15)
`project-list-client.tsx` — 卡片网格 + 归档确认 AlertDialog
`project-form.tsx` — react-hook-form + zod 字段级验证
`project-workspace-nav.tsx` — 7 标签页导航（概览/域名/站点/端口/漏洞/执行控制/AI 日志）
`project-results-hub.tsx` — 概览页 4 宫格结果跳转（域名/站点/端口/漏洞，含各类型资产计数）
`project-operations-panel.tsx` — 执行控制综合面板（审批状态 + 调度开关）
`project-scheduler-runtime-panel.tsx` — 调度控制 + 停止/取消确认
`project-orchestrator-panel.tsx` — LLM 编排 | `project-mcp-runs-panel.tsx` — MCP 记录
`project-findings-table.tsx` — 漏洞表格 + 空状态
`operations-collapsible-section.tsx` — 可折叠面板容器
其他: summary, workspace-intro, card, report-export-panel, llm-log-panel

**Phase 23 删除**: `stat-card.tsx`、`project-task-board.tsx`、`project-inventory-table.tsx`、`evidence-table.tsx`、9 个 kokonutui 组件
**Phase 21 删除**: `project-knowledge-tabs.tsx`（上下文标签页）、`project-stage-flow.tsx`（阶段流程可视化）

### 审批 (3): `approval-center-client.tsx` `approval-list.tsx` `approval-detail-sheet.tsx`（含确认对话框）
### 资产/证据/仪表盘 (6): asset-center-client, asset-table, asset-profile-panel, asset-relations, evidence-detail, dashboard-asset-preview
### 设置 (9): settings-hub-grid, settings-subnav, settings-sub-page-skeleton, llm-settings-panel, mcp-gateway-client(Accordion), mcp-tool-table, system-control-panel, system-status-grid, settings-log-table
### 共享 (4): page-header, section-card, status-badge, pagination
### shadcn/ui 基础库 (58): 表单输入、弹窗层、布局容器、文本显示、导航、工具类

---

## 4. Lib 目录：业务逻辑

> Phase 23 将原 62 个扁平文件重组为 **9 个领域子目录**，根目录仅保留 3 个文件。

### 根目录 (3 文件)
`prototype-types.ts` — 桶文件 | `prototype-record-utils.ts` — 记录工具函数 | `utils.ts` — 通用工具

### lib/infra/ — 基础设施 (8 文件)
`prisma.ts` — PrismaClient 单例 | `prisma-transforms.ts` — DB ↔ TypeScript 转换（20+ 模型）
`api-handler.ts` — API 路由通用处理 | `api-client.ts` — 前端 fetch 封装
`env-detector.ts` — 环境检测 | `navigation.ts` — 路由导航辅助
`local-lab-catalog.ts` — 靶场目录 | `api-compositions.ts` — 组合层桶文件

### lib/types/ (10 文件)
`project.ts` — 含 `ProjectStatus`（"运行中" | "待启动" | "已暂停" | "已停止" | "等待审批" | "已完成"）
`approval.ts` `mcp.ts` `scheduler.ts` `asset.ts` `evidence.ts` `settings.ts` `llm-log.ts` `user.ts` `payloads.ts`

### lib/auth/ — 认证安全 (4 文件)
`auth-session.ts` — 会话管理 | `auth-repository.ts` — 用户存储
`csrf.ts` — CSRF 双重提交 Cookie | `rate-limit.ts` — 滑动窗口速率限制

### lib/llm/ — LLM 集成 (4 文件)
`llm-brain-prompt.ts` — 编排/分析提示词（含 ANALYZER_BRAIN）
`llm-writeback-service.ts` — LLM 语义分析工具输出并生成平台记录（替代原有 ~900 行工具特定解析器）
`llm-call-logger.ts` — 调用日志记录 | `llm-settings-repository.ts` — LLM 配置存储
（LLM Provider 仍在 `lib/llm-provider/`: `openai-compatible-provider.ts` `types.ts` `registry.ts`）

### lib/settings/ — 平台配置 (4 文件)
`agent-config.ts` — AI Agent 配置 | `platform-config.ts` — 平台全局配置
`llm-settings-write-schema.ts` — LLM 设置 zod 校验 | `scheduler-write-schema.ts` — 调度设置 zod 校验

### lib/analysis/ — 分析引擎 (2 文件)
`tool-output-summarizer.ts` — 工具输出摘要 | `failure-analyzer.ts` — 失败原因分析

### lib/orchestration/ — 编排器 (6 文件)
`orchestrator-service.ts` — 主入口（默认 maxRounds=5） | `orchestrator-target-scope.ts` — 目标分类（已移除 WebGoat 特化逻辑 `isWebGoatBaseUrl`）
`orchestrator-plan-builder.ts` — AI 规划生成 | `orchestrator-execution.ts` — 多轮执行（含 buildFailedToolsSummary 注入 + 高失败率提前收敛）
`orchestrator-local-lab.ts` — 靶场验证（已移除 WebGoat 特化逻辑） | `orchestrator-context-builder.ts` — 上下文构建 + 失败工具摘要 + target 格式约束 + 收敛原则引导

### lib/mcp/ — MCP 调度与服务 (15 文件)
`mcp-scheduler-service.ts` — 调度主服务 | `mcp-execution-service.ts` — 执行服务（仅保留 3 个内部工具本地处理 + 其余全部走 LLM writeback 分析）
`mcp-execution-runtime.ts` — 运行时上下文 | `mcp-execution-abort.ts` — 中断处理
`mcp-workflow-service.ts` — 工作流 | `mcp-client-service.ts` — MCP 客户端
`mcp-auto-discovery.ts` — 工具自动发现 | `mcp-scheduler-repository.ts` — 调度存储
`mcp-server-repository.ts` — 服务器注册存储 | `mcp-server-sqlite.ts` — SQLite 后端
`mcp-registration-schema.ts` — 注册 zod 校验 | `mcp-write-schema.ts` — 写入 zod 校验
`mcp-gateway-repository.ts` — 网关桶文件 | `mcp-repository.ts` — MCP 通用存储
`built-in-mcp-tools.ts` — 内置工具定义

### lib/mcp-connectors/ — MCP 连接器 (10 文件)
`registry.ts` — 连接器注册表 | `types.ts` — 连接器类型定义
**[Phase 23 新增]** `real-mcp-connector-base.ts` — 工厂函数 `createRealMcpConnector()`，提取 4 个真实连接器共享逻辑（中断处理、服务器查找、错误分类）；导出 `isHttpTarget()` `resolveTarget()` `RealMcpConnectorSpec<T>` 接口
`real-web-surface-mcp-connector.ts` · `real-http-structure-mcp-connector.ts` · `real-http-validation-mcp-connector.ts` · `real-evidence-capture-mcp-connector.ts` — 4 个真实连接器（Phase 23 改用 base 工厂，消除重复样板）
`real-dns-intelligence-connector.ts` — DNS 智能连接器
`local-foundational-connectors.ts` — 本地基础连接器（已清除假数据）
`stdio-mcp-connector.ts` — stdio 连接器（含 ENOENT 检测，Phase 23 改用通用 TCP 横幅抓取替代端口硬编码探针）

### lib/project/ — 项目领域 (12 文件)
桶文件: `project-repository.ts` `project-results-repository.ts` `project-scheduler-control-repository.ts`
核心: `project-mutation-repository.ts` `project-read-repository.ts` `project-id.ts` `project-targets.ts` `project-write-schema.ts`
生命周期: `project-closure-status.ts` `project-scheduler-lifecycle.ts` `project-mcp-dispatch-service.ts`

### lib/data/ — 数据存储 (7 文件)
`approval-repository.ts` — 审批存储 | `asset-repository.ts`（含 `listStoredAssetsByTypes` — 按项目+类型数组查询资产）
`evidence-repository.ts` — 证据存储 | `work-log-repository.ts` — 工作日志
`runtime-artifacts.ts` — 运行时产物 | `approval-write-schema.ts` — 审批 zod 校验
`asset-view-selection.ts` — 资产视图选择

### 其他子目录（Phase 23 前已存在）
`lib/results/` (3 文件): project-results-core, project-conclusion-service, project-report-repository
`lib/gateway/` (2 文件): mcp-dispatch-service, mcp-run-repository
`lib/scheduler-control/` (3 文件): scheduler-control-core, scheduler-control-helpers, scheduler-task-commands
`lib/compositions/` (4 文件): dashboard, project, settings, control

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
| UI 标签 | AI规划 | 编排器计划生成步骤 |
| UI 标签 | 探测工具 | MCP 工具的面向用户称呼（设置页/空状态/通知） |
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
