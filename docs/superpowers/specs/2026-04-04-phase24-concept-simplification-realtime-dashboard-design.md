# Phase 24: 概念精简 + 实时仪表盘设计

> **目标**: 将用户面对的概念从 11 个压缩到 4 个（项目、资产、漏洞、审批内联），新增 SSE 实时推送，重设计项目工作区为实时仪表盘，使平台从"开发者调试工具"进化为"安全团队可用的资产探测+漏洞扫描平台"。
>
> **定位**: 内部安全团队工具，用户量 < 10 人，聚焦功能完整性和流程正确性。
>
> **约束**: 后端 LLM 编排流程已验证可用（Redis/DVWA 端到端闭环），不做大改。重点在前端呈现和数据模型适度调整。

---

## 1. 核心设计原则

### 1.1 概念减法

用户只需理解 4 个概念：

| 概念 | UI 名称 | 说明 |
|------|---------|------|
| Project | 项目 | 一次渗透测试任务的容器 |
| Asset | 资产 | 发现的目标实体（域名、IP、端口、服务、Web 入口） |
| Finding (Vulnerability) | 漏洞 | 发现的安全问题，附带证据（截图、原始输入输出） |
| Approval (inline) | 审批 | 高风险操作的人工确认，内联在项目仪表盘中 |

### 1.2 隐藏实现细节

| 原概念 | 处理方式 |
|--------|---------|
| Evidence | 降级为漏洞的附属证据字段，不再独立展示 |
| MCP Run | 合并到项目"执行日志"折叠区域 |
| Scheduler Task | 合并到"执行日志" |
| Orchestrator Round | 合并到"执行日志"，以"第 N 轮"标注 |
| Work Log / Audit Log | 移到 设置 → 系统日志 |
| LLM Log | 在执行日志内以"AI 思考"标签展示 |

### 1.3 实时反馈

用户启动项目后，应该**立即**感受到系统在工作：
- 资产数和漏洞数实时跳动
- 执行日志实时追加
- 审批需求实时弹出通知条
- 轮次完成时更新进度指示

---

## 2. 数据模型调整

### 2.1 Finding 模型增强

在现有 Finding 模型基础上新增字段：

```prisma
model Finding {
  // --- 现有字段保留 ---
  id              String   @id
  projectId       String
  project         Project  @relation(...)
  severity        String   // 高危 | 中危 | 低危 | 信息
  status          String   @default("待验证")
  title           String
  summary         String   @default("")
  affectedSurface String   @default("")
  evidenceId      String   @default("")
  owner           String   @default("")
  updatedAt       DateTime @updatedAt

  // --- 新增字段 ---
  createdAt          DateTime  @default(now())       // 发现时间
  rawInput           String?                          // 原始输入（请求/命令）
  rawOutput          String[]  @default([])           // 原始输出（响应/工具输出）
  screenshotPath     String?                          // 截图工件路径
  htmlArtifactPath   String?                          // HTML 快照路径
  capturedUrl        String?                          // 截图对应的 URL
  remediationNote    String?                          // 修复建议（LLM 生成）

  // --- 索引增强 ---
  @@index([projectId, severity])
  @@index([status])
}
```

**字段来源映射**：

| 新字段 | 数据来源 |
|--------|---------|
| rawInput | LLM writeback 分析时提取，或 MCP run 的 requestedAction |
| rawOutput | 从关联 Evidence.rawOutput 复制，或 LLM writeback 直接填充 |
| screenshotPath | 从关联 Evidence.screenshotArtifactPath 复制 |
| htmlArtifactPath | 从关联 Evidence.htmlArtifactPath 复制 |
| capturedUrl | 从关联 Evidence.capturedUrl 复制 |
| remediationNote | LLM analyzer 生成的修复建议 |

### 2.2 Evidence 模型处理

**保留 Evidence 表**，但：
- 删除所有用户面向的 Evidence 路由（`/evidence`、`/evidence/[id]`）
- 删除侧边栏中的 Evidence 入口
- Evidence 继续在后端作为 MCP 工具执行的原始记录创建
- Finding 创建时，从关联 Evidence 中提取关键字段（rawOutput、screenshot 等）到 Finding 自身
- Evidence 成为纯粹的内部审计/调试数据

**添加缺失的时间戳**：

```prisma
model Evidence {
  // 新增
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

### 2.3 Bug 修复（一并纳入）

| Bug | 修复方案 |
|-----|---------|
| Evidence ↔ Finding 无外键 | Finding.evidenceId 添加 `@relation` 或改为 `evidence Evidence? @relation(...)` |
| 证据 ID 碰撞 | `makeEvidenceId()` 使用完整 runId hash（MD5 前 12 位） |
| 审批批量重排无事务 | `mcp-dispatch-service.ts` 审批创建包裹在 `prisma.$transaction` 中 |
| 审批决策后同步在事务外 | `syncStoredMcpRunsAfterApprovalDecision` 纳入事务或添加重试 |
| 缺失索引 | 添加 `Finding(projectId, severity)`、`Finding(status)`、`Evidence(createdAt)` 等 |
| prisma-transforms any 类型 | 逐步替换为 Prisma 生成的 payload 类型 |

### 2.4 审批自动化增强

修改 `shouldRequireApproval` 逻辑：

```
低风险 → 自动执行（不创建审批记录）
中风险 → 自动执行（记录日志但不阻塞）
高风险 → 创建审批，阻塞等待人工处理
```

当前逻辑已支持 `autoApproveLowRisk`，需要扩展为 `autoApproveMediumRisk`（默认 true）。

---

## 3. 实时推送（SSE）

### 3.1 API 端点

```
GET /api/projects/[projectId]/events
Headers: Accept: text/event-stream
Response: SSE stream
```

### 3.2 事件类型

| 事件名 | 触发时机 | 载荷示例 |
|--------|---------|---------|
| `progress` | 项目阶段/状态变化 | `{ stage, status, currentRound, maxRounds }` |
| `asset_discovered` | 新资产写入 DB | `{ totalAssets, latest: { label, type } }` |
| `vuln_found` | 新漏洞写入 DB | `{ totalVulns, highCount, latest: { title, severity } }` |
| `tool_started` | MCP 工具开始执行 | `{ toolName, target, capability }` |
| `tool_completed` | MCP 工具执行完成 | `{ toolName, target, status, summaryLine }` |
| `approval_needed` | 高风险操作待审批 | `{ approvalId, actionType, riskLevel, target, rationale }` |
| `approval_resolved` | 审批已处理 | `{ approvalId, decision }` |
| `round_completed` | 编排轮次结束 | `{ round, newAssets, newVulns, failedCount }` |
| `project_completed` | 项目收尾完成 | `{ totalAssets, totalVulns, summary }` |

### 3.3 实现方案

**后端**：
- 使用 Next.js Route Handler 的 `ReadableStream` 实现 SSE
- 项目级事件总线：在关键写入点（`upsertStoredAssets`、`upsertStoredProjectFindings`、调度器状态变更）发出事件
- 事件总线实现：进程内 `EventEmitter`（单实例部署足够，< 10 用户）
- 心跳：每 15 秒发送 `:keepalive` 注释防止连接超时

**前端**：
- `useProjectEvents(projectId)` 自定义 Hook
- 基于 `EventSource` API
- 自动重连（`EventSource` 内置）
- 事件分发到对应的状态更新函数

### 3.4 事件发射点

在以下函数中添加事件发射调用：

| 函数 | 文件 | 发射事件 |
|------|------|---------|
| `upsertStoredAssets` | `lib/data/asset-repository.ts` | `asset_discovered` |
| `upsertStoredProjectFindings` | `lib/project/project-results-repository.ts` | `vuln_found` |
| `processStoredSchedulerTask` (开始) | `lib/mcp/mcp-scheduler-service.ts` | `tool_started` |
| `processStoredSchedulerTask` (完成) | `lib/mcp/mcp-scheduler-service.ts` | `tool_completed` |
| `dispatchStoredMcpRun` (需审批) | `lib/gateway/mcp-dispatch-service.ts` | `approval_needed` |
| `updateStoredApprovalDecision` | `lib/data/approval-repository.ts` | `approval_resolved` |
| 轮次结束记录 | `lib/orchestration/orchestrator-service.ts` | `round_completed` |
| `settleProjectLifecycleClosure` | `lib/orchestration/orchestrator-service.ts` | `project_completed` |
| 阶段/状态变更 | `lib/project/project-mutation-repository.ts` | `progress` |

---

## 4. 项目工作区重设计

### 4.1 项目首页（实时仪表盘）

```
┌─────────────────────────────────────────────────────────┐
│ [审批通知条] ⚠️ 有 2 个高风险操作待审批  [展开处理]       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 项目名称                                                │
│ 目标: http://target.com    状态: 🟢 运行中 · 第 2/5 轮  │
│                                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ 资产  12  │ │ 漏洞   3 │ │ 高危   1 │ │ 执行中  2│    │
│ │ +2 ↑     │ │ +1 ↑     │ │          │ │          │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│         ↑ 数字实时更新，新增时短暂高亮动画               │
│                                                         │
│ ┌─[漏洞]──┬─[资产]──┬─[执行日志]──┐                     │
│ │                                  │                    │
│ │  漏洞列表（默认展示）              │                    │
│ │  实时追加新发现的漏洞              │                    │
│ │                                  │                    │
│ │  🔴 Redis 未授权访问    高危      │                    │
│ │     tcp://192.168.1.100:6379     │                    │
│ │     发现于 14:32                  │                    │
│ │                                  │                    │
│ │  🟡 Apache 版本泄露    中危      │                    │
│ │     http://target.com            │                    │
│ │     发现于 14:28                  │                    │
│ │                                  │                    │
│ └──────────────────────────────────┘                    │
│                                                         │
│ [导出报告]                           [停止] [暂停]      │
└─────────────────────────────────────────────────────────┘
```

### 4.2 审批内联处理

审批通知条展开后：

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ 待审批操作                                    [收起] │
│                                                         │
│ ┌─────────────────────────────────────────────────┐     │
│ │ 🔴 高风险 · execute_code                        │     │
│ │ 目标: tcp://192.168.1.100:6379                  │     │
│ │ 操作: 对 Redis 进行未授权访问测试                  │     │
│ │ 理由: TCP 服务必须经过未授权访问测试才能收尾        │     │
│ │                                                 │     │
│ │ [批准 ✓]  [拒绝 ✗]  [延后 ⏸]                   │     │
│ └─────────────────────────────────────────────────┘     │
│                                                         │
│ ┌─────────────────────────────────────────────────┐     │
│ │ 🔴 高风险 · execute_code                        │     │
│ │ 目标: tcp://192.168.1.100:6379                  │     │
│ │ 操作: 对 Redis 进行弱口令和配置缺陷测试            │     │
│ │                                                 │     │
│ │ [批准 ✓]  [拒绝 ✗]  [延后 ⏸]  [全部批准]        │     │
│ └─────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 4.3 漏洞详情页

从漏洞列表点击某一行，进入详情：

```
┌─────────────────────────────────────────────────────────┐
│ ← 返回项目                                              │
│                                                         │
│ Redis 未授权访问漏洞                          [高危]     │
│ 发现时间: 2026-04-03 14:32                              │
│ 影响面: tcp://192.168.1.100:6379                        │
│ 发现者: execute_code (第 2 轮)                           │
│                                                         │
│ ── 漏洞摘要 ──────────────────────────────────          │
│ Redis 服务未设置密码认证，任何人可直接连接并执行           │
│ INFO、CONFIG GET 等命令获取敏感信息。服务器暴露了          │
│ 版本号、已连接客户端数、内存使用等关键信息。               │
│                                                         │
│ ── 证据 ──────────────────────────────────────          │
│                                                         │
│ [截图] (如有)                                           │
│ ┌─────────────────────────────────────────┐             │
│ │          浏览器框架截图区域               │             │
│ └─────────────────────────────────────────┘             │
│                                                         │
│ [原始输入] (如有)                                       │
│ ┌─────────────────────────────────────────┐             │
│ │ const net = require('net');              │             │
│ │ const client = new net.Socket();         │             │
│ │ client.connect(6379, '192.168.1.100',   │             │
│ │   () => { client.write('PING\r\n'); }); │             │
│ └─────────────────────────────────────────┘             │
│                                                         │
│ [原始输出]                                              │
│ ┌─────────────────────────────────────────┐             │
│ │ +PONG                                   │             │
│ │ $4523                                   │             │
│ │ # Server                                │             │
│ │ redis_version:7.0.15                    │             │
│ │ redis_mode:standalone                   │             │
│ │ connected_clients:1                     │             │
│ │ used_memory:1234567                     │             │
│ │ ...                                     │             │
│ └─────────────────────────────────────────┘             │
│                                                         │
│ ── 修复建议 ──────────────────────────────── (如有)     │
│ 1. 在 redis.conf 中设置 requirepass 配置强密码           │
│ 2. 使用防火墙限制 6379 端口的访问来源                     │
│ 3. 禁用危险命令: rename-command CONFIG ""                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.4 执行日志 Tab

合并 MCP Run + Scheduler Task + Orchestrator Round + LLM Log 为统一时间线：

```
┌─────────────────────────────────────────────────────────┐
│ 执行日志                              [自动滚动 ✓]      │
│                                                         │
│ 14:35  🏁 第 2 轮结束 — 新增 2 资产、1 漏洞              │
│ 14:34  ✅ execute_code → tcp://..:6379 成功              │
│           发现 Redis 未授权访问                          │
│ 14:33  ✅ execute_code → tcp://..:6379 成功              │
│           Banner: Redis 7.0.15                          │
│ 14:32  🤖 AI 规划第 2 轮: 3 个任务                       │
│           [展开查看 AI 思考过程]                          │
│ 14:31  🏁 第 1 轮结束 — 新增 8 资产、0 漏洞              │
│ 14:30  ✅ httpx → http://target.com 成功                 │
│ 14:29  ✅ subfinder → target.com 成功                    │
│ 14:28  🤖 AI 规划第 1 轮: 5 个任务                       │
│ 14:27  🚀 项目启动                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 导航精简

### 5.1 侧边栏

```
📊 总览          — 跨项目汇总仪表盘
📁 项目          — 项目列表
🔍 资产中心      — 跨项目资产视图（保留现有 5 视图）
⚠️ 漏洞中心      — 跨项目漏洞汇总（现有 vuln-center 简化）
⚙️ 设置
   ├── LLM 配置
   ├── MCP 工具
   ├── 用户管理
   └── 系统日志   — 合并 audit log + work log
```

### 5.2 删除的路由/页面

| 删除页面 | 理由 |
|---------|------|
| `/evidence` | 重定向已失效，概念降级 |
| `/evidence/[evidenceId]` | Evidence 不再直接面向用户 |
| `/approvals` | 审批内联到项目仪表盘 |
| `/projects/[id]/ai-logs` | 合并到执行日志 Tab |
| `/projects/[id]/results/domains` | 合并到项目仪表盘资产 Tab |
| `/projects/[id]/results/network` | 合并到项目仪表盘资产 Tab |
| `/projects/[id]/results/sites` | 合并到项目仪表盘资产 Tab |
| `/projects/[id]/results/findings` | 合并到项目仪表盘漏洞 Tab |

### 5.3 保留但简化的页面

| 页面 | 调整 |
|------|------|
| `/projects/[id]` | 从摘要+结果中心 → 实时仪表盘（本设计核心） |
| `/projects/[id]/operations` | 保留为"高级视图"入口，从执行日志 Tab 底部链接 |
| `/vuln-center` | 精简，去掉"证据归档"区块 |
| `/assets` | 保留现有 5 视图，无大改 |

---

## 6. LLM Writeback 调整

### 6.1 Finding 创建时填充证据字段

在 `llm-writeback-service.ts` 的 `convertAnalysisToArtifacts` 中，创建 Finding 时同步填充新字段：

```typescript
// 当前：只创建 Finding 的基础字段
// 调整：同时填充 rawInput/rawOutput/screenshot 等证据字段

const finding: ProjectFindingRecord = {
  // ... 现有字段 ...
  rawInput: context.run.llmCode ?? context.run.requestedAction,  // 原始输入
  rawOutput: rawResult.rawOutput,                                 // 原始输出
  screenshotPath: relatedEvidence?.screenshotArtifactPath,       // 截图
  htmlArtifactPath: relatedEvidence?.htmlArtifactPath,           // HTML
  capturedUrl: relatedEvidence?.capturedUrl,                     // URL
  remediationNote: llmFinding.recommendation ?? null,            // 修复建议
}
```

### 6.2 LLM Analyzer Prompt 调整

在 analyzer prompt 中，要求 LLM 返回的 finding 包含 `recommendation` 字段：

```
当前返回格式: { title, severity, detail }
调整为: { title, severity, detail, recommendation }
```

---

## 7. 实施顺序建议

| 阶段 | 内容 | 预估工作量 |
|------|------|-----------|
| 7.1 | 数据模型调整 + Bug 修复 + Prisma migrate | 1 天 |
| 7.2 | SSE 事件总线 + API 端点 | 1 天 |
| 7.3 | LLM Writeback 调整（Finding 填充证据字段） | 0.5 天 |
| 7.4 | 项目工作区重设计（实时仪表盘 + 三 Tab） | 2 天 |
| 7.5 | 审批内联组件 | 0.5 天 |
| 7.6 | 漏洞详情页重设计 | 0.5 天 |
| 7.7 | 导航精简 + 路由清理 | 0.5 天 |
| 7.8 | 测试更新 + 端到端验证 | 1 天 |
| **总计** | | **~7 天** |

---

## 8. 验收标准

- [ ] 用户面对的概念仅 4 个：项目、资产、漏洞、审批（内联）
- [ ] `/evidence` 路由已删除，Evidence 不在任何用户入口中出现
- [ ] 项目工作区为实时仪表盘，包含漏洞/资产/执行日志三个 Tab
- [ ] SSE 实时推送工作正常：启动项目后资产数和漏洞数实时更新
- [ ] 审批以通知条形式内联在项目仪表盘顶部
- [ ] 低/中风险操作自动执行，仅高风险需要审批
- [ ] 漏洞详情页展示：标题、严重级别、摘要、截图、原始输入、原始输出
- [ ] 执行日志合并展示 MCP Run + Scheduler + Round + LLM 思考
- [ ] 已知 Bug 修复：证据 ID 碰撞、审批事务保护、缺失索引
- [ ] Finding 模型包含 createdAt、rawInput、rawOutput、screenshotPath 等新字段
- [ ] DVWA/Redis 端到端验证通过：创建项目 → 启动 → 实时看到资产和漏洞增长 → 查看漏洞详情
- [ ] 单元测试通过，E2E 测试适配新 UI

---

## 9. 风险与注意事项

1. **SSE 连接管理**: Next.js 开发模式下热重载可能断开 SSE 连接，需要前端自动重连
2. **事件发射侵入性**: 在现有函数中添加事件发射调用，需要注意不影响主流程（catch 吞掉事件发射异常）
3. **Finding 字段迁移**: 现有 Finding 无 rawOutput 等字段，需要数据迁移脚本从 Evidence 回填
4. **审批页面删除**: 确保所有指向 `/approvals` 的链接都改为项目内联
5. **不改 LLM 编排逻辑**: 本次不涉及 orchestrator-service 的编排策略变更
