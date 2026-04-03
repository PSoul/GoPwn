# Phase 24 实施计划: 概念精简 + 实时仪表盘

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将用户概念从 11 个压缩到 4 个，新增 SSE 实时推送，重设计项目工作区为实时仪表盘。

**Spec:** `docs/superpowers/specs/2026-04-04-phase24-concept-simplification-realtime-dashboard-design.md`

**Tech Stack:** Next.js 15 + React 19 + TypeScript + Prisma 7 + PostgreSQL 16

**约束:** 不改动 LLM 编排核心逻辑（orchestrator-service 的规划/执行策略不变）。

---

## Phase 1: 数据模型调整 + Bug 修复

### Task 1: Finding 模型增强

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/types/mcp.ts` (ProjectFindingRecord)
- Modify: `lib/infra/prisma-transforms.ts` (toFindingRecord / fromFindingRecord)
- Test: `tests/lib/project-model.test.ts`

- [ ] **Step 1: 修改 Prisma schema**

在 Finding 模型中新增字段：
```prisma
createdAt          DateTime  @default(now())
rawInput           String?
rawOutput          String[]  @default([])
screenshotPath     String?
htmlArtifactPath   String?
capturedUrl        String?
remediationNote    String?
```

新增索引：
```prisma
@@index([projectId, severity])
@@index([status])
```

- [ ] **Step 2: 修改 ProjectFindingRecord 类型**

在 `lib/types/mcp.ts` 中对应增加字段。

- [ ] **Step 3: 修改 prisma-transforms**

更新 `toFindingRecord` 和 `fromFindingRecord` 双向转换函数。

- [ ] **Step 4: 运行 `npx prisma db push`**

- [ ] **Step 5: Commit**

```
feat: enhance Finding model with evidence fields (rawInput, rawOutput, screenshot, remediation)
```

---

### Task 2: Evidence 模型添加时间戳

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/infra/prisma-transforms.ts`

- [ ] **Step 1: 添加 createdAt/updatedAt 到 Evidence**

```prisma
createdAt   DateTime  @default(now())
updatedAt   DateTime  @updatedAt
```

- [ ] **Step 2: 更新 transforms**

- [ ] **Step 3: Commit**

---

### Task 3: Bug 修复 — 证据 ID 碰撞

**Files:**
- Modify: `lib/llm/llm-writeback-service.ts` (makeEvidenceId)

- [ ] **Step 1: 修改 makeEvidenceId**

使用完整 runId 的 hash（取前 16 字符）替代 slice(0, 12)。

- [ ] **Step 2: Commit**

---

### Task 4: Bug 修复 — 审批事务保护

**Files:**
- Modify: `lib/gateway/mcp-dispatch-service.ts`
- Modify: `lib/data/approval-repository.ts`

- [ ] **Step 1: 审批创建包裹在 prisma.$transaction 中**

在 `mcp-dispatch-service.ts` 中，创建审批 + 重排队列 + 更新项目计数 + 写入活动日志 + 创建审计日志，全部包裹在一个事务中。

- [ ] **Step 2: syncStoredMcpRunsAfterApprovalDecision 添加 try-catch 重试**

在 `approval-repository.ts` 中，事务外的同步操作添加错误处理和重试逻辑。

- [ ] **Step 3: Commit**

---

### Task 5: Bug 修复 — 缺失索引

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 添加缺失索引**

```prisma
// Asset
@@index([scopeStatus])

// Evidence
@@index([createdAt])

// Finding (已在 Task 1 添加)

// LlmCallLog
@@index([status])
```

- [ ] **Step 2: `npx prisma db push`**

- [ ] **Step 3: Commit**

---

### Task 6: 审批自动化 — 中风险自动执行

**Files:**
- Modify: `lib/gateway/mcp-dispatch-service.ts` (shouldRequireApproval)
- Modify: `prisma/schema.prisma` (GlobalApprovalControl)
- Modify: `lib/types/settings.ts` (如有)

- [ ] **Step 1: GlobalApprovalControl 新增 autoApproveMediumRisk 字段**

```prisma
autoApproveMediumRisk Boolean @default(true)
```

- [ ] **Step 2: 修改 shouldRequireApproval 逻辑**

```
riskLevel="低" && autoApproveLowRisk → 自动执行
riskLevel="中" && autoApproveMediumRisk → 自动执行
riskLevel="高" → 需要审批
```

- [ ] **Step 3: Commit**

---

## Phase 2: SSE 实时推送

### Task 7: 事件总线基础设施

**Files:**
- Create: `lib/infra/project-event-bus.ts`

- [ ] **Step 1: 实现 ProjectEventBus**

```typescript
// 进程内 EventEmitter，按 projectId 分发事件
// 支持事件类型: progress, asset_discovered, vuln_found, tool_started,
//   tool_completed, approval_needed, approval_resolved, round_completed, project_completed
// 所有发射操作 catch 吞掉异常，不影响主流程
```

- [ ] **Step 2: Commit**

---

### Task 8: SSE API 端点

**Files:**
- Create: `app/api/projects/[projectId]/events/route.ts`

- [ ] **Step 1: 实现 SSE Route Handler**

```typescript
// GET handler 返回 ReadableStream
// 订阅 ProjectEventBus 的 projectId 频道
// 每 15 秒发送 :keepalive
// 连接关闭时取消订阅
```

- [ ] **Step 2: Commit**

---

### Task 9: 在关键写入点添加事件发射

**Files:**
- Modify: `lib/data/asset-repository.ts` — emit `asset_discovered`
- Modify: `lib/project/project-results-repository.ts` — emit `vuln_found`
- Modify: `lib/mcp/mcp-scheduler-service.ts` — emit `tool_started`, `tool_completed`
- Modify: `lib/gateway/mcp-dispatch-service.ts` — emit `approval_needed`
- Modify: `lib/data/approval-repository.ts` — emit `approval_resolved`
- Modify: `lib/orchestration/orchestrator-service.ts` — emit `round_completed`, `project_completed`, `progress`

- [ ] **Step 1: 在 upsertStoredAssets 后发射 asset_discovered**
- [ ] **Step 2: 在 upsertStoredProjectFindings 后发射 vuln_found**
- [ ] **Step 3: 在 processStoredSchedulerTask 开始/完成时发射 tool_started/tool_completed**
- [ ] **Step 4: 在 dispatchStoredMcpRun 需审批时发射 approval_needed**
- [ ] **Step 5: 在 updateStoredApprovalDecision 后发射 approval_resolved**
- [ ] **Step 6: 在轮次结束/项目收尾时发射 round_completed/project_completed**
- [ ] **Step 7: 在项目阶段/状态变更时发射 progress**
- [ ] **Step 8: Commit**

---

### Task 10: 前端 SSE Hook

**Files:**
- Create: `lib/hooks/use-project-events.ts`

- [ ] **Step 1: 实现 useProjectEvents(projectId) Hook**

```typescript
// 基于 EventSource API
// 自动重连
// 返回最新的项目状态快照 { assets, vulns, highCount, currentRound, status, logs[] }
// 每种事件类型对应一个 reducer 更新状态
```

- [ ] **Step 2: Commit**

---

## Phase 3: LLM Writeback 调整

### Task 11: Finding 创建时填充证据字段

**Files:**
- Modify: `lib/llm/llm-writeback-service.ts` (convertAnalysisToArtifacts)

- [ ] **Step 1: 在创建 Finding 时填充新字段**

```typescript
rawInput: context.run.llmCode ?? context.run.requestedAction
rawOutput: rawResult.rawOutput
screenshotPath: relatedEvidence?.screenshotArtifactPath
htmlArtifactPath: relatedEvidence?.htmlArtifactPath
capturedUrl: relatedEvidence?.capturedUrl
remediationNote: llmFinding.recommendation ?? null
```

- [ ] **Step 2: 更新 LLM analyzer prompt，要求返回 recommendation 字段**

在 `lib/llm/llm-brain-prompt.ts` 的 analyzer prompt 中，调整返回格式要求。

- [ ] **Step 3: Commit**

---

## Phase 4: 前端重设计

### Task 12: 项目实时仪表盘

**Files:**
- Rewrite: `app/(console)/projects/[projectId]/page.tsx`
- Create: `components/projects/project-live-dashboard.tsx`
- Create: `components/projects/project-stats-bar.tsx`
- Create: `components/projects/project-vuln-tab.tsx`
- Create: `components/projects/project-asset-tab.tsx`
- Create: `components/projects/project-activity-log.tsx`

- [ ] **Step 1: 实现 ProjectStatBar — 四个实时指标卡片（资产数、漏洞数、高危数、执行中）**

使用 `useProjectEvents` Hook 驱动数字实时更新。新增数字时短暂高亮动画（CSS transition）。

- [ ] **Step 2: 实现 ProjectVulnTab — 漏洞列表**

基于现有 `project-findings-table.tsx` 简化，移除不必要的列（owner/updatedAt），突出标题、严重级别、影响面、发现时间。支持 SSE 实时追加新行。

- [ ] **Step 3: 实现 ProjectAssetTab — 资产列表**

复用现有 `asset-table.tsx` 的分视图逻辑，但作为项目内嵌 Tab。支持 SSE 实时追加。

- [ ] **Step 4: 实现 ProjectActivityLog — 执行日志时间线**

合并展示 MCP Run、Scheduler Task、Orchestrator Round、LLM Log。每条记录包含：时间戳、图标（工具/AI/轮次）、摘要文本。支持展开 LLM 思考详情。默认自动滚动到底部。

- [ ] **Step 5: 实现 ProjectLiveDashboard — 组合以上组件**

布局：审批通知条 → 项目头信息 → 指标卡片 → 三 Tab 区域（漏洞/资产/执行日志）。

- [ ] **Step 6: 重写项目首页 page.tsx 使用 ProjectLiveDashboard**

- [ ] **Step 7: Commit**

---

### Task 13: 审批内联组件

**Files:**
- Create: `components/projects/project-approval-bar.tsx`

- [ ] **Step 1: 实现 ProjectApprovalBar**

- 顶部通知条：显示待审批数量，可展开/收起
- 展开后列出所有待审批操作，每条含：风险等级、操作类型、目标、理由
- 操作按钮：批准、拒绝、延后
- "全部批准"快捷按钮
- 处理完毕自动收起
- 通过 SSE 的 `approval_needed`/`approval_resolved` 事件驱动

- [ ] **Step 2: Commit**

---

### Task 14: 漏洞详情页重设计

**Files:**
- Rewrite: `app/(console)/projects/[projectId]/vuln/[findingId]/page.tsx` (新路由)
- Create: `components/projects/finding-detail.tsx`

- [ ] **Step 1: 创建新路由 `/projects/[projectId]/vuln/[findingId]`**

- [ ] **Step 2: 实现 FindingDetail 组件**

展示：标题、严重级别 badge、发现时间、影响面、发现者（工具名+轮次）、摘要、截图（如有）、原始输入（代码块，如有）、原始输出（代码块）、修复建议（如有）。

- [ ] **Step 3: 在漏洞 Tab 中的行添加链接到此详情页**

- [ ] **Step 4: Commit**

---

### Task 15: 导航精简 + 路由清理

**Files:**
- Modify: `components/layout/app-sidebar.tsx`
- Delete: `app/(console)/evidence/page.tsx`
- Delete: `app/(console)/evidence/[evidenceId]/page.tsx`
- Delete: `app/(console)/approvals/page.tsx`
- Delete: `app/(console)/projects/[projectId]/ai-logs/page.tsx`
- Delete: `app/(console)/projects/[projectId]/results/` (整个目录)
- Modify: `app/(console)/vuln-center/page.tsx` — 去掉"证据归档"区块

- [ ] **Step 1: 修改侧边栏**

精简为：总览、项目、资产中心、漏洞中心、设置。删除审批中心和证据入口。

- [ ] **Step 2: 删除不再需要的页面文件**

注意：先 grep 确认没有其他页面链接到这些路由。如有链接需要同步更新。

- [ ] **Step 3: 清理 vuln-center 页面**

移除"执行证据归档"可折叠区块。

- [ ] **Step 4: 更新所有 `href="/approvals"` 和 `href="/evidence"` 的链接**

- [ ] **Step 5: Commit**

---

## Phase 5: 测试与验证

### Task 16: 单元测试更新

- [ ] **Step 1: 运行 `npx vitest run`，修复因模型变更导致的测试失败**
- [ ] **Step 2: 为 ProjectEventBus 添加单元测试**
- [ ] **Step 3: 为 SSE 端点添加 API 测试**
- [ ] **Step 4: Commit**

---

### Task 17: 端到端验证

- [ ] **Step 1: 启动 Docker 靶场 + Next.js 服务器**
- [ ] **Step 2: 创建 DVWA 项目并启动**
- [ ] **Step 3: 验证实时仪表盘**
  - 资产数实时增长
  - 漏洞发现时实时出现
  - 审批通知条正确弹出
  - 执行日志实时追加
- [ ] **Step 4: 验证漏洞详情页展示正确（含截图/原始输入输出）**
- [ ] **Step 5: 验证已删除页面返回 404**
- [ ] **Step 6: Commit**

---

### Task 18: 文档更新

- [ ] **Step 1: 更新 `code_index.md`**
- [ ] **Step 2: 更新 `roadmap.md`**
- [ ] **Step 3: 更新 `README.md`**
- [ ] **Step 4: Commit**

---

## 验证清单

| 检查项 | 验证方式 |
|--------|----------|
| Finding 模型含新字段 | `npx prisma studio` 查看 |
| Evidence 页面已删除 | 访问 `/evidence` 返回 404 |
| 审批页面已删除 | 访问 `/approvals` 返回 404 |
| SSE 端点工作 | `curl -N /api/projects/xxx/events` |
| 实时资产计数 | 启动项目后观察数字变化 |
| 实时漏洞计数 | 启动项目后观察数字变化 |
| 审批内联通知 | 高风险操作出现时通知条弹出 |
| 漏洞详情含证据 | 点击漏洞行查看截图/原始输出 |
| 执行日志合并 | Tab 中展示 MCP Run + AI + Round |
| 侧边栏精简 | 仅 5 个主入口 |
| 单元测试通过 | `npx vitest run` |
