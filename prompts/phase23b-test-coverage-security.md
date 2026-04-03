# Phase 23b: 测试覆盖率提升 + 安全修复

## 背景

Phase 23 完成了深度架构演进：死代码清理（~4000+ 行）、MCP 连接器简化（base factory 模式）、lib/ 领域化重组（54 个文件 → 9 个子目录）。当前测试覆盖率约 40%，需要提升到 80%+。同时有若干已识别的安全问题需要修复。

## 前置条件

- 阅读 `docs/code_index.md` 了解项目结构（**注意：Phase 23 后 lib/ 文件路径已变更**）
- 阅读 `docs/roadmap.md` 了解开发历史
- 确保 PostgreSQL Docker 运行：`cd docker/postgres && docker compose up -d`
- 运行 `npx prisma migrate dev` 确保 schema 同步

## lib/ 新目录结构（Phase 23 后）

```
lib/
├── orchestration/     # 编排核心 (6 files)
├── mcp/               # MCP 集成 (15 files)
├── mcp-connectors/    # MCP 连接器 (已有)
├── llm/               # LLM 大脑 (4 files)
├── llm-provider/      # LLM 提供方 (已有)
├── project/           # 项目管理 (9 files + 已有子文件)
├── auth/              # 认证安全 (4 files)
├── settings/          # 配置管理 (4 files)
├── infra/             # 基础设施 (8 files)
├── analysis/          # 分析工具 (2 files)
├── data/              # 数据仓库 (7 files)
├── types/             # 类型定义 (已有)
├── compositions/      # 组合层 (已有)
├── results/           # 结果层 (已有)
├── gateway/           # 网关层 (已有)
├── scheduler-control/ # 调度控制 (已有)
├── generated/         # Prisma 生成 (不动)
├── prototype-types.ts # 类型桶文件
├── prototype-record-utils.ts
└── utils.ts           # cn() 工具
```

## 任务清单

### A. 编排器模块测试 (优先级最高)

这些模块是核心业务逻辑，目前零测试覆盖：

1. **`lib/orchestration/orchestrator-plan-builder.ts`** (~439 行)
   - 测试 `normalizePlanItems()` — 验证 LLM 返回的计划项被正确规范化
   - 测试 `buildProjectFallbackPlanItems()` — 验证无 LLM 时的降级计划
   - 测试 `getAvailableOrchestratorTools()` — 验证工具可用性检查

2. **`lib/orchestration/orchestrator-execution.ts`** (~436 行)
   - 测试 `shouldContinueAutoReplan()` — 验证 6 个停止条件
   - 测试 `buildProjectRecentContext()` — 验证上下文构建
   - 测试 `recordOrchestratorRound()` — 验证轮次记录

3. **`lib/orchestration/orchestrator-target-scope.ts`** (~192 行)
   - 测试 `filterPlanItemsToProjectScope()` — 验证目标过滤

### B. MCP 连接器测试

4. **`lib/mcp-connectors/real-mcp-connector-base.ts`** (新文件)
   - 测试 `createRealMcpConnector()` 工厂函数的 abort 处理
   - 测试 server 未找到时的 failed 响应
   - 测试 timeout 时的 retryable_failure 响应

5. **`lib/mcp/mcp-execution-service.ts`**
   - 测试各工具类型的归一化分派
   - 测试 seed-normalizer、dns-census、web-surface-map 等专用归一化器

### C. 安全修复

6. **CSRF Token 审计** — 确认 `middleware.ts` 中 CSRF 双重提交 Cookie 正确工作
7. **Session Cookie 审计** — 确认 httpOnly + secure + SameSite 属性
8. **API 输入验证** — 对高危 API（项目创建、审批决策）添加 zod schema 验证

### D. 测试基础设施

9. **配置拆分** — 考虑将 vitest 配置拆为两个 project：`unit`（无 DB）和 `integration`（需要 DB），避免纯函数测试受 DB 连接影响
10. **CI 配置** — 创建 `.github/workflows/ci.yml`，配置 PostgreSQL service + vitest + playwright

## 验收标准

- [ ] 编排器模块测试覆盖率 > 70%
- [ ] MCP 连接器 base factory 测试覆盖
- [ ] CSRF/Session 安全审计通过
- [ ] CI pipeline 可运行
- [ ] `npx vitest run` 全部通过（需 PostgreSQL）
- [ ] `npx playwright test` E2E 全部通过

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
- 所有新路径使用 `@/lib/` 别名 + 子目录名，例如 `@/lib/orchestration/orchestrator-service`
