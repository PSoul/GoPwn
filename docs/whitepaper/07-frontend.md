# 07 — 前端界面与用户体验

> GoPwn 的前端基于 Next.js 15 App Router 构建，使用 React 19 + Tailwind CSS + shadcn/ui 组件库，提供 16 个控制台页面和 102 个 React 组件。

---

## 7.1 技术选型

| 技术 | 版本 | 职责 |
|------|------|------|
| Next.js | 15.2 (App Router) | 全栈框架，SSR + API Routes |
| React | 19 | UI 渲染 |
| Tailwind CSS | 3.4 | 原子化样式 |
| shadcn/ui | — | 基础组件库（基于 Radix UI） |
| Radix UI | — | 无障碍 UI 原语（58 个组件） |
| Recharts | 2.15 | 数据图表 |
| react-hook-form + zod | — | 表单管理与验证 |
| lucide-react | 0.454 | 图标库 |
| next-themes | — | 亮色/暗色主题切换 |
| sonner | — | Toast 通知 |

### 设计规范

- **圆角 Token**: hero / card / panel / item 四级语义圆角（tailwind.config.ts 配置）
- **深色模式**: 双主题支持（light/dark），所有组件适配
- **过渡动画**: CSS fade-in 页面切换动画（`app-shell.tsx` + `key={pathname}`）
- **字体**: 等宽体系，代码和数据展示友好

## 7.2 页面结构（16 个控制台页面）

### 7.2.1 全局页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/dashboard` | 仪表盘 | 关键指标、系统概览、资产预览、空平台引导 |
| `/assets` | 资产中心 | 跨项目资产总览 |
| `/vuln-center` | 漏洞中心 | 跨项目漏洞总览与筛选 |

### 7.2.2 项目工作区（5-Tab 布局）

项目详情页采用 5 个独立路由 Tab 组织：

| Tab | 路由 | 组件 | 说明 |
|-----|------|------|------|
| 概览 | `/projects/[id]` | ProjectOverview | 安全发现/资产发现统计卡片 + 最近活动 |
| 资产 | `/projects/[id]/assets` | AssetPageTabs | 3 子 Tab: 域名/主机与端口/Web与API |
| 漏洞 | `/projects/[id]/findings` | FindingsListTable | 按严重程度排序的漏洞列表 |
| 执行控制 | `/projects/[id]/operations` | ProjectOperationsPanel | 审批状态 + 调度开关 + ReAct 轮次 |
| AI 日志 | `/projects/[id]/ai-logs` | ProjectLlmLogPanel | LLM 调用记录 + 结构化展示 |

### 7.2.3 详情页

| 路由 | 页面 | 说明 |
|------|------|------|
| `/projects/[id]/assets/ip/[assetId]` | IP 详情 | 开放端口/关联漏洞/Web 应用 |
| `/projects/[id]/vuln/[findingId]` | 漏洞详情 | 原始输入输出、证据、修复建议 |

### 7.2.4 设置（8 个页面）

| 路由 | 页面 | 说明 |
|------|------|------|
| `/settings` | 设置中心 | Hub 入口 |
| `/settings/llm` | LLM 设置 | 三个 Profile 配置 |
| `/settings/mcp-tools` | 探测工具 | MCP 工具列表（Accordion 折叠） |
| `/settings/users` | 用户管理 | — |
| `/settings/approval-policy` | 审批策略 | — |
| `/settings/audit-logs` | 审计日志 | — |
| `/settings/work-logs` | 工作日志 | 流水线日志查询 |
| `/settings/system-status` | 系统状态 | DB/MCP/LLM 连接状态 |

## 7.3 组件架构（102 个组件）

### 布局组件（4 个）

| 组件 | 说明 |
|------|------|
| `app-shell.tsx` | SidebarProvider + 路由动画 |
| `app-header.tsx` | 面包屑 + 用户菜单 |
| `app-sidebar.tsx` | 三分组侧边导航 + 动态 badge |
| `ai-chat-widget.tsx` | SSE 实时 AI 日志悬浮窗 |

### 项目组件（20+）

核心组件包括：

| 组件 | 说明 |
|------|------|
| `project-list-client.tsx` | 项目列表表格（搜索 + 归档确认） |
| `project-form.tsx` | 创建表单（react-hook-form + zod 验证） |
| `project-overview.tsx` | 概览页（统计卡片 + 最近活动） |
| `project-workspace-nav.tsx` | 5-Tab 工作区导航 |
| `asset-page-tabs.tsx` | 资产页 3 子 Tab 容器 |
| `asset-hosts-table.tsx` | 主机与端口表（层级关系 + HTTP 检测） |
| `asset-web-table.tsx` | Web/API 折叠分组（按 host:port） |
| `findings-list-table.tsx` | 漏洞列表（按严重程度排序） |
| `ip-detail.tsx` | IP 详情页 |
| `finding-detail.tsx` | 漏洞详情页 |
| `project-orchestrator-panel.tsx` | ReAct 执行轮次面板 |
| `project-mcp-runs-panel.tsx` | MCP 运行记录面板（按 round→step 分组） |
| `project-llm-log-panel.tsx` | AI 日志面板（角色过滤 + Function Call 渲染） |
| `project-approval-bar.tsx` | 审批内联通知条 |
| `project-report-export-panel.tsx` | 报告导出面板 |

### shadcn/ui 基础库（58 个）

涵盖表单输入（Input, Select, Checkbox, Switch 等）、弹窗层（Dialog, AlertDialog, Popover, Tooltip 等）、布局容器（Card, Tabs, Accordion, ScrollArea 等）、文本显示（Badge, Separator 等）、导航（Sidebar, Breadcrumb 等）。

## 7.4 实时数据更新

### SSE 事件订阅

前端通过两个核心 Hook 实现实时更新：

#### useProjectEvents

```typescript
// 订阅 GET /api/projects/[id]/events SSE 端点
const { connected, lastEvent } = useProjectEvents(projectId)
```

监听所有项目级事件：lifecycle_changed, react_step_started/completed, round_reviewed 等。

#### useReactSteps

```typescript
// 基于 useProjectEvents，维护当前轮次的步骤列表
const { activeSteps, roundProgress, connected } = useReactSteps(projectId)
// activeSteps: ReactStepEvent[] — 当前活跃的步骤列表
// roundProgress: { round, currentStep, maxSteps, phase } — 轮次进度
```

### 前端实时展示

- **ReAct 步骤列表** — 每步显示 stepIndex、toolName、target、status、thought、rawOutput（可展开）、耗时
- **轮次进度条** — 显示 currentStep / maxSteps
- **正在执行的步骤** — 带 pulse 动画效果
- **MCP 运行记录** — 按 round → step 分组，可折叠展示

## 7.5 API 路由（36 个端点）

API 路由使用 `apiHandler` 统一封装，返回格式统一为 `{ key: data }` 包装格式。

### 核心端点分类

| 分类 | 端点数 | 示例 |
|------|--------|------|
| 认证 | 3 | login, logout, captcha |
| 项目管理 | 8 | CRUD, archive, context, flow |
| 执行控制 | 4 | scheduler-control, mcp-runs, mcp-workflow |
| ReAct 步骤 | 1 | rounds/[round]/steps |
| 结果数据 | 5 | domains, network, findings, report-export |
| 实时事件 | 1 | events (SSE) |
| AI 日志 | 3 | llm-logs, recent, stream |
| 审批 | 3 | approvals (GET/PUT/PATCH) |
| 设置 | 10+ | llm, mcp-tools, approval-policy, agent-config, system-status |
| 系统 | 3 | health, dashboard, vuln-center |

### Loading/Error 体系

- 每个路由组有专属 `loading.tsx` 骨架屏
- Settings 共享 `SettingsSubPageSkeleton`
- 控制台 + 项目工作区各有 `error.tsx` 错误边界
- 页面切换有 CSS fade-in 过渡动画

## 7.6 页面截图说明

### 项目列表页

表格布局展示所有项目，列包括：项目名称、状态、渗透阶段、当前轮次、操作按钮。支持搜索过滤和归档确认对话框。

### 项目概览页

顶部：项目摘要卡片（状态、启动/重启按钮）
中部：两个统计卡片 — 安全发现统计（按 severity 分组）、资产发现统计（按 kind 分组）
底部：最近活动列表

### 资产页

三个子 Tab 独立展示不同类型的资产：
- **域名** — 域名列表含 IP 解析链接
- **主机与端口** — 父子层级关系表，IP 详情跳转，HTTP 协议自动检测
- **Web 与 API** — 按 host:port 折叠分组，组内精简 3 列表格

### 执行控制页

- **ReAct 执行轮次面板** — 每轮显示 phase、步数、stopReason、新资产/发现数
- **MCP 运行记录面板** — 按 round→step 分组，可展开详情
- **审批通知条** — 琥珀色可折叠
- **调度控制** — 启动/停止/取消确认

### AI 日志页

结构化展示 LLM 调用记录：
- 按角色过滤（react / analyzer / reviewer）
- Function Call 结构化渲染
- 自动刷新
- 展开查看完整 prompt 和 response
