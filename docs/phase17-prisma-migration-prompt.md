# Phase 17: Prisma 数据库全量迁移

## 背景

当前平台使用文件系统 JSON 存储（`lib/prototype-store.ts`），所有数据（项目、用户、审批、资产、发现、日志等）都保存在 `.prototype-store/prototype-store.json` 单文件中。这种方式不支持并发写入、多实例部署和事务操作，是通向生产环境的最大技术债。

Prisma schema（`prisma/schema.prisma`）已定义 25+ 模型，但大部分业务代码仍直接调用 `readPrototypeStore()` / `writePrototypeStore()`。

## 目标

将所有数据访问从文件 JSON 存储迁移到 PostgreSQL（通过 Prisma ORM），使平台具备：
- 并发安全的数据读写
- 多实例部署能力
- 事务支持（如审批决策 + 项目状态更新原子操作）
- 数据库级别的查询和索引

## 实施策略

采用 **渐进式迁移**，每个 repository 文件逐一切换，确保每步可测试可回滚：

### 第一批（核心数据，影响最大）
1. `lib/auth-repository.ts` — 用户认证（已有 `UserRecord` 类型，对应 Prisma `User` 模型）
2. `lib/project-repository.ts` — 项目 CRUD（对应 `Project` 模型）
3. `lib/approval-repository.ts` — 审批记录（对应 `Approval` 模型）

### 第二批（执行数据）
4. `lib/mcp-execution-service.ts` — MCP 运行记录（对应 `McpRun` 模型）
5. `lib/mcp-scheduler-service.ts` — 调度任务（对应 `SchedulerTask` 模型）
6. `lib/llm-call-logger.ts` — LLM 调用日志（对应 `LlmCallLog` 模型）

### 第三批（辅助数据）
7. `lib/asset-repository.ts` — 资产数据
8. `lib/evidence-repository.ts` — 证据数据
9. `lib/project-results-repository.ts` — 发现/结论/报告

### 第四批（清理）
10. 删除 `lib/prototype-store.ts`（或降级为仅测试用）
11. 更新 `vitest.config.mts` 和测试 helper，使用 test database
12. 添加 `prisma/seed.ts` 数据库种子脚本

## 迁移模式（每个 repository）

```typescript
// 之前
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"

export function getProjectById(id: string) {
  const store = readPrototypeStore()
  return store.projects.find(p => p.id === id) ?? null
}

// 之后
import { prisma } from "@/lib/db"

export async function getProjectById(id: string) {
  return prisma.project.findUnique({ where: { id } })
}
```

**注意**：迁移后所有 repository 方法变为 `async`，调用方需要 `await`。API route 已经是 async，页面组件（server component）也支持 async。

## 环境准备

```bash
# 启动 PostgreSQL
docker compose up -d db

# 执行 Prisma 迁移
npx prisma migrate dev --name init

# 生成 Prisma Client
npx prisma generate
```

## 关键文件

| 文件 | 说明 |
|------|------|
| `prisma/schema.prisma` | 数据库 schema（已定义） |
| `lib/db.ts` | Prisma Client 单例 |
| `lib/prototype-store.ts` | 当前文件存储（迁移后删除或降级） |
| `lib/auth-repository.ts` | 用户认证（第一个迁移） |
| `lib/project-repository.ts` | 项目 CRUD |
| `lib/approval-repository.ts` | 审批记录 |

## 验收标准

- [ ] 所有 repository 方法使用 Prisma 而非 prototype-store
- [ ] `npx prisma migrate dev` 成功创建所有表
- [ ] 所有 API 测试通过（使用测试数据库）
- [ ] E2E 测试通过
- [ ] `prototype-store.ts` 可安全删除或仅保留为测试 fallback
- [ ] 数据库种子脚本工作正常

## LLM 调试配置

```
api_key=sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc
base_url=https://api.siliconflow.cn/
model=Pro/deepseek-ai/DeepSeek-V3.2
```

## 开发约定

1. 开发前先新建分支 `feat/phase17-prisma-migration`
2. 完成后更新 `code_index.md` 和 `roadmap.md`
3. 在 `.gitignore` 中忽略 `.txt` 后缀文件
4. 进行完整的 API 测试和 E2E 测试
5. 如有必要，提供下一阶段的 prompt
