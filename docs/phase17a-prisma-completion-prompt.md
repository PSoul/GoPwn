# Phase 17a 收尾：Prisma 数据层验证与集成测试

## 背景

Phase 17a 已完成 Prisma 数据层迁移的代码实现部分：
- 13 个 repository 文件全部 async 化 + Prisma 双路径（`DATA_LAYER=prisma` 启用）
- prototype-api.ts、48 个 API routes、21 个 page 组件、所有 service 文件已完成 async 传播
- prisma-transforms.ts 实现了 20+ 模型的双向转换
- prisma/seed.ts 数据迁移脚本已编写
- `npm run build` 通过，文件存储模式下 183/191 测试通过

## 本阶段目标

完成 Prisma 数据层的实际数据库验证和集成测试。

## 前置条件

- 已安装 Docker Desktop 并可运行
- PostgreSQL 容器可启动

## 任务清单

### 1. 启动 PostgreSQL 容器
```bash
docker compose -f docker/postgres/compose.yaml up -d
```
确认容器正常运行，数据库可连接。

### 2. 数据库 Schema 推送
```bash
npx prisma db push
```
确认 25 个模型全部创建成功。

### 3. 数据迁移
```bash
npx tsx prisma/seed.ts
```
从 `.prototype-store/prototype-store.json` 迁移所有现有数据到 PostgreSQL。
验证：对比迁移前后记录数。

### 4. 设置环境变量启用 Prisma
在 `.env` 中添加/修改：
```
DATA_LAYER=prisma
DATABASE_URL=postgresql://pentest:pentest_dev_2026@localhost:5432/llmpentest?schema=public
```

### 5. 功能测试
```bash
npm run test
npm run build
```
在 `DATA_LAYER=prisma` 模式下确保：
- Build 通过
- 单元测试通过率与文件存储模式一致
- 关键 API 端点（项目创建、审批、MCP 调度）正常工作

### 6. 修复测试失败

当前已知的测试问题：
- `tests/api/approval-controls-api.test.ts` — 审批决策持久化测试
- `tests/api/orchestrator-api.test.ts` — 编排器审批流程测试
- 上述测试可能需要在 Prisma 模式下调整 mock 或测试数据设置

对于每个失败的测试：
1. 分析失败原因（是 async/await 遗漏、Prisma 类型不匹配还是测试设置问题）
2. 修复并验证

### 7. E2E 测试
```bash
npm run e2e
```
在 Prisma 模式下运行完整 E2E 流程。

### 8. Prisma Studio 验证
```bash
npx prisma studio
```
手动检查数据完整性。

### 9. 清理（可选）

如果 Prisma 模式完全验证通过：
- 考虑移除 `readPrototypeStore()` / `writePrototypeStore()` 的文件 I/O 代码
- 移除 `DATA_LAYER` 切换逻辑，使 Prisma 成为唯一数据层
- 更新 README 说明数据库依赖

## 验收标准

- [ ] PostgreSQL 容器正常运行
- [ ] `npx prisma db push` 成功创建所有表
- [ ] `npx tsx prisma/seed.ts` 成功迁移数据
- [ ] `DATA_LAYER=prisma` 模式下 `npm run build` 通过
- [ ] `DATA_LAYER=prisma` 模式下测试通过率 >= 文件存储模式
- [ ] E2E 测试通过
- [ ] 手动烟雾测试：创建项目 → 派发 MCP → 审批 → 调度器生命周期正常

## 注意事项

- 当前使用 `@prisma/adapter-pg` (Prisma 7.x 要求)
- `prisma.config.ts` 配置了 datasource URL
- `lib/mcp-server-repository.ts` 中的 MCP 服务器调用记录仍使用独立 SQLite (无 Prisma 模型)，这是有意设计
- 如有必要，更新 `docs/code_index.md` 和 `docs/roadmap.md`
