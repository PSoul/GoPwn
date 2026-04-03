# 开发指南

> 最后更新: 2026-04-02

---

## 环境搭建

### 前置要求
- Node.js 22+
- PostgreSQL 16（Docker 或本地）
- pnpm（包管理器）

### 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 启动 PostgreSQL
cd docker/postgres && docker compose up -d

# 3. 数据库迁移
npx prisma db push

# 4. 种子数据
npx tsx scripts/db/seed-database.ts

# 5. 启动开发服务器（注意端口）
PORT=3001 npx next dev    # 3000 可能被 Juice Shop 占用

# 6. 启动 Docker 靶场（可选）
cd docker/local-labs && docker compose up -d
```

### 环境变量 (.env.local)

```bash
# 数据库
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/llmpentest"

# LLM 配置
LLM_PROVIDER=openai-compatible
LLM_API_KEY=sk-xxxx
LLM_BASE_URL=https://api.openai.com/v1
LLM_ORCHESTRATOR_MODEL=gpt-4
LLM_TIMEOUT_MS=180000

# E2E 测试模式（跳过 CSRF 检查）
E2E_TEST_MODE=true

# HTTP 代理（可选）
HTTP_PROXY=http://127.0.0.1:7890
```

---

## 项目结构

```
app/                 Next.js 页面和 API 路由
├── (console)/       控制台页面（需登录）
├── api/             48 个 API 路由
└── login/           登录页
components/          React 组件（100+）
lib/                 核心业务逻辑（70+ 文件）
├── compositions/    聚合查询层
├── execution/       MCP 执行引擎
├── gateway/         MCP 调度网关
├── llm-provider/    LLM 客户端
├── mcp-connectors/  MCP 连接器
├── project/         项目 repository
├── results/         结果 repository
├── scheduler-control/ 调度控制
└── types/           TypeScript 类型定义
mcps/                14 个本地 MCP 服务器
prisma/              数据库 schema
tests/               单元测试（67 文件）
e2e/                 E2E 测试（2 套件）
docker/              Docker 基础设施
docs/                文档
scripts/             工具脚本
```

---

## 测试

### 单元测试
```bash
npx vitest run                  # 全部
npx vitest run tests/lib/       # 仅 lib 层
npx vitest run --reporter=verbose  # 详细输出
```

### E2E 测试
```bash
# 需要 Next.js 服务器运行中
PLAYWRIGHT_WEB_PORT=3001 npx playwright test
PLAYWRIGHT_WEB_PORT=3001 npx playwright test --ui  # 可视化模式
```

### 测试约定
- API 测试: `tests/api/*.test.ts`
- Lib 测试: `tests/lib/*.test.ts`
- 页面测试: `tests/pages/*.test.ts`
- 辅助工具: `tests/helpers/prisma-test-utils.ts`
- 环境隔离: 部分测试使用 `// @vitest-environment node`

---

## 关键开发约定

### 代码风格
- TypeScript strict mode
- ES modules（`import/export`）
- 函数声明优先于箭头函数
- 显式返回类型注解
- React 组件使用显式 Props 类型

### Repository 模式
- 所有数据访问通过 `*-repository.ts`
- 返回领域对象（非 Prisma 原始模型）
- `prisma-transforms.ts` 做 DB ↔ Domain 双向转换

### Prompt 工程
- **绝不**在 prompt 中包含具体代码示例
- **绝不**包含靶场特定路径或 payload
- 只教通用方法论，让 LLM 自主思考

### MCP 连接器
- 实现 `McpConnector` 接口：`supports(context)` + `execute(context)`
- 通过 registry 注册
- fallback 脚本只做通用探测，不含靶场特定逻辑

---

## 新增 MCP 工具流程

1. 在 `mcps/` 下创建新服务器目录
2. 实现 `index.mjs`（stdio JSON-RPC 接口）
3. 启动项目时自动发现（`discoverAndRegisterMcpServers()`）
4. 或手动注册：`POST /api/settings/mcp-servers/register`
5. 在 `platform-config.ts` 中配置 capability 映射

---

## 数据库操作

```bash
# 查看当前 schema
npx prisma studio

# 修改 schema 后推送
npx prisma db push

# 生成 Prisma client
npx prisma generate

# 重置数据库
npx prisma db push --force-reset
npx tsx scripts/db/seed-database.ts
```
