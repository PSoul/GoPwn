# Phase 20: 架构持续精简 + 二级模块拆分

## 背景

Phase 19 完成了三大单体文件的拆分（prototype-types.ts / prototype-api.ts / orchestrator-service.ts），净减 110 行代码，178 单元 + 14 E2E 全部通过。但平台仍有 6 个 500+ 行的文件需要治理，且部分新建模块（api-compositions.ts）本身已偏大。

当前平台状态：
- **数据层**: PostgreSQL via Prisma 7.x (`@prisma/adapter-pg`)，唯一数据层
- **测试**: 178 单元测试 + 14 E2E 测试全部通过（5 个 scheduler-controls 测试有顺序依赖预存问题，单独跑通过）
- **架构**: Phase 19 已拆分类型文件（10 个领域文件 + barrel）、消除 facade 层、编排器 5 模块化
- **MCP 工具**: 12 个本地 MCP 服务器（34+ 工具），通用 stdio 连接器
- **Docker 靶场**: DVWA (8081), Juice Shop (3000), WebGoat (18080/19090)，共 12 个
- **分支**: main 为当前分支，Phase 19 已合并

## 目标

### A. 二级模块拆分

对 Phase 19 遗留的大文件做第二轮拆分，目标是每个文件 < 400 行：

| 文件 | 当前行数 | 拆分思路 |
|------|----------|----------|
| `api-compositions.ts` | 780 | 按领域拆：project-compositions / settings-compositions / approval-compositions |
| `project-results-repository.ts` | 790 | 拆分：查询层 / 聚合层 / 报告导出 |
| `project-scheduler-control-repository.ts` | 533 | 拆分：CRUD / 状态机逻辑 |
| `mcp-gateway-repository.ts` | 485 | 拆分：MCP Run CRUD / 结果归一化 |
| `project-repository.ts` | 459 | 拆分：CRUD / 查询组合 |
| `mcp-scheduler-service.ts` | 439 | 可考虑是否需要拆分 |

### B. 测试稳定性修复

- 修复 `scheduler-controls-api.test.ts` 的 5 个测试顺序依赖问题（全量跑偶发失败，单独跑通过）
- 根因分析：是否为数据库清理不完全、或 test isolation 问题

### C. 代码质量扫描

- 扫描全库重复代码（相同函数在多个文件出现）
- 扫描未使用的导出（exported 但无人 import）
- 扫描过长函数（> 60 行的函数体）

### D. 路由层统一化（可选）

58 个 `app/api/**/route.ts` 中部分仍有内联业务逻辑，考虑：
- 提取为 thin handler 模式（route.ts 只做参数解析 + 调用 composition/service + 返回响应）
- 统一错误处理模式

## 技术约束

- 数据层只使用 Prisma，不回退文件存储
- 零功能变更 — 所有现有行为必须完全保留
- 每步独立可提交可验证
- 保持所有现有测试通过
- 不引入新依赖

## 开发指南

1. 开发前先新建分支 `feat/phase20-continued-refactoring`
2. 阅读 `code_index.md` 了解代码结构，`roadmap.md` 了解历史
3. 确保 PostgreSQL 运行：`cd docker/postgres && docker compose up -d`
4. 每步完成后运行：`npx tsc --noEmit && npx vitest run`
5. 全部完成后运行 E2E：`node scripts/run-playwright.mjs`
6. 完成后更新 `code_index.md` 和 `roadmap.md`
7. 注意使用 Context7/Tavily MCP 获取最新文档

## LLM 调试凭据

```
api_key=sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc
base_url=https://api.siliconflow.cn/
model=Pro/deepseek-ai/DeepSeek-V3.2
```

## 当前文件行数参考（> 200 行）

```
 780 lib/api-compositions.ts
 790 lib/project-results-repository.ts
 533 lib/project-scheduler-control-repository.ts
 485 lib/mcp-gateway-repository.ts
 459 lib/project-repository.ts
 439 lib/mcp-scheduler-service.ts
 439 lib/orchestrator-plan-builder.ts
 436 lib/orchestrator-execution.ts
 421 lib/orchestrator-service.ts
 349 lib/mcp-server-repository.ts
 321 lib/mcp-scheduler-repository.ts
 300 lib/approval-repository.ts
 289 lib/types/payloads.ts
 222 lib/auth-repository.ts
 208 lib/types/project.ts
```
