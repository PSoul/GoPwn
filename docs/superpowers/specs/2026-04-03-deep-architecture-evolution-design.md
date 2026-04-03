# Phase 23: 深度架构演进设计

> 日期: 2026-04-03
> 分支: `refactor/phase23-deep-architecture-evolution`
> 状态: 设计已批准

## 目标

消除多轮重构积累的死代码（~5000 行），简化 MCP 连接器层（减 37%），将 lib/ 68 个平铺文件按领域重组为 10 个子目录，全部 import 路径完全迁移（不使用 barrel 兼容）。

## 技术栈

Next.js 15 (App Router) · TypeScript 5 · Prisma 7 · PostgreSQL 16 · Vitest 3.0 · Playwright 1.58

---

## 第一部分：死代码清理（~5000 行）

### 删除清单

| 文件 | 行数 | 原因 |
|------|------|------|
| `lib/prototype-data.ts` | 1913 | 生产代码零引用（仅 4 个测试文件引用） |
| `lib/prototype-store.ts` | 702 | Prisma 已完全替代，迁移 3 处微小引用后删除 |
| `lib/execution/artifact-normalizer-stdio.ts` | 644 | Phase 22b LLM writeback 替换后遗留 |
| `lib/execution/execution-runner.ts` | 191 | mcp-execution-service.ts 旧版副本 |
| `lib/api-error-messages.ts` | 44 | 从未被任何文件导入 |
| `lib/gateway/dispatch-helpers.ts` | ~60 | 生产代码零引用（仅测试引用） |
| `components/kokonutui/*` (9 个文件) | ~800 | 演示/模板组件，全站零引用 |
| `components/shared/stat-card.tsx` | ~50 | 零引用 |
| `components/projects/project-task-board.tsx` | ~80 | 零引用 |
| `components/projects/project-inventory-table.tsx` | ~80 | 零引用 |
| `components/evidence/evidence-table.tsx` | ~80 | 零引用 |
| `tests/lib/execution-helpers.test.ts` | ~100 | 测试已删除的死代码 |
| `tests/lib/dispatch-helpers.test.ts` | ~100 | 测试仅测试引用的代码 |

### 迁移处理

| 原导出 | 迁移到 | 方式 |
|--------|--------|------|
| `getDefaultProjectFormPreset()` | 使用处内联 | 3 行对象字面量 `{ name: "", targetInput: "", description: "" }` |
| `DEFAULT_LLM_PROFILES` | `tests/helpers/prisma-test-utils.ts` | 内联常量 |
| `prototype-data.ts` 中的 mock 数据 | 各测试文件 | 用 prisma fixture 替代或内联 |

### 删除未使用导出

| 函数 | 所在文件 |
|------|---------|
| `formatSummariesForPrompt()` | `lib/tool-output-summarizer.ts:393` |
| `getShortEnvironmentTag()` | `lib/env-detector.ts:136` |

---

## 第二部分：MCP 连接器层简化

### A) 通用 MCP 连接器基础函数

新建 `lib/mcp-connectors/mcp-connector-base.ts`（~80 行），封装 4 个 real-* 连接器的共同模式：

- server lookup（`findStoredEnabledMcpServerByToolBinding`）
- `callMcpServerTool()` 调用包装
- abort 检查 + 错误处理（`isExecutionAbortError`）
- 标准 `McpConnectorResult` 构造

4 个 real-* 连接器从 ~580 行缩减到 ~160 行（每个 ~40 行配置对象 + 特有逻辑）。

### B) stdio-mcp-connector.ts 简化

从 760 行缩减到 ~500 行：

- 提取 `extractHostFromTarget(target)` 工具函数 — 消除 10+ 处重复 regex
- 提取 `extractHostAndPort(target)` 工具函数 — TCP 格式解析复用
- `buildToolArguments()` 中对同行为工具用声明式映射
- `buildExecuteCodeScript()` 本次不动（属于 Phase A 计划的靶场特定逻辑清除范围）

### C) local-foundational-connectors.ts 移入测试目录

227 行 → 移到 `tests/helpers/local-connectors.ts`，生产代码不再包含测试 mock。同步更新 `registry.ts` 中的注册逻辑（仅在测试环境注册本地连接器）。

### 预期效果

1900 行 → ~1200 行（减 37%）

---

## 第三部分：lib/ 领域化重组

### 目标目录结构

```
lib/
├── orchestration/           # 编排核心 (6 files)
│   ├── orchestrator-service.ts
│   ├── orchestrator-plan-builder.ts
│   ├── orchestrator-execution.ts
│   ├── orchestrator-context-builder.ts
│   ├── orchestrator-target-scope.ts
│   └── orchestrator-local-lab.ts
│
├── mcp/                     # MCP 集成 (13 files)
│   ├── auto-discovery.ts
│   ├── scheduler-service.ts
│   ├── execution-service.ts
│   ├── server-repository.ts
│   ├── scheduler-repository.ts
│   ├── client-service.ts
│   ├── workflow-service.ts
│   ├── registration-schema.ts
│   ├── execution-runtime.ts
│   ├── execution-abort.ts
│   ├── built-in-tools.ts
│   ├── write-schema.ts
│   └── connectors/          # 已有子目录，保留
│
├── llm/                     # LLM 大脑 (5 files)
│   ├── brain-prompt.ts
│   ├── writeback-service.ts
│   ├── call-logger.ts
│   ├── settings-repository.ts
│   └── provider/            # 已有子目录，保留
│
├── project/                 # 项目管理 (已有，扩展)
│   ├── read-repository.ts
│   ├── mutation-repository.ts
│   ├── closure-status.ts
│   ├── scheduler-lifecycle.ts
│   ├── mcp-dispatch-service.ts
│   ├── targets.ts
│   ├── id.ts
│   └── write-schema.ts
│
├── auth/                    # 认证安全 (4 files)
│   ├── session.ts
│   ├── repository.ts
│   ├── csrf.ts
│   └── rate-limit.ts
│
├── settings/                # 配置管理 (4 files)
│   ├── agent-config.ts
│   ├── platform-config.ts
│   ├── llm-settings-write-schema.ts
│   └── scheduler-write-schema.ts
│
├── infra/                   # 基础设施 (6 files)
│   ├── prisma.ts
│   ├── prisma-transforms.ts
│   ├── api-handler.ts
│   ├── api-client.ts
│   ├── env-detector.ts
│   └── navigation.ts
│
├── analysis/                # 分析工具 (2 files)
│   ├── tool-output-summarizer.ts
│   └── failure-analyzer.ts
│
├── data/                    # 数据仓库 (6 files)
│   ├── approval-repository.ts
│   ├── asset-repository.ts
│   ├── evidence-repository.ts
│   ├── work-log-repository.ts
│   ├── runtime-artifacts.ts
│   └── approval-write-schema.ts
│
├── types/                   # 类型定义 (已有，保留)
├── compositions/            # 组合层 (已有，保留)
├── results/                 # 结果层 (已有，保留)
├── gateway/                 # 网关层 (已有，保留)
├── scheduler-control/       # 调度控制 (已有，保留)
├── generated/               # Prisma 生成 (不动)
│
├── prototype-types.ts       # 类型桶文件 (保留在根目录)
├── prototype-record-utils.ts # 记录工具 (保留在根目录)
└── utils.ts                 # cn() 工具 (保留在根目录)
```

### 迁移规则

1. 文件移动时**不重命名**（保留 `orchestrator-service.ts` 而非 `service.ts`），减少混淆
2. 所有 import 路径批量更新，例如：`@/lib/orchestrator-service` → `@/lib/orchestration/orchestrator-service`
3. tsconfig paths 中 `@/lib/*` 映射不变
4. 保留 lib/ 根目录下 3 个不好分类的小文件
5. 已有子目录（types/、compositions/、results/、gateway/、scheduler-control/、generated/）位置不变

### 已有子目录处理

| 子目录 | 文件数 | 处理 |
|--------|--------|------|
| `lib/types/` | 10 | 不动 |
| `lib/compositions/` | 4 | 不动 |
| `lib/results/` | 3 | 不动 |
| `lib/gateway/` | 2 | 不动（删除 dispatch-helpers.ts 后） |
| `lib/scheduler-control/` | 3 | 不动 |
| `lib/llm-provider/` | 3 | 移入 `lib/llm/provider/` |
| `lib/mcp-connectors/` | 9 | 移入 `lib/mcp/connectors/` |
| `lib/project/` | 2 | 扩展（接收根目录迁移的文件） |
| `lib/execution/` | 1 | 删除整个目录（文件全部是死代码） |
| `lib/generated/` | - | 不动 |

### 风险控制

- 每移一个领域就运行 `tsc --noEmit` 确认编译通过
- 全部完成后运行完整 vitest + playwright

---

## 涉及的 import 更新估计

约 150-200 个文件的 import 语句需要更新（app/ + components/ + lib/ + tests/）。

## 验收标准

- [ ] ~5000 行死代码已删除
- [ ] MCP 连接器从 1900 行缩减至 ~1200 行
- [ ] lib/ 根目录从 68 个文件减至 3 个
- [ ] `tsc --noEmit` 零错误
- [ ] vitest 全部通过（不含预存失败）
- [ ] playwright E2E 全部通过
- [ ] code_index.md、roadmap.md、readme.md 已更新
- [ ] `grep -rn "from.*@/lib/orchestrator-" app/ components/ lib/ tests/` 零结果（旧路径已清除）
