# 代码索引 (Code Index)

> 本文件是项目代码的完整索引，帮助开发者和 LLM 快速了解每个文件的用途。
> 最后更新: 2026-03-31 | 项目版本: v0.4.2 (Phase 21 Debug)

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

### 2.1 控制台页面 (21 页)

所有 `app/(console)/**/page.tsx` 均为 async Server Component。

**仪表盘**: `/dashboard` — 关键指标、系统概览、资产预览、空平台引导

**项目管理 (8 页)**:
- `/projects` — 项目列表（卡片网格、搜索、归档确认）
- `/projects/new` — 新建项目（react-hook-form + zod 字段级验证）
- `/projects/[id]` — 项目概览 | `/projects/[id]/edit` — 编辑
- `/projects/[id]/context` — 上下文 | `/projects/[id]/flow` — 阶段流程
- `/projects/[id]/operations` — 调度面板（折叠式高级面板 + 确认对话框）
- `/projects/[id]/ai-logs` — AI 日志（SSE 实时流）

**结果 (3 页)** — 各自独立空状态:
- `/projects/[id]/results/domains` — 域名（Globe 图标）
- `/projects/[id]/results/network` — 端口/服务（Network 图标）
- `/projects/[id]/results/findings` — 漏洞（ShieldAlert 图标）

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

## 3. Components (116 文件)

### 布局 (4)
`layout/app-shell.tsx` — SidebarProvider + 路由动画 | `app-header.tsx` — 面包屑 + 用户菜单
`app-sidebar.tsx` — 三分组导航 + 动态 badge | `ai-chat-widget.tsx` — SSE 实时 AI 日志

### 项目 (16)
`project-list-client.tsx` — 卡片网格 + 归档确认 AlertDialog
`project-form.tsx` — react-hook-form + zod 字段级验证
`project-workspace-nav.tsx` — 8 标签页导航
`project-scheduler-runtime-panel.tsx` — 调度控制 + 停止/取消确认
`project-orchestrator-panel.tsx` — LLM 编排 | `project-mcp-runs-panel.tsx` — MCP 记录
`project-findings-table.tsx` — 漏洞表格 + 空状态 | `project-inventory-table.tsx` — 资产清单
`operations-collapsible-section.tsx` — 可折叠面板容器
其他: summary, workspace-intro, card, knowledge-tabs, stage-flow, task-board, report-export-panel, llm-log-panel

### 审批 (3): `approval-center-client.tsx` `approval-list.tsx` `approval-detail-sheet.tsx`（含确认对话框）
### 资产/证据/仪表盘 (7): asset-center-client, asset-table, asset-profile-panel, asset-relations, evidence-table, evidence-detail, dashboard-asset-preview
### 设置 (9): settings-hub-grid, settings-subnav, settings-sub-page-skeleton, llm-settings-panel, mcp-gateway-client(Accordion), mcp-tool-table, system-control-panel, system-status-grid, settings-log-table
### 共享 (5): page-header, section-card, status-badge, stat-card, pagination
### shadcn/ui 基础库 (61): 表单输入、弹窗层、布局容器、文本显示、导航、工具类

---

## 4. Lib 目录：业务逻辑

### 数据层
`prisma.ts` — PrismaClient 单例 | `prisma-transforms.ts` — DB ↔ TypeScript 转换（20+ 模型）

### 类型 (lib/types/, 10 文件)
`project.ts` `approval.ts` `mcp.ts` `scheduler.ts` `asset.ts` `evidence.ts` `settings.ts` `llm-log.ts` `user.ts` `payloads.ts`
桶文件: `prototype-types.ts`

### 认证安全 (5): `auth-session.ts` `auth-repository.ts` `csrf.ts` `rate-limit.ts` `api-client.ts`

### LLM 集成 (7)
`llm-provider/openai-compatible-provider.ts` `types.ts` `registry.ts`
`llm-call-logger.ts` `llm-brain-prompt.ts` `llm-settings-repository.ts` `llm-settings-write-schema.ts`

### AI Agent (4): `agent-config.ts` `env-detector.ts` `tool-output-summarizer.ts` `failure-analyzer.ts`

### 编排器 (6 文件)
`orchestrator-service.ts` — 主入口 | `orchestrator-target-scope.ts` — 目标分类
`orchestrator-plan-builder.ts` — 计划生成 | `orchestrator-execution.ts` — 多轮执行
`orchestrator-local-lab.ts` — 靶场验证 | `orchestrator-context-builder.ts` — 上下文构建

### Repository 层
桶文件: `project-repository.ts` `project-results-repository.ts` `mcp-gateway-repository.ts` `project-scheduler-control-repository.ts`
子模块: `lib/project/` (2) · `lib/results/` (3) · `lib/gateway/` (2) · `lib/scheduler-control/` (3)
其他: `approval-repository.ts` `asset-repository.ts` `evidence-repository.ts` `work-log-repository.ts`

### 组合层 (lib/compositions/, 4): dashboard, project, settings, control
### MCP 调度 (4): scheduler-service, execution-service, workflow-service, scheduler-repository
### MCP 连接器 (9): registry, types + 7 连接器

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

## 8. 架构演进

- **Phase 19** (2026-03-30): 类型拆分 + 门面消除 + 编排器分解
- **Phase 20** (2026-03-31): 5 个大文件拆为 14 个子模块
- **Phase 21** (2026-03-31): UI/UX 全站审查修复（loading/确认对话框/过渡动画/折叠面板/字段验证/圆角统一/空状态差异化）
- **Phase 21 Debug** (2026-03-31): 6 个真实使用 bug 修复（LLM 上下文窗口设置/模型未配置警告/阻塞原因显示/用户名显示/subfinder 对象提取）
