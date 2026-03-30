# 代码索引 (Code Index)

> 本文件是项目代码的完整索引，帮助开发者和 LLM 快速了解每个文件的用途。
> 最后更新: 2026-03-30

## 项目概览

授权外网安全评估平台 — 一个基于 Next.js 15 + TypeScript 的漏洞扫描驾驶舱，集成 LLM 编排、MCP 工具执行、审批工作流和项目生命周期管理。

**技术栈**: Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Prisma 7.x (`@prisma/adapter-pg`) · Vitest · Playwright

**数据层架构**: PostgreSQL via Prisma 7.x (`@prisma/adapter-pg`) 为唯一数据层。所有 13 个仓库函数均为 async 并直接调用 Prisma ORM，文件系统 JSON 存储已移除。

---

## 1. 顶层配置

| 文件 | 用途 |
|------|------|
| `.env.example` | 环境变量配置模板（数据库、认证、LLM、初始管理员等） |
| `middleware.ts` | Next.js 中间件，处理身份验证、CSRF 双重提交 Cookie 防护、滑动窗口速率限制；E2E_TEST_MODE 下跳过 CSRF |
| `app/global-error.tsx` | 全局错误边界，捕获应用级 React 渲染错误 |
| `tailwind.config.ts` | Tailwind CSS 主题和样式配置 |
| `vitest.config.mts` | Vitest 单元测试配置 |
| `playwright.config.ts` | Playwright E2E 测试配置 |
| `prisma.config.ts` | Prisma ORM 配置 |
| `next.config.mjs` | Next.js 框架配置 |

## 2. App 目录 (页面与 API 路由)

### 页面路由

> 21 个 `app/(console)/**/page.tsx` 文件已改为 async Server Component 模式，await 数据获取。

| 路由 | 文件 | 用途 |
|------|------|------|
| `/login` | `app/login/page.tsx` | 用户登录页面 |
| `/dashboard` | `app/(console)/dashboard/page.tsx` | 主仪表盘，显示关键指标和概览 |
| `/projects` | `app/(console)/projects/page.tsx` | 项目列表（卡片网格布局） |
| `/projects/new` | `app/(console)/projects/new/page.tsx` | 新建项目表单 |
| `/projects/[id]` | `app/(console)/projects/[projectId]/page.tsx` | 项目详情概览 |
| `/projects/[id]/context` | `app/(console)/projects/[projectId]/context/page.tsx` | 项目上下文（证据与范围） |
| `/projects/[id]/results/domains` | `app/(console)/projects/[projectId]/results/domains/page.tsx` | 域名识别结果 |
| `/projects/[id]/results/network` | `app/(console)/projects/[projectId]/results/network/page.tsx` | 网络扫描结果 |
| `/projects/[id]/results/findings` | `app/(console)/projects/[projectId]/results/findings/page.tsx` | 安全发现列表 |
| `/projects/[id]/flow` | `app/(console)/projects/[projectId]/flow/page.tsx` | 项目阶段流程 |
| `/projects/[id]/operations` | `app/(console)/projects/[projectId]/operations/page.tsx` | 调度与操作面板 |
| `/projects/[id]/ai-logs` | `app/(console)/projects/[projectId]/ai-logs/page.tsx` | AI 执行日志查看 |
| `/vuln-center` | `app/(console)/vuln-center/page.tsx` | 漏洞中心（跨项目漏洞总览） |
| `/evidence` | `app/(console)/evidence/page.tsx` | 重定向到 /vuln-center |
| `/assets` | `app/(console)/assets/page.tsx` | 资产中心 |
| `/approvals` | `app/(console)/approvals/page.tsx` | 审批任务中心 |
| `/settings` | `app/(console)/settings/page.tsx` | 系统设置主页 |
| `/settings/llm` | `app/(console)/settings/llm/page.tsx` | LLM 提供商配置 |
| `/settings/mcp-tools` | `app/(console)/settings/mcp-tools/page.tsx` | MCP 工具管理 |
| `/settings/users` | `app/(console)/settings/users/page.tsx` | 用户管理（多角色 RBAC） |

### API 路由

> 48 个 `app/api/**/route.ts` 文件已添加 await 以适配 async 仓库调用。

| 端点 | 文件 | 用途 |
|------|------|------|
| `POST /api/auth/login` | `app/api/auth/login/route.ts` | 用户登录 |
| `POST /api/auth/logout` | `app/api/auth/logout/route.ts` | 用户登出 |
| `GET /api/dashboard` | `app/api/dashboard/route.ts` | 仪表盘数据聚合 |
| `GET/POST /api/projects` | `app/api/projects/route.ts` | 项目列表与创建 |
| `GET/PATCH /api/projects/[id]` | `app/api/projects/[projectId]/route.ts` | 项目详情与更新 |
| `PATCH /api/projects/[id]/scheduler-control` | `app/api/projects/[projectId]/scheduler-control/route.ts` | 调度器生命周期控制 |
| `POST /api/projects/[id]/orchestrator/plan` | `app/api/projects/[projectId]/orchestrator/plan/route.ts` | LLM 编排计划生成 |
| `POST /api/projects/[id]/orchestrator/local-validation` | `app/api/projects/[projectId]/orchestrator/local-validation/route.ts` | 本地靶场闭环验证 |
| `GET/PATCH /api/settings/agent-config` | `app/api/settings/agent-config/route.ts` | AI Agent 配置读取与部分更新 |
| `GET /api/projects/[id]/llm-logs` | `app/api/projects/[projectId]/llm-logs/route.ts` | 项目 LLM 调用日志列表 |
| `GET /api/projects/[id]/llm-logs/[logId]` | `app/api/projects/[projectId]/llm-logs/[logId]/route.ts` | 单条 LLM 调用详情 |
| `GET /api/llm-logs/recent` | `app/api/llm-logs/recent/route.ts` | 全局最近 LLM 日志 |
| `GET /api/llm-logs/stream` | `app/api/llm-logs/stream/route.ts` | SSE 实时日志流端点 |
| `GET /api/vuln-center/summary` | `app/api/vuln-center/summary/route.ts` | 漏洞中心统计汇总 |
| `GET /api/auth/captcha` | `app/api/auth/captcha/route.ts` | 验证码生成 |
| `GET/POST /api/users` | `app/api/users/route.ts` | 用户列表与创建（管理员） |
| `GET/PATCH /api/users/[id]` | `app/api/users/[userId]/route.ts` | 用户详情与更新（角色/状态/密码） |
| `GET /api/health` | `app/api/health/route.ts` | 健康检查端点 |

## 3. Components 目录 (UI 组件)

### 布局组件

| 文件 | 用途 |
|------|------|
| `components/layout/app-shell.tsx` | 应用外壳（侧边栏 + 顶栏 + AI 悬浮窗） |
| `components/layout/app-header.tsx` | 顶部导航栏 |
| `components/layout/app-sidebar.tsx` | 侧边栏导航（总览/发现/系统分组） |
| `components/layout/ai-chat-widget.tsx` | 全局 AI 思考日志悬浮窗（SSE 实时推送 + 项目筛选 + URL 感知 + 轮询降级） |

### 项目组件

| 文件 | 用途 |
|------|------|
| `components/projects/project-card.tsx` | 项目卡片（状态色带 + 指标标签） |
| `components/projects/project-list-client.tsx` | 项目列表（搜索/筛选/卡片网格/归档） |
| `components/projects/project-workspace-nav.tsx` | 项目工作区标签导航（8 个标签） |
| `components/projects/project-llm-log-panel.tsx` | AI 日志面板（SSE 实时推送 + 角色筛选/展开详情） |
| `components/projects/project-orchestrator-panel.tsx` | LLM 编排与本地闭环面板 |
| `components/projects/project-scheduler-runtime-panel.tsx` | 调度器运行时控制面板 |
| `components/projects/project-mcp-runs-panel.tsx` | MCP 执行运行管理面板 |
| `components/projects/project-summary.tsx` | 项目概览摘要 |
| `components/projects/project-findings-table.tsx` | 漏洞发现表格 |
| `components/projects/project-form.tsx` | 项目创建/编辑表单 |
| `components/projects/project-report-export-panel.tsx` | 报告导出面板 |

### 共享组件

| 文件 | 用途 |
|------|------|
| `components/shared/page-header.tsx` | 页面标题头部 |
| `components/shared/section-card.tsx` | 内容分组卡片 |
| `components/shared/status-badge.tsx` | 状态徽章（danger/warning/success/info/neutral） |
| `components/shared/pagination.tsx` | 分页控制 |
| `components/ui/stub-badge.tsx` | 本地模拟/已接入指示器 |

## 4. Lib 目录 (业务逻辑与服务)

### 数据存储与类型

| 文件 | 用途 |
|------|------|
| `lib/prisma.ts` | PrismaClient 单例（使用 `@prisma/adapter-pg` PrismaPg 适配器，globalThis 缓存防热重载泄漏） |
| `lib/prisma-transforms.ts` | Prisma DB 模型 ↔ TypeScript 接口双向转换（20+ 模型类型：Project/Finding/Evidence/McpRun/Approval 等） |
| `lib/prototype-store.ts` | 遗留文件系统数据存储（仅保留类型定义和 `getDefaultProjectFormPreset`，运行时不再使用文件 I/O） |
| `lib/prototype-types.ts` | 全部 TypeScript 类型定义（含 UserRecord/UserRole/UserStatus） |
| `lib/prototype-api.ts` | 页面级数据聚合 API（~20 函数已改为 async，await 所有仓库调用） |
| `lib/prototype-data.ts` | 初始化种子数据 |

### 身份认证与安全

| 文件 | 用途 |
|------|------|
| `lib/auth-session.ts` | HMAC 签名会话 Cookie 管理和验证 |
| `lib/auth-repository.ts` | 多用户认证仓库（用户 CRUD + bcrypt 密码验证 + 角色管理 + 验证码 + 审计日志 + 环境变量管理员自动种子） |
| `lib/csrf.ts` | CSRF 双重提交 Cookie 防护（ensureCsrfCookie / verifyCsrfToken） |
| `lib/rate-limit.ts` | 滑动窗口速率限制（登录5次/分钟 + API 60次/分钟） |
| `lib/api-client.ts` | 前端 fetch 封装（自动附带 CSRF header） |

### LLM 集成

| 文件 | 用途 |
|------|------|
| `lib/llm-provider/openai-compatible-provider.ts` | OpenAI 兼容 LLM 提供商（支持流式输出 + 日志记录） |
| `lib/llm-provider/types.ts` | LLM 提供商接口定义 |
| `lib/llm-provider/registry.ts` | LLM 提供商注册表 |
| `lib/llm-call-logger.ts` | LLM 调用日志服务（创建/追加/完成/失败 + EventEmitter SSE 广播） |
| `lib/llm-brain-prompt.ts` | LLM 系统提示和编排提示模板 |

### AI Agent 核心

| 文件 | 用途 |
|------|------|
| `lib/agent-config.ts` | AI Agent 配置系统（30+ 参数，5 大分类：model/context/execution/safety/behavior），参考 Claude Code/Codex/Aider 设计 |
| `lib/env-detector.ts` | 平台环境检测（OS/Shell/Node/可用系统工具），为 LLM 大脑提供运行时感知 |
| `lib/tool-output-summarizer.ts` | 工具输出结构化压缩（15+ 工具专用提取器），按 token 预算压缩 |
| `lib/failure-analyzer.ts` | 工具失败智能分析（9 类错误分类 + 重试建议 + 替代工具推荐） |

### MCP 编排

| 文件 | 用途 |
|------|------|
| `lib/orchestrator-service.ts` | 编排器主服务（规划 → 并行执行 → 反思 → 回顾循环） |
| `lib/orchestrator-context-builder.ts` | 编排器上下文构建（资产快照 + token 预算压缩 + 失败分析 + 输出摘要） |
| `lib/mcp-execution-service.ts` | MCP 工具执行引擎 |
| `lib/mcp-scheduler-service.ts` | MCP 任务调度 |
| `lib/mcp-workflow-service.ts` | MCP 工作流编排 |

### 数据访问层（Prisma ORM）

> 所有 13 个 `*-repository.ts` 文件均为 async 函数，直接调用 Prisma ORM 操作 PostgreSQL。文件存储双路径已移除。

| 文件 | 用途 |
|------|------|
| `lib/project-repository.ts` | 项目 CRUD（Prisma） |
| `lib/project-results-repository.ts` | 项目结果：发现/结论/报告（Prisma） |
| `lib/approval-repository.ts` | 审批数据访问（Prisma） |
| `lib/asset-repository.ts` | 资产数据访问（Prisma） |
| `lib/evidence-repository.ts` | 证据数据访问（Prisma） |
| `lib/auth-repository.ts` | 多用户认证仓库（Prisma） |
| `lib/llm-call-logger.ts` | LLM 调用日志（Prisma） |
| `lib/mcp-scheduler-service.ts` | MCP 任务调度（async 传播） |
| `lib/orchestrator-service.ts` | 编排器主服务（async 传播） |
| `lib/navigation.ts` | 侧边栏导航定义（总览/发现/系统） |

### MCP 连接器

| 文件 | 用途 |
|------|------|
| `lib/mcp-connectors/registry.ts` | 连接器注册表 |
| `lib/mcp-connectors/local-foundational-connectors.ts` | 本地基础连接器 |
| `lib/mcp-connectors/stdio-mcp-connector.ts` | 标准 I/O MCP 连接器 |
| `lib/mcp-connectors/real-evidence-capture-mcp-connector.ts` | 证据采集连接器 |
| `lib/mcp-connectors/real-http-structure-mcp-connector.ts` | HTTP 结构扫描连接器 |
| `lib/mcp-connectors/real-http-validation-mcp-connector.ts` | HTTP 验证连接器 |
| `lib/mcp-connectors/real-web-surface-mcp-connector.ts` | 网络表面扫描连接器 |
| `lib/mcp-connectors/real-dns-intelligence-connector.ts` | DNS 情报收集连接器 |

## 5. Tests 目录

### API 测试
- `tests/api/vuln-center-api.test.ts` — 漏洞中心 API 测试
- `tests/api/llm-logs-api.test.ts` — LLM 日志 API 测试（7 个用例）
- `tests/api/orchestrator-api.test.ts` — 编排器 API 测试
- `tests/api/scheduler-controls-api.test.ts` — 调度器控制 API 测试
- `tests/api/users-api.test.ts` — 用户管理 API 测试（6 个用例：CRUD + 角色权限 + 禁用登录）

### 单元测试
- `tests/lib/llm-call-logger.test.ts` — LLM 调用日志服务测试（7 个用例）
- `tests/lib/rate-limit.test.ts` — 速率限制测试
- `tests/lib/prototype-store.test.ts` — 数据存储测试

### 集成测试
- `tests/integration/docker-lab-mcp.test.ts` — Docker 靶场 MCP 集成测试（需 ENABLE_DOCKER_LAB_TESTS=1 + Docker 靶场运行），13 个用例
- `tests/integration/script-mcp-server.test.ts` — Script MCP Server 集成测试（LLM 自主脚本能力验证），7 个用例：基础执行、Redis/SSH/MySQL/Elasticsearch TCP 探测、Shell 命令、文件 I/O

### E2E 测试
- `e2e/prototype-smoke.spec.ts` — 基础功能烟雾测试
- `e2e/vuln-cockpit.spec.ts` — 漏洞驾驶舱 E2E 测试

### 验证脚本
- `scripts/e2e-docker-validation.ts` — Docker 靶场端到端编排验证（创建项目 → 编排 → 执行 → 报告）

## 6. Prisma 数据库

`prisma/schema.prisma` — 25+ 模型（已修复 User.role 默认值，新增 OrchestratorRound.reflection 字段）：
- **LlmCallLog** — LLM 调用日志（prompt/response/状态/耗时/token 用量）
- **Project** — 项目主记录
- **Finding** — 漏洞发现（支持跨项目聚合）
- **Evidence** — 执行证据
- **McpRun** — MCP 工具执行记录
- **OrchestratorRound** — 编排轮次记录（含 reflection 字段）
- **SchedulerTask** — 调度任务
- **Approval** — 审批记录
- **User** — 用户（role 默认值已修正）

`prisma/seed.ts` — 数据迁移脚本，从 JSON 文件存储迁移至 PostgreSQL（一次性使用）

## 7. MCP 服务器 (mcps/ 目录)

独立的 MCP 工具服务器，每个有自己的 package.json：
- `mcps/afrog-mcp-server/` — Afrog 漏洞扫描
- `mcps/curl-mcp-server/` — HTTP 请求工具
- `mcps/dirsearch-mcp-server/` — 目录爆破
- `mcps/httpx-mcp-server/` — HTTP 探测
- `mcps/subfinder-mcp-server/` — 子域名发现
- `mcps/fofa-mcp-server/` — FOFA 资产搜索
- `mcps/fscan-mcp-server/` — 内网扫描
- `mcps/netcat-mcp-server/` — TCP/UDP 连接工具
- `mcps/whois-mcp-server/` — WHOIS/ICP 查询
- `mcps/wafw00f-mcp-server/` — WAF 检测
- `mcps/encode-mcp-server/` — 编解码与哈希计算
- `mcps/github-recon-mcp-server/` — GitHub 代码/仓库搜索
- `mcps/script-mcp-server/` — **LLM 自主脚本执行**（核心能力）：execute_code（Node.js 代码执行）、execute_command（Shell 命令）、read_file / write_file（文件 I/O）

## 8. Docker 基础设施

### PostgreSQL 开发数据库

`docker/postgres/compose.yaml` — PostgreSQL 16-alpine 容器，平台唯一数据层

### Docker 靶场 (docker/local-labs/)

`docker/local-labs/compose.yaml` — 12 个靶场服务：

| 靶场 | 端口 | 协议 | 漏洞类型 |
|------|------|------|----------|
| Juice Shop | 3000 | HTTP | Web/API 漏洞 |
| WebGoat | 18080 | HTTP | 教学型漏洞 |
| DVWA | 8081 | HTTP | SQL注入/XSS/命令注入 |
| WordPress | 8082 | HTTP | CMS 默认配置 |
| phpMyAdmin | 8083 | HTTP | 管理面板暴露 |
| Tomcat (弱口令) | 8888 | HTTP | tomcat/tomcat 默认密码 |
| Elasticsearch (无认证) | 9200 | HTTP | 集群信息泄露 |
| MySQL (弱口令) | 13307 | TCP | root/123456 |
| Redis (无认证) | 6379 | TCP | 未授权访问 |
| SSH (弱口令) | 2222 | TCP | root/root |
| MongoDB (无认证) | 27017 | TCP | 未授权访问 |

`lib/local-lab-catalog.ts` — 靶场目录与探测（HTTP + TCP 双协议支持）
