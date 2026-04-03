# Phase 24: 概念精简 + 实时仪表盘

## 背景

LLM 渗透测试平台的后端编排流程已经验证可用（Redis/DVWA 端到端闭环，能发现真实漏洞），但前端用户体验存在严重问题：

1. **概念过多**：用户面对 11 个概念（Project/Asset/Evidence/Finding/Approval/MCP Run/Scheduler Task/Orchestrator Round/Work Log/Audit Log/LLM Log），实际只需关心"发现了什么资产、有什么漏洞"
2. **无实时反馈**：项目启动后页面是静态的，不知道后台在做什么，要手动刷新
3. **结果散落**：资产、证据、发现分散在不同页面，没有统一的项目仪表盘
4. **Evidence 概念多余**：渗透测试工具（Burp/Nessus）从来没有独立的"证据"实体，证据就是漏洞的附属证明材料

## 目标

将平台从"开发者调试工具"进化为"安全团队可用的资产探测+漏洞扫描平台"。

核心改动：
1. 用户概念从 11 个精简为 4 个：**项目、资产、漏洞、审批（内联）**
2. 新增 **SSE 实时推送**：项目启动后实时看到资产/漏洞数增长
3. 项目工作区重设计为**实时仪表盘**：指标卡片 + 漏洞 Tab + 资产 Tab + 执行日志 Tab
4. **审批内联**到项目仪表盘，低/中风险自动执行

## 设计文档

- **Spec**: `docs/superpowers/specs/2026-04-04-phase24-concept-simplification-realtime-dashboard-design.md`
- **Plan**: `docs/superpowers/plans/2026-04-04-phase24-concept-simplification-implementation.md`

## 核心约束

### 不改动的部分
- LLM 编排核心逻辑（orchestrator-service 的规划/执行策略）
- MCP 连接器实现
- LLM prompt 方法论部分（TCP 测试方法论等）
- 数据库表不删除（Evidence 表保留，但前端不暴露）

### 必须遵守的原则
- **不作弊**: LLM prompt 中不包含任何具体代码、靶场路径、攻击 payload
- **Evidence 降级**: Evidence 在后端继续创建（作为 MCP 执行原始记录），但用户永远看不到独立的 Evidence 页面
- **Finding = 漏洞**: Finding 模型增强后成为用户看到的核心实体，包含标题、严重级别、摘要、截图、原始输入输出、修复建议
- **SSE 不影响主流程**: 所有事件发射操作 catch 吞掉异常，绝不因为 SSE 导致主业务逻辑失败

## 实施顺序

### Phase 1: 数据模型 + Bug 修复 (1 天)
1. Finding 模型增强（createdAt, rawInput, rawOutput, screenshotPath, htmlArtifactPath, capturedUrl, remediationNote）
2. Evidence 添加 createdAt/updatedAt
3. 证据 ID 碰撞修复
4. 审批事务保护
5. 缺失索引补齐
6. 审批自动化（中风险自动执行）

### Phase 2: SSE 实时推送 (1 天)
1. ProjectEventBus（进程内 EventEmitter）
2. SSE API 端点 `/api/projects/[projectId]/events`
3. 在关键写入点添加事件发射（9 个位置）
4. 前端 `useProjectEvents` Hook

### Phase 3: LLM Writeback 调整 (0.5 天)
1. Finding 创建时从 Evidence/MCP Run 填充证据字段
2. Analyzer prompt 返回格式增加 recommendation

### Phase 4: 前端重设计 (3.5 天)
1. 项目实时仪表盘（指标卡片 + 三 Tab）
2. 审批内联通知条
3. 漏洞详情页
4. 导航精简 + 路由清理

### Phase 5: 测试与验证 (1 天)
1. 单元测试更新
2. DVWA/Redis 端到端验证
3. 文档更新

## 关键文件清单

### 新建文件
- `lib/infra/project-event-bus.ts` — SSE 事件总线
- `app/api/projects/[projectId]/events/route.ts` — SSE 端点
- `lib/hooks/use-project-events.ts` — 前端 SSE Hook
- `components/projects/project-live-dashboard.tsx` — 实时仪表盘
- `components/projects/project-stats-bar.tsx` — 指标卡片
- `components/projects/project-vuln-tab.tsx` — 漏洞 Tab
- `components/projects/project-asset-tab.tsx` — 资产 Tab
- `components/projects/project-activity-log.tsx` — 执行日志 Tab
- `components/projects/project-approval-bar.tsx` — 审批内联
- `components/projects/finding-detail.tsx` — 漏洞详情
- `app/(console)/projects/[projectId]/vuln/[findingId]/page.tsx` — 漏洞详情路由

### 修改文件
- `prisma/schema.prisma` — Finding 增强 + Evidence 时间戳 + 索引 + 审批自动化
- `lib/types/mcp.ts` — ProjectFindingRecord 新字段
- `lib/infra/prisma-transforms.ts` — Finding/Evidence 转换更新
- `lib/llm/llm-writeback-service.ts` — Finding 创建时填充证据字段 + 证据 ID 修复
- `lib/llm/llm-brain-prompt.ts` — Analyzer 返回格式调整
- `lib/gateway/mcp-dispatch-service.ts` — 审批事务保护 + 审批自动化 + SSE 发射
- `lib/data/approval-repository.ts` — 事务外同步重试 + SSE 发射
- `lib/data/asset-repository.ts` — SSE 发射
- `lib/project/project-results-repository.ts` — SSE 发射
- `lib/mcp/mcp-scheduler-service.ts` — SSE 发射
- `lib/orchestration/orchestrator-service.ts` — SSE 发射
- `components/layout/app-sidebar.tsx` — 导航精简
- `app/(console)/projects/[projectId]/page.tsx` — 重写为实时仪表盘
- `app/(console)/vuln-center/page.tsx` — 去掉证据归档区块

### 删除文件
- `app/(console)/evidence/page.tsx`
- `app/(console)/evidence/[evidenceId]/page.tsx`
- `app/(console)/approvals/page.tsx`
- `app/(console)/projects/[projectId]/ai-logs/page.tsx`
- `app/(console)/projects/[projectId]/results/findings/page.tsx`
- `app/(console)/projects/[projectId]/results/domains/page.tsx`
- `app/(console)/projects/[projectId]/results/network/page.tsx`
- `app/(console)/projects/[projectId]/results/sites/page.tsx`

## 验收标准

- [ ] `/evidence` 和 `/approvals` 路由已删除
- [ ] 项目工作区为实时仪表盘，含漏洞/资产/执行日志三个 Tab
- [ ] SSE 推送正常：启动项目后资产数和漏洞数实时更新
- [ ] 审批以通知条形式内联在项目仪表盘顶部
- [ ] 低/中风险自动执行，仅高风险需审批
- [ ] 漏洞详情页展示：标题、严重级别、摘要、截图、原始输入、原始输出
- [ ] 执行日志合并展示 MCP Run + AI 思考 + 编排轮次
- [ ] 侧边栏仅 5 个主入口
- [ ] DVWA/Redis 端到端验证通过
- [ ] 单元测试全部通过

## 注意事项

1. **SSE 在 Next.js dev 模式下**：热重载会断开连接，前端需自动重连（EventSource 内置）
2. **数据迁移**：现有 Finding 无 rawOutput 等字段，需要从 Evidence 回填（写迁移脚本）
3. **链接更新**：删除页面前 grep 所有指向该路由的 href，全部更新
4. **不删 Evidence 表**：只删前端入口，后端继续写入 Evidence 作为原始记录
5. **不改编排逻辑**：orchestrator-service 的规划/执行策略完全不动
