# 开发指南

> 最后更新: 2026-04-05

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

### 环境变量 (.env)

```bash
# 数据库
DATABASE_URL="postgresql://pentest:pentest@localhost:5432/pentest?schema=public"

# LLM 配置
LLM_PROVIDER=openai-compatible
LLM_API_KEY=sk-xxxx
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_ORCHESTRATOR_MODEL=qwen3.6-plus
LLM_TIMEOUT_MS=300000    # 推理模型建议 5 分钟

# HTTP 代理（可选，用于访问外部 LLM API）
# HTTPS_PROXY=http://127.0.0.1:7890
```

---

## 项目结构

```
app/                 Next.js 页面和 API 路由
├── (console)/       控制台页面（需登录）
├── api/             48 个 API 路由
└── login/           登录页
components/          React 组件（100+）
lib/                 核心业务逻辑
├── workers/         后台任务 worker
│   ├── react-worker.ts        ReAct 轮次执行主循环
│   ├── react-context.ts       轮次上下文构建与管理
│   ├── analysis-worker.ts     工具输出分析与失败诊断
│   ├── verification-worker.ts 漏洞验证 worker
│   └── lifecycle-worker.ts    项目生命周期状态机
├── llm/             LLM prompt 工程与调用
│   ├── react-prompt.ts        ReAct 循环 system/user prompt 构建
│   ├── function-calling.ts    function calling 定义与响应解析
│   ├── tool-input-mapper.ts   LLM 函数参数 → MCP 工具输入映射
│   ├── prompts.ts             审阅者、分析器等专项 prompt
│   ├── provider.ts            LLM provider 接口定义
│   ├── openai-provider.ts     OpenAI-compatible 客户端实现
│   ├── call-logger.ts         LLM 调用日志记录
│   ├── system-prompt.ts       基础 system prompt 模板
│   └── index.ts               统一导出
├── domain/          领域规则与策略
│   ├── lifecycle.ts           生命周期状态与转换规则
│   ├── phases.ts              渗透测试阶段定义
│   ├── risk-policy.ts         风险等级策略
│   ├── errors.ts              领域错误类型
│   └── scope-policy.ts        目标范围校验策略
├── hooks/           React 自定义 Hooks
│   ├── use-project-events.ts  订阅项目 SSE 事件流
│   └── use-react-steps.ts     获取并订阅 ReAct 步骤数据
├── auth/            认证与会话管理
├── compositions/    聚合查询层
├── data/            资产/证据/审批/工作日志 repository
├── gateway/         MCP 调度网关
├── infra/           基础设施（Prisma、API handler、local-lab）
├── mcp/             MCP 注册、执行引擎、调度器
├── mcp-connectors/  MCP 连接器实现
├── project/         项目 repository 与结果
├── settings/        配置管理（agent-config、LLM schema）
└── types/           TypeScript 类型定义
mcps/                14 个本地 MCP 服务器
prisma/              数据库 schema
tests/               单元测试
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

### 测试文件位置

Worker 单元测试位于 `tests/lib/workers/`：

| 文件 | 说明 |
|------|------|
| `analysis-worker.test.ts` | 工具输出分析逻辑测试 |
| `lifecycle-worker.test.ts` | 生命周期状态机转换测试 |
| `verification-worker.test.ts` | 漏洞验证流程测试 |
| `_helpers.ts` | 共享测试辅助工具（mock 工厂、fixtures） |

其他测试约定：
- API 测试: `tests/api/*.test.ts`
- 页面测试: `tests/pages/*.test.ts`
- 环境隔离: 部分测试使用 `// @vitest-environment node`

---

## ReAct 开发说明

### ReAct 执行流程概览

平台采用 ReAct（Reason + Act）模式驱动渗透测试，核心入口为 `lib/workers/react-worker.ts`：

1. `lifecycle-worker.ts` 监听生命周期变化，`running` 状态下触发 `react_round` 任务
2. `react-worker.ts` 启动轮次主循环，通过 `react-context.ts` 构建当前上下文（历史步骤、资产、发现）
3. `lib/llm/react-prompt.ts` 生成本轮 system/user prompt，`function-calling.ts` 定义可用工具的 function schema
4. LLM 返回 tool call → `tool-input-mapper.ts` 将参数映射为 MCP 执行输入 → MCP 网关执行 → 结果回写
5. 循环重复直到 LLM 调用 `done` 控制函数或达到最大步骤数（默认 30）
6. `analysis-worker.ts` 在必要时对工具输出进行深度分析

### 新增 ReAct 可用工具

在 `lib/llm/function-calling.ts` 中注册新的 function schema，参考已有工具的定义格式。`tool-input-mapper.ts` 负责将 function 参数映射为具体 MCP 调用参数，两处均需同步更新。

### 调试 ReAct 步骤

每个步骤执行后会写入 McpRun 记录（含 `stepIndex`、`thought`、`functionArgs`），可通过以下方式查看：

```bash
# API 查询
GET /api/projects/{id}/rounds/{round}/steps

# 实时监听（推荐开发调试时使用）
GET /api/projects/{id}/events
```

前端订阅步骤更新使用 `lib/hooks/use-react-steps.ts`，该 hook 内部结合 SSE（`use-project-events.ts`）实现实时刷新。

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
5. 在 `lib/llm/function-calling.ts` 中添加对应的 function schema，使 LLM 可在 ReAct 循环中调用

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
