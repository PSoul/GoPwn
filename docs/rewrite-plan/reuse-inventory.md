# 可复用组件清单

> 日期: 2026-04-04
> 目的: 明确哪些代码可以直接复用、哪些需要适配、哪些必须重写

---

## 一、完全可复用（直接拷贝，零改动）

### 1.1 UI 基础组件 — `components/ui/`

全部 shadcn/ui 组件，约 40+ 个文件，包括：
accordion, alert-dialog, avatar, badge, button, calendar, card, checkbox, collapsible, command, context-menu, dialog, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner (toast), switch, table, tabs, textarea, toggle, toggle-group, tooltip

### 1.2 主题和样式

| 文件 | 说明 |
|------|------|
| `app/globals.css` | Tailwind 全局样式 + CSS 变量 |
| `components/theme-provider.tsx` | next-themes 主题切换 |
| `components/theme-toggle.tsx` | 暗色/亮色切换按钮 |
| `tailwind.config.ts` | Tailwind 配置 |
| `postcss.config.mjs` | PostCSS 配置 |

### 1.3 通用布局组件

| 文件 | 说明 |
|------|------|
| `components/shared/page-header.tsx` | 页面标题+面包屑 |
| `components/shared/pagination.tsx` | 分页器 |
| `components/shared/section-card.tsx` | 分区卡片 |
| `components/shared/status-badge.tsx` | 状态徽章 |
| `components/layout/*` | 侧边栏布局（如果有） |

### 1.4 工具函数

| 文件 | 说明 |
|------|------|
| `lib/utils.ts` | `cn()` 样式合并函数 |

### 1.5 认证页面

| 文件 | 说明 |
|------|------|
| `app/login/page.tsx` | 登录页 UI |
| `components/auth/*` | 登录表单组件 |

### 1.6 资产文件

| 文件 | 说明 |
|------|------|
| `components/assets/*` | 图标、Logo 等静态资源 |
| `app/icon.svg` | 网站图标 |

---

## 二、可复用但需适配（UI 保留，数据层修改）

### 2.1 Dashboard 页面

| 文件 | 复用程度 | 需改动 |
|------|---------|--------|
| `app/(console)/dashboard/page.tsx` | 90% | API endpoint 和响应类型 |
| `components/dashboard/dashboard-asset-preview.tsx` | 90% | 字段名适配 |

**改动说明**: Dashboard 聚合数据的 API 响应格式会变（不再有中文状态字符串），组件内的状态判断需要用 enum 替代。

### 2.2 项目列表和表单

| 文件 | 复用程度 | 需改动 |
|------|---------|--------|
| `app/(console)/projects/page.tsx` | 95% | API 调用 |
| `app/(console)/projects/new/page.tsx` | 95% | 表单 schema 微调 |
| `components/projects/project-card.tsx` | 85% | 状态字符串 → enum 映射 |
| `components/projects/project-list-client.tsx` | 85% | 排序/过滤逻辑微调 |
| `components/projects/project-form.tsx` | 80% | 字段对应关系 |

### 2.3 项目详情页

| 文件 | 复用程度 | 需改动 |
|------|---------|--------|
| `app/(console)/projects/[projectId]/page.tsx` | 80% | 数据获取重构 |
| `components/projects/project-summary.tsx` | 85% | 字段名 |
| `components/projects/project-stats-bar.tsx` | 90% | 数据源 |
| `components/projects/project-workspace-nav.tsx` | 95% | 导航链接 |
| `components/projects/project-workspace-intro.tsx` | 95% | 纯 UI |

### 2.4 项目 Operations 面板

| 文件 | 复用程度 | 需改动 |
|------|---------|--------|
| `components/projects/project-operations-panel.tsx` | 70% | 大量状态判断逻辑需要重写 |
| `components/projects/project-orchestrator-panel.tsx` | 75% | LLM plan 数据结构 |
| `components/projects/project-scheduler-runtime-panel.tsx` | 65% | scheduler task 概念移除，改为 job 监控 |
| `components/projects/project-mcp-runs-panel.tsx` | 80% | McpRun 类型变更 |
| `components/projects/project-approval-bar.tsx` | 85% | 审批状态 enum 化 |

### 2.5 实时 Dashboard

| 文件 | 复用程度 | 需改动 |
|------|---------|--------|
| `components/projects/project-live-dashboard.tsx` | 70% | SSE 事件格式变更（Redis Pub/Sub 消息格式） |
| `app/api/projects/[projectId]/events/route.ts` | 60% | 改为 Redis subscriber |

### 2.6 LLM 日志面板

| 文件 | 复用程度 | 需改动 |
|------|---------|--------|
| `components/projects/project-llm-log-panel.tsx` | 80% | 类型适配 |
| `app/api/llm-logs/stream/route.ts` | 50% | 流式读取机制可能不同 |

### 2.7 漏洞和发现

| 文件 | 复用程度 | 需改动 |
|------|---------|--------|
| `components/projects/project-findings-table.tsx` | 85% | severity enum 映射 |
| `components/projects/project-vuln-tab.tsx` | 85% | 字段名适配 |
| `components/projects/finding-detail.tsx` | 80% | 详情数据结构 |
| `app/(console)/vuln-center/page.tsx` | 80% | 聚合查询 |

### 2.8 资产页面

| 文件 | 复用程度 | 需改动 |
|------|---------|--------|
| `app/(console)/assets/page.tsx` | 85% | Asset 类型微调 |
| `app/(console)/assets/[assetId]/page.tsx` | 80% | 详情数据结构（fingerprints 变为独立关系） |
| `components/projects/project-asset-tab.tsx` | 80% | 字段名 |

### 2.9 设置页面

| 文件 | 复用程度 | 需改动 |
|------|---------|--------|
| `app/(console)/settings/page.tsx` | 95% | 纯导航 |
| `components/settings/settings-hub-grid.tsx` | 95% | 纯 UI |
| `components/settings/settings-subnav.tsx` | 95% | 纯 UI |
| `components/settings/llm-settings-panel.tsx` | 85% | LlmProfile 字段微调 |
| `components/settings/mcp-gateway-client.tsx` | 75% | 注册流程可能简化 |
| `components/settings/mcp-tool-table.tsx` | 80% | McpTool 字段变更 |
| `components/settings/system-status-grid.tsx` | 70% | 新增 Redis/BullMQ 状态 |
| `components/settings/system-control-panel.tsx` | 70% | 控制面板适配新架构 |
| `components/settings/settings-log-table.tsx` | 85% | 日志格式微调 |

---

## 三、需要重写（保留概念但重新实现）

### 3.1 后端核心模块

| 当前文件/目录 | 新实现 | 原因 |
|-------------|--------|------|
| `lib/orchestration/orchestrator-service.ts` | `lib/workers/planning-worker.ts` + `lib/workers/lifecycle-worker.ts` | 同步循环 → 异步 job chain |
| `lib/orchestration/orchestrator-execution.ts` | `lib/workers/execution-worker.ts` | 同步 drain → BullMQ job |
| `lib/mcp/mcp-scheduler-service.ts` | 删除（BullMQ 替代） | 自建调度器完全移除 |
| `lib/mcp/mcp-scheduler-repository.ts` | 删除 | SchedulerTask 表删除 |
| `lib/mcp/mcp-execution-service.ts` | `lib/workers/execution-worker.ts` + `lib/mcp/connector.ts` | 执行+归一化逻辑解耦 |
| `lib/mcp/mcp-execution-runtime.ts` | 删除（BullMQ job cancel 替代） | 进程内 Map 移除 |
| `lib/gateway/mcp-dispatch-service.ts` | `lib/services/orchestrator-service.ts` | 审批+分发逻辑简化 |
| `lib/infra/prisma-transforms.ts` (870 行) | 删除（直接用 Prisma 类型） | 不再需要双向转换 |
| `lib/infra/project-event-bus.ts` | `lib/infra/event-bus.ts` (Redis) | 进程内 → Redis |
| `lib/scheduler-control/scheduler-control-core.ts` | `lib/services/project-service.ts` | 集成到项目服务 |
| `lib/results/project-results-core.ts` | `lib/services/project-service.ts` | 合入项目服务 |
| `lib/project/project-mutation-repository.ts` (17KB) | `lib/repositories/project-repo.ts` | 瘦身拆分 |
| `lib/prototype-types.ts` (re-export barrel) | `lib/types/index.ts` | 新类型定义 |
| `lib/types/*.ts` (10 个文件) | `lib/types/index.ts` | 合并精简 |

### 3.2 数据库 Schema

| 当前 | 新设计 |
|------|--------|
| `ProjectDetail` (13 JSON 列) | 拆分为 `ProjectPhase`, `Fingerprint`, 独立关系表 |
| `SchedulerTask` | 删除（BullMQ 替代） |
| 中文 status 字符串 | PostgreSQL enum |
| 无外键 String ID | Prisma `@relation` |

### 3.3 API 路由

所有 48 个 API route 文件需要重写（但大部分很简短，只是改 import 和类型）。

---

## 四、需要删除（不复用的废弃代码）

| 文件/目录 | 行数估计 | 原因 |
|----------|---------|------|
| `lib/infra/prisma-transforms.ts` | 870 | 双向转换层完全不需要 |
| `lib/mcp/mcp-scheduler-service.ts` | 520 | BullMQ 替代 |
| `lib/mcp/mcp-scheduler-repository.ts` | 350 | SchedulerTask 表删除 |
| `lib/mcp/mcp-execution-runtime.ts` | 50 | 进程内 Map 不需要 |
| `lib/scheduler-control/` (3 个文件) | 600 | 合入项目服务 |
| `lib/infra/local-lab-catalog.ts` | 460 | 靶场 catalog 重新设计或不保留 |
| `lib/prototype-record-utils.ts` | ~150 | 时间戳工具太散，合入 utils |
| `lib/infra/api-compositions.ts` | ~220 | 数据聚合改到 Service 层 |
| `lib/compositions/` | ~400 | 合入 Service 层 |

---

## 五、MCP 工具定义复用

### 5.1 完全复用

| 来源 | 说明 |
|------|------|
| MCP Server 注册合同 (`docs/contracts/mcp-server-contract.md`) | 注册协议不变 |
| 外部 MCP Server 仓库 (`llmpentest-mcp-template`) | 完全不受影响 |
| MCP 工具能力枚举 (capability, boundary, riskLevel, resultMappings) | 值不变 |
| `mcp-registration-schema.ts` 中的 Zod 校验 | 可直接复用 |

### 5.2 需要适配

| 文件 | 改动 |
|------|------|
| `lib/mcp/mcp-auto-discovery.ts` | 简化，核心发现逻辑保留，移除复杂的状态同步 |
| `lib/mcp/mcp-client-service.ts` | 保留 MCP SDK 调用逻辑 |
| `lib/mcp-connectors/stdio-mcp-connector.ts` | 简化为通用 stdio 连接器 |
| `lib/mcp/built-in-mcp-tools.ts` | 保留 seed-normalizer, capture-evidence, report-exporter 定义 |

---

## 六、LLM Prompt 复用

### 6.1 可直接复用

| 功能 | 所在文件 |
|------|---------|
| Orchestrator system prompt | `lib/llm/llm-brain-prompt.ts` — `ORCHESTRATOR_BRAIN_SYSTEM_PROMPT` |
| Reviewer system prompt | `lib/llm/llm-brain-prompt.ts` — `REVIEWER_BRAIN_SYSTEM_PROMPT` |
| Analyzer system prompt | `lib/llm/llm-brain-prompt.ts` — `ANALYZER_BRAIN_SYSTEM_PROMPT` |
| 工具分析 prompt 构建器 | `lib/llm/llm-brain-prompt.ts` — `buildToolAnalysisPrompt()` |
| 多轮规划 prompt 构建器 | `lib/orchestration/orchestrator-context-builder.ts` — `buildMultiRoundBrainPrompt()` |

### 6.2 需要适配

| 功能 | 改动 |
|------|------|
| `buildProjectBrainPrompt()` | 参数结构微调（匹配新的 project 字段） |
| `buildLocalLabBrainPrompt()` | 保留，微调参数 |
| JSON 解析逻辑 (`safeParsePlanContent`, `safeParseAnalysisContent`) | 直接复用 |

---

## 七、测试代码复用

### 7.1 E2E 测试

| 文件 | 复用程度 | 说明 |
|------|---------|------|
| Playwright E2E 测试 | 60% | UI 流程基本不变，但断言需要适配新的状态文本 |
| 测试辅助函数 | 30% | 数据构造需要重写 |

### 7.2 单元测试

| 类别 | 复用程度 | 说明 |
|------|---------|------|
| 连接器测试 | 50% | 连接器接口变了，但测试思路可复用 |
| 状态机测试 | 0% | 完全新写（XState 测试更简单） |
| Repository 测试 | 30% | Prisma 操作逻辑变了 |

---

## 八、配置文件复用

| 文件 | 复用 | 说明 |
|------|------|------|
| `package.json` | 90% | 新增 bullmq, ioredis, xstate；移除部分不需要的 |
| `tsconfig.json` | 100% | 不变 |
| `next.config.ts` | 100% | 不变 |
| `.eslintrc.json` | 100% | 不变 |
| `vitest.config.ts` | 100% | 不变 |
| `playwright.config.ts` | 100% | 不变 |
| `docker-compose.yml` | 50% | 新增 Redis + Worker 容器 |

---

## 九、复用程度总结

| 类别 | 文件数 | 行数估计 | 可复用率 |
|------|--------|---------|---------|
| UI 基础组件 (shadcn/ui) | ~40 | ~4000 | **100%** |
| 主题/样式/配置 | ~10 | ~500 | **100%** |
| 前端页面 (布局/路由) | 20 | ~3000 | **90%** |
| 前端业务组件 | 30 | ~5000 | **80%** |
| MCP 工具定义/合同 | 5 | ~300 | **100%** |
| LLM Prompt | 3 | ~800 | **85%** |
| 后端核心逻辑 | ~35 | ~8000 | **0%** (重写) |
| 数据库 Schema | 1 | ~530 | **20%** (重设计) |
| Prisma transforms | 1 | ~870 | **0%** (删除) |
| **总计** | ~145 | ~23000 | **~55%** |
