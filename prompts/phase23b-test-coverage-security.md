# Phase 23b: 测试覆盖率提升 + 安全修复

## 背景

Phase 23 完成了巨型文件拆分、结构化错误处理和 58 个纯函数测试。当前测试覆盖率约 40%，需要提升到 80%+。同时有若干已识别的安全问题需要修复。

## 前置条件

- 阅读 `code_index.md` 了解项目结构
- 阅读 `roadmap.md` 了解开发历史
- 确保 PostgreSQL Docker 运行：`cd docker/postgres && docker compose up -d`
- 运行 `npx prisma migrate dev` 确保 schema 同步

## 任务清单

### A. 编排器模块测试 (优先级最高)

这些模块是核心业务逻辑，目前零测试覆盖：

1. **`lib/orchestrator-plan-builder.ts`** (~439 行)
   - 测试 `normalizePlanItems()` — 验证 LLM 返回的计划项被正确规范化
   - 测试 `buildProjectFallbackPlanItems()` — 验证无 LLM 时的降级计划
   - 测试 `getAvailableOrchestratorTools()` — 验证工具可用性检查

2. **`lib/orchestrator-execution.ts`** (~436 行)
   - 测试 `shouldContinueAutoReplan()` — 验证 6 个停止条件
   - 测试 `buildProjectRecentContext()` — 验证上下文构建
   - 测试 `recordOrchestratorRound()` — 验证轮次记录

3. **`lib/orchestrator-target-scope.ts`** (~192 行)
   - 测试 `filterPlanItemsToProjectScope()` — 验证目标过滤

### B. 执行引擎测试

4. **`lib/execution/artifact-normalizer.ts`**
   - 测试各工具类型的归一化分派
   - 测试 seed-normalizer、dns-census、web-surface-map 等 7 个专用归一化器

5. **`lib/execution/artifact-normalizer-stdio.ts`**
   - 测试域名资产提取
   - 测试网络资产提取
   - 测试安全问题检测（版本泄露、过时软件）

### C. 前端错误处理测试

6. **`lib/api-error-messages.ts`**
   - 测试所有 9 种错误码到中文消息的映射
   - 测试 fallback 逻辑
   - 测试 null/undefined payload 处理

### D. 安全修复

7. **CSRF Token 审计** — 确认 `middleware.ts` 中 CSRF 双重提交 Cookie 正确工作
8. **Session Cookie 审计** — 确认 httpOnly + secure + SameSite 属性
9. **API 输入验证** — 对高危 API（项目创建、审批决策）添加 zod schema 验证

### E. 测试基础设施

10. **配置拆分** — 考虑将 vitest 配置拆为两个 project：`unit`（无 DB）和 `integration`（需要 DB），避免纯函数测试受 DB 连接影响
11. **CI 配置** — 创建 `.github/workflows/ci.yml`，配置 PostgreSQL service + vitest + playwright

## 验收标准

- [ ] 编排器模块测试覆盖率 > 70%
- [ ] 执行引擎归一化器测试覆盖率 > 60%
- [ ] 前端错误处理 100% 覆盖
- [ ] CSRF/Session 安全审计通过
- [ ] CI pipeline 可运行
- [ ] `npx vitest run` 全部通过（需 PostgreSQL）

## 技术栈

- Vitest 3.0 + @testing-library/react
- Prisma 7.x + PostgreSQL 16
- Next.js 15 App Router
- TypeScript strict mode

## 注意事项

- 纯函数测试文件头部添加 `// @vitest-environment node`
- DB 依赖测试需要 `tests/helpers/prisma-test-utils.ts` 的 cleanDatabase/seedTestUsers
- 测试 setup.ts 已有 DB 可达性检测，PostgreSQL 不可用时自动跳过 DB 操作
- 遵循项目现有的测试命名约定：`tests/lib/xxx.test.ts`
