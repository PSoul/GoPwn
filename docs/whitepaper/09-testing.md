# 09 — 测试体系

> GoPwn 拥有多层测试体系：444 个单元/集成测试 + 13 个性能基准 + 31 个 E2E 测试（含真实渗透测试），覆盖从纯函数到完整渗透流水线的所有层次。

---

## 9.1 测试技术栈

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | 3.0 | 单元测试 + 集成测试 + 性能基准 |
| Playwright | 1.58 | E2E 浏览器测试 |
| @testing-library/react | 16.2 | React 组件测试 |
| @electric-sql/pglite | 0.4 | 内存 PostgreSQL（集成测试） |
| msw | 2.13 | API Mock（HTTP Mock Service Worker） |

### 测试命令

```bash
npm run test              # 单元 + hooks 测试
npm run test:unit         # 同上
npm run test:integration  # 集成测试
npm run test:full         # 全部测试
npm run test:perf         # 性能基准测试
npm run test:coverage     # 覆盖率报告
npm run test:all          # 全部测试 + 性能 + lint + 类型检查
npm run e2e               # Playwright E2E 测试
npm run e2e:headed        # 有头模式 E2E（可视化）
```

## 9.2 单元测试（444 个）

### 测试分布

| 测试目录 | 测试数 | 覆盖内容 |
|---------|--------|---------|
| `tests/unit/workers/` | 4 个文件 | react-worker, analysis-worker, verification-worker, lifecycle-worker |
| `tests/unit/llm/` | 多个文件 | prompts, function-calling, tool-input-mapper |
| `tests/unit/repositories/` | 多个文件 | finding-dedup (38 个用例), asset-repo, mcp-run-repo |
| `tests/unit/domain/` | 多个文件 | lifecycle 状态机, scope-policy, phases |
| `tests/api/` | 15+ 文件 | 36 个 API 端点 |
| `tests/pages/` | 8+ 文件 | React 组件渲染 |
| `tests/hooks/` | 多个文件 | useProjectEvents, useReactSteps |

### Mock 策略

Worker 测试使用 `vi.mock()` 隔离外部依赖：

```typescript
// 典型的 worker 测试 mock 设置
vi.mock("@/lib/repositories/asset-repo", () => ({
  findByProject: vi.fn().mockResolvedValue([]),
  upsert: vi.fn().mockResolvedValue({ id: "asset-001" }),
}))
vi.mock("@/lib/repositories/finding-repo", () => ({
  create: vi.fn().mockResolvedValue({ id: "finding-001" }),
}))
vi.mock("@/lib/llm", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getLlmProvider: vi.fn().mockResolvedValue({ chat: mockLlmChat }) }
})
```

### Finding 去重测试（38 个用例）

`finding-dedup.test.ts` 是最全面的单元测试文件之一，覆盖 10 个分组：

| 分组 | 用例数 | 测试内容 |
|------|--------|---------|
| 不同服务同类漏洞不应合并 | 8 | Redis/MongoDB/MySQL/PostgreSQL/ES/SSH/FTP 等 |
| 同一服务同类漏洞应合并 | 5 | 括号变体、同义词、跨语言、精确匹配、severity 升级 |
| 虚构/罕见服务名鲁棒性 | 4 | ZorgDB/PlonkMQ/FooCache 等不存在的服务名 |
| 无服务名纯漏洞类型合并 | 4 | 中英文互转（未授权/SQLi/XSS/弱口令） |
| 不同主机不合并 | 1 | 相同标题不同 host |
| 不同漏洞类型不合并 | 3 | 未授权 vs SQL注入 vs XSS |
| 压力测试 | 1 (42 断言) | 15服务 × 3漏洞类型 |
| 真实渗透场景 | 2 | 同主机多服务 |
| 纯中文标题去重 | 2 | 数据库/缓存/消息队列等 |
| 边界情况 | 8 | 泛化描述、多词英文、已知限制 |

### Mock 方式

Finding 去重测试使用内存数组模拟 Prisma：

```typescript
let fakeFindingDb: FakeFinding[] = []

vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    finding: {
      findFirst: vi.fn(({ where }) => { /* 在 fakeFindingDb 中查找 */ }),
      findMany: vi.fn(({ where }) => fakeFindingDb.filter(...)),
      create: vi.fn(({ data }) => { /* 写入 fakeFindingDb */ }),
      update: vi.fn(({ where, data }) => { /* 更新 fakeFindingDb */ }),
    }
  }
}))
```

## 9.3 性能基准测试（13 个）

使用 `vitest.perf.config.mts` 配置独立的性能测试：

```bash
npm run test:perf
```

覆盖关键路径的性能指标，确保核心操作在可接受的时间范围内完成。

## 9.4 E2E 测试（31 个）

### 测试套件

| 文件 | 测试数 | 覆盖范围 |
|------|--------|---------|
| `prototype-smoke.spec.ts` | 8 | 登录、仪表盘、资产中心、项目 CRUD、设置、MCP 调度 |
| `vuln-cockpit.spec.ts` | 6 | 侧边导航、统计卡片、项目列表、AI 聊天组件 |
| `full-pipeline.spec.ts` | 10 | 4 API + 6 浏览器：健康检查、认证、项目页面 |
| `settings.spec.ts` | 6 | 设置中心、LLM 设置、MCP 工具、审批策略、审计日志、系统状态 |
| `real-pipeline.spec.ts` | 1 | 真实渗透测试（8.2 分钟） |

### 测试基础设施

- **Seed 脚本**: `node scripts/e2e-seed-database.mjs` — 清空数据库 + 插入测试用户和 LLM profiles
- **测试模式**: `E2E_TEST_MODE=true` 绕过 CSRF
- **测试账号**: `researcher@company.local` / `Prototype@2026`
- **辅助函数**: `e2e/helpers.ts` 提供 `loginAsResearcher()` / `createProject()`

### 真实渗透测试 E2E

`real-pipeline.spec.ts` 是最重要的 E2E 测试 — 它对 Docker 靶场执行完整的 ReAct 管线：

| 指标 | 数值 |
|------|------|
| 耗时 | 8.2 分钟 |
| MCP 工具调用 | 118 次 |
| 发现资产 | 130 个 |
| 发现漏洞 | 78 个 |
| 证据记录 | 78 条 |
| 主要发现 | DVWA 默认凭据、Elasticsearch 未授权访问、开放代理 |

**运行条件**:
- Docker 靶场已启动（`docker compose -f docker/local-labs/compose.yaml up -d`）
- Worker 进程运行中（`npx tsx watch worker.ts`）
- LLM API 已配置（环境变量或数据库）

## 9.5 集成测试

集成测试使用 `@electric-sql/pglite` 提供内存 PostgreSQL 实例，无需外部数据库：

```typescript
// 典型的集成测试设置
import { PGlite } from "@electric-sql/pglite"

const pg = new PGlite()
// 初始化 schema
await pg.exec(schemaSQL)
// 测试直接与真实 SQL 交互
```

集成测试默认跳过（`// @vitest-environment node`），通过 `npm run test:integration` 单独运行。

## 9.6 测试策略

### 分层原则

| 层 | 测试方法 | 依赖 |
|----|---------|------|
| domain/ 纯逻辑 | 直接调用纯函数 | 无 |
| repositories/ | 集成测试 (PGlite) 或 Mock Prisma | PGlite 或 vi.mock |
| workers/ | Mock 所有外部依赖 | vi.mock |
| services/ | Mock repositories + domain | vi.mock |
| API routes | HTTP 请求测试 | Mock services |
| 组件 | @testing-library/react | jsdom |
| 完整流水线 | Playwright E2E | 真实 Docker 靶场 |

### CI/CD 建议

```bash
# 完整验证流程
npm run test:all
# 等价于:
# npm run test:full        (单元 + 集成)
# npm run test:perf        (性能基准)
# npm run lint             (代码检查)
# npx tsc --noEmit         (类型检查)
```
