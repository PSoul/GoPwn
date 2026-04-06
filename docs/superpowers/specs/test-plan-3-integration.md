# Plan 3: 集成测试

> 前置: Plan 1 (PGlite 工具, vitest 配置)
> 产出: repository + service + API 集成测试，约 40 个用例
> 验证: `npm run test:integration` 全绿

## Step 1: Repository — project-repo.test.ts

文件: `tests/integration/repositories/project-repo.test.ts`
源文件: `lib/repositories/project-repo.ts`

使用 `createTestDb()` 提供真实 PGlite + Prisma。

用例:
1. create → findById 返回正确数据（name, code, lifecycle=idle）
2. findAll → 返回所有项目，按 createdAt 排序
3. updateLifecycle → lifecycle 字段正确更新
4. deleteById → findById 返回 null
5. 创建项目 with targets → targets 关联记录正确创建

注意: targets 在 schema 中是独立 Target model（不是 JSON），create 时需要 `targets: { create: [...] }` 语法。先读 project-repo.ts 确认 create 方法的实际签名。

## Step 2: Repository — finding-repo.test.ts

文件: `tests/integration/repositories/finding-repo.test.ts`
源文件: `lib/repositories/finding-repo.ts`

前置数据: 每个用例先 seed 一个 project。

用例:
1. create → findByProject 返回 1 条
2. create 两条不同 title → findByProject 返回 2 条
3. normalizeTitle 测试: "SQL注入" 和 "SQL Injection" → 同一 normalizedTitle（如果 repo 层有 dedup 逻辑）
4. updateStatus: suspected → verifying → verified 正常流转
5. createPoc: 关联 findingId，查询 finding 时 pocs 非空

注意: 先读 finding-repo.ts 确认 dedup 是在 repo 层还是 worker 层。如果 dedup 逻辑在 worker 层（analysis-worker），这里只测基础 CRUD。

## Step 3: Repository — approval-repo.test.ts + asset-repo.test.ts

**approval-repo.test.ts**:
前置数据: seed project + mcpRun（approval 需要 mcpRunId）。

用例:
1. create → findByProject 返回 1 条 pending
2. findPending → 只返回 status=pending
3. decide(id, "approved") → 返回 count=1，记录变为 approved
4. decide 同一条已 approved → 返回 count=0（原子性验证）
5. cancelPendingByProject → pending 变 rejected，已 approved 不受影响

**asset-repo.test.ts**:
前置数据: seed project。

用例:
1. upsert 新 asset → 创建成功
2. upsert 相同 (projectId, kind, value) → 更新而非新建（检查 count=1）
3. 创建 ip asset → 创建 port asset with parentId → 查询 children 正确
4. countByProject → 返回正确数量

## Step 4: Repository — mcp-run-repo.test.ts + audit-repo.test.ts

**mcp-run-repo.test.ts**:
前置数据: seed project。

用例:
1. create → findByProjectAndRound 返回 1 条
2. updateStatus: scheduled → running → succeeded
3. cancelPendingByProject: pending/scheduled 变 cancelled，running 不受影响

注意: checkAndPublishRoundCompletion 依赖 job-queue，这里 mock job-queue，只验证"全部完成"的判断逻辑。

**audit-repo.test.ts**:
用例:
1. create → findByProject 返回记录
2. 字段完整: category, action, actor, detail 均正确存储
3. projectId 为 null → 仍可创建（全局审计事件）

## Step 5: Service — project-service.test.ts

文件: `tests/integration/services/project-service.test.ts`
源文件: `lib/services/project-service.ts`

**混合测试**: PGlite 提供真实数据库，但 mock job-queue 和 event-bus。

Mock:
- `@/lib/infra/job-queue` → createPgBossJobQueue 返回 mock（publish, cancelByProject）
- `@/lib/infra/event-bus` → publishEvent mock
- `@/lib/infra/abort-registry` → abortAllForProject mock

不 mock: project-repo, audit-repo（走真实 PGlite）

用例:
1. createProject("test", "http://example.com") → project 创建 + target 解析正确
2. createProject("test", "192.168.1.0/24\n10.0.0.1") → 多目标解析（CIDR + IP）
3. createProject → audit 记录已写入
4. startProject(idle project) → lifecycle 变 planning，job 已发布
5. startProject(failed project) → RETRY_REACT，lifecycle 变 planning
6. startProject(stopped project) → 抛错
7. stopProject → lifecycle 变 stopped，abort + cancel 均调用
8. stopProject cleanup 异常 → 仍然到达 stopped
9. deleteProject → audit 记录写入 + 项目删除

## Step 6: Service — approval-service.test.ts

文件: `tests/integration/services/approval-service.test.ts`
源文件: `lib/services/approval-service.ts`

Mock: event-bus, job-queue（同上）
不 mock: approval-repo, project-repo, mcp-run-repo

前置数据: seed project (lifecycle=waiting_approval) + mcpRun + approval

用例:
1. decide(approvalId, "approved") → approval 状态变 approved，mcpRun 状态变 scheduled
2. decide(approvalId, "rejected") → approval 状态变 rejected，mcpRun 状态变 cancelled
3. decide 不存在的 approvalId → 抛 NotFoundError
4. 两次 decide 同一个 → 第二次抛 DomainError (409)
5. 最后一个 pending 审批决策完成 → 项目 lifecycle 从 waiting_approval 恢复

## Step 7: API — projects.test.ts + approvals.test.ts + settings.test.ts

**测试方式**: 直接 import route handler（Next.js App Router 的 GET/POST/PUT 函数），构造 NextRequest 调用。需要 mock auth 中间件和数据库。

注意: 先读 `lib/infra/api-handler.ts` 确认 route handler 的包装模式，决定是直接调 handler 还是需要特殊处理。

**projects.test.ts** (`tests/integration/api/projects.test.ts`):
1. POST /api/projects — body={name, targetInput} → 201 + project 数据
2. POST /api/projects — 缺少 name → 400
3. GET /api/projects → 200 + 数组

**approvals.test.ts** (`tests/integration/api/approvals.test.ts`):
1. PUT /api/approvals/[id] — body={decision:"approved"} → 200
2. PUT /api/approvals/[id] — 缺少 decision → 400

**settings.test.ts** (`tests/integration/api/settings.test.ts`):
1. GET /api/settings/llm → 200 + 配置数据
2. PUT /api/settings/llm — 更新配置 → 200

如果 API handler 的 auth 和包装逻辑过于复杂导致直接调用困难，降级为只测 service 层（step 5-6 已覆盖），跳过 API 路由测试。

## Step 8: 验证

```bash
npm run test:integration
```

所有用例通过。确认 PGlite 实例正确启动和关闭（无进程泄漏）。
