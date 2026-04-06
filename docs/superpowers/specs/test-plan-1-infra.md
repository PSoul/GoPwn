# Plan 1: 测试基础设施搭建

> 前置: 无
> 产出: helpers 工厂、PGlite 工具、vitest workspace 配置、npm scripts
> 验证: `npm run test:unit` 和 `npm run test:integration` 均可执行（空测试集也不报错）

## Step 1: 安装依赖

```bash
npm install -D @electric-sql/pglite @vitest/coverage-v8
```

`@electric-sql/pglite` 用于集成测试的内存 PostgreSQL。
`@vitest/coverage-v8` 用于覆盖率报告。

## Step 2: 目录结构创建

```
tests/
├── setup.ts              # 已有，保留
├── helpers/
│   ├── factories.ts      # 从 tests/lib/workers/_helpers.ts 迁移 + 扩展
│   ├── pglite-prisma.ts  # PGlite + Prisma 集成
│   └── mock-llm.ts       # LLM/MCP mock 工厂
├── unit/                  # 空目录占位
│   ├── domain/
│   ├── llm/
│   └── workers/           # 现有 3 个测试文件移到这里
├── integration/           # 空目录占位
│   ├── repositories/
│   ├── services/
│   └── api/
└── perf/                  # 空目录占位
```

**迁移现有测试**：
- `tests/lib/workers/*.test.ts` → `tests/unit/workers/*.test.ts`
- `tests/lib/workers/_helpers.ts` 内容合并到 `tests/helpers/factories.ts`
- 旧路径删除

## Step 3: 扩展工厂函数 (tests/helpers/factories.ts)

从现有 `_helpers.ts` 保留：
- `mockProject()`, `mockMcpRun()`, `mockFinding()`, `mockLlmProvider()`
- `MOCK_PLAN_RESPONSE`, `MOCK_ANALYSIS_RESPONSE`, `MOCK_REVIEW_RESPONSE`

新增工厂：
- `mockApproval(overrides?)` — 需要 mcpRunId, projectId, target, actionType, riskLevel, status: "pending"
- `mockAsset(overrides?)` — kind: "port", value: "127.0.0.1:80", label: "HTTP (80)"
- `mockEvidence(overrides?)` — rawOutput, toolName, title
- `mockLlmLog(overrides?)` — status: "streaming", role, phase, prompt
- `mockAuditEntry(overrides?)` — category: "project", action: "created", actor: "user"
- `mockUser(overrides?)` — account, password (bcrypt hash), displayName, role: "researcher"

新增预录响应：
- `MOCK_REACT_FUNCTION_CALL` — `{ content: null, functionCall: { name: "fscan_port_scan", arguments: "..." } }`
- `MOCK_REACT_FINAL_ANSWER` — `{ content: "扫描完成，发现以下问题..." }`
- `MOCK_VERIFIER_POC` — `{ code: "...", language: "python" }`
- `MOCK_INVALID_JSON` — `"这不是 JSON {{{"`

## Step 4: PGlite + Prisma 集成工具 (tests/helpers/pglite-prisma.ts)

核心实现思路：

```typescript
import { PGlite } from "@electric-sql/pglite"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/lib/generated/prisma"
import fs from "fs"
import path from "path"

// 从 prisma schema 生成的 SQL DDL（手动维护或用 prisma migrate diff 生成）
// 实际做法：用 prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
// 在首次运行时生成，缓存到 tests/helpers/schema.sql

export async function createTestDb() {
  const pg = new PGlite()

  // 执行 DDL 建表（含 enum 创建）
  const ddl = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8")
  await pg.exec(ddl)

  // 创建 Prisma client 连接到 PGlite
  const adapter = new PrismaPg(pg)
  const prisma = new PrismaClient({ adapter })

  // 获取所有表名用于 truncate
  const tables = await pg.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  )
  const tableNames = tables.rows.map(r => r.tablename)

  return {
    prisma,
    async truncateAll() {
      if (tableNames.length > 0) {
        await pg.exec(`TRUNCATE ${tableNames.map(t => `"${t}"`).join(", ")} CASCADE`)
      }
    },
    async cleanup() {
      await prisma.$disconnect()
      await pg.close()
    },
  }
}
```

**Schema SQL 生成脚本**：
在 package.json 中加 `"test:gen-schema": "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > tests/helpers/schema.sql"`

首次运行或 schema 变更后需执行此命令。

**注意事项**：
- PGlite 在 Windows 上需要 WASM 支持，vitest + Node.js 18+ 默认支持
- `@prisma/adapter-pg` 的接口需要 pg.Pool 兼容对象，PGlite 提供了兼容层
- 如果 PGlite adapter 兼容性有问题，fallback 方案是用 raw SQL 测试 repo 函数

## Step 5: LLM/MCP Mock 工厂 (tests/helpers/mock-llm.ts)

```typescript
import type { LlmProvider, LlmMessage, LlmResponse } from "@/lib/llm/provider"

export function createDelayedLlmProvider(options: {
  delayMs: number
  responses: Map<string, string>  // 按调用顺序，key 可以是 "call-0", "call-1" ...
  failRate?: number
}): LlmProvider

export function createSequentialLlmProvider(
  responses: LlmResponse[]
): LlmProvider
// 每次 chat() 调用返回下一个预设响应，用完后循环最后一个

export function createDelayedMcpTool(options: {
  delayMs: number
  output: string
  failRate?: number
}): (toolName: string, args: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>
```

## Step 6: Vitest Workspace 配置

改造 `vitest.config.mts` 为 workspace 模式：

```typescript
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./tests/setup.ts"],
          testTimeout: 15_000,
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./tests/setup.ts"],
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      exclude: [
        "tests/**",
        "lib/generated/**",
        "node_modules/**",
        "*.config.*",
        "mcps/**",
        ".next/**",
      ],
    },
  },
})
```

新增 `vitest.perf.config.mts`（性能测试专用，Plan 4 再写内容）：

```typescript
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/perf/**/*.perf.ts"],
    environment: "node",
    testTimeout: 120_000,
    fileParallelism: false,
  },
})
```

## Step 7: npm scripts 更新

在 package.json 的 scripts 中添加/修改：

```json
{
  "test": "vitest run",
  "test:unit": "vitest run --project unit",
  "test:integration": "vitest run --project integration",
  "test:perf": "vitest run --config vitest.perf.config.mts",
  "test:coverage": "vitest run --coverage",
  "test:gen-schema": "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > tests/helpers/schema.sql",
  "test:all": "npm run test && npm run test:perf && npm run lint && npx tsc --noEmit"
}
```

## Step 8: 验证

1. `npm run test:gen-schema` — 生成 schema.sql
2. `npm run test:unit` — 现有 3 个 worker 测试应全部通过（路径迁移后）
3. `npm run test:integration` — 空测试集，不报错
4. `npx tsc --noEmit` — 类型检查通过
5. 写一个最简 PGlite 冒烟测试验证连接可用：

```typescript
// tests/integration/repositories/_smoke.test.ts
import { describe, it, expect, afterAll, beforeAll } from "vitest"
import { createTestDb } from "../../helpers/pglite-prisma"

describe("PGlite smoke test", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>

  beforeAll(async () => { db = await createTestDb() })
  afterAll(async () => { await db.cleanup() })

  it("can create and query a project", async () => {
    const project = await db.prisma.project.create({
      data: { code: "test-001", name: "Smoke Test" },
    })
    expect(project.id).toBeDefined()
    expect(project.lifecycle).toBe("idle")
  })
})
```
