# LLM 渗透测试平台原型

一个以 `LLM = 大脑`、`MCP = 四肢` 为核心边界的本地原型平台。

当前版本已经具备：

- 模板风格统一的控制台前端
- Next.js 内置 API 后端
- 本地持久化项目/资产/证据/发现/审批/日志
- MCP 工具注册、调度、审批恢复、结果沉淀
- OpenAI-compatible LLM 配置与真实编排接入
- 本地 Docker 靶场闭环验证

## 当前版本

- 版本号：`v0.1.0`
- 当前形态：可运行的全栈原型，已完成一条真实 `Juice Shop` 本地闭环验证

## 核心设计

- `LLM`
  - 负责规划、编排、审阅、解释
- `MCP`
  - 负责接触目标、执行探测、采集证据、回传结构化结果
- `平台内部`
  - 负责审批、调度、归一化、结果聚合、状态推进、日志审计

## 主要能力

- 登录页、仪表盘、项目管理、审批中心、资产中心、证据中心、系统设置
- 项目详情拆分为结果、阶段流转、任务与调度、证据与上下文等子页
- MCP 注册合同校验
- MCP Server 元数据与调用日志持久化
- LLM 配置持久化，支持 `apiKey`、`baseUrl`、`model`、`timeoutMs`、`temperature`
- 本地靶场编排验证与结果沉淀

## 技术栈

- `Next.js 15`
- `React 19`
- `TypeScript`
- `Tailwind CSS`
- `Vitest`
- `Playwright`
- `@modelcontextprotocol/sdk`

## 目录说明

- `app/`
  - 页面与 API 路由
- `components/`
  - UI 组件与业务组件
- `lib/`
  - 仓储层、调度、编排、MCP、LLM、类型定义
- `scripts/`
  - E2E 与真实联调脚本
- `docker/local-labs/`
  - 本地漏洞靶场
- `docs/`
  - 合同、操作文档、路线图、交接 prompt
- `tests/`
  - API / 组件 / 仓储测试
- `e2e/`
  - 浏览器端到端测试

## 启动方式

先安装依赖：

```powershell
npm install
```

启动开发环境：

```powershell
npm run dev
```

默认访问：

- 控制台：`http://127.0.0.1:3000`
- 登录页：`http://127.0.0.1:3000/login`

当前默认测试账号：

- 账号：`researcher@company.local`
- 密码：`Prototype@2026`
- 验证码：`7K2Q`

## 常用命令

```powershell
npm run test
npm run lint
npm run build
npm run e2e
npm run test:all
```

## 本地靶场闭环验证

启动本地靶场：

```powershell
docker compose -f docker/local-labs/compose.yaml up -d
```

配置真实 LLM：

```powershell
$env:LLM_API_KEY = "你的 key"
$env:LLM_BASE_URL = "https://api.siliconflow.cn/"
$env:LLM_ORCHESTRATOR_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
$env:LLM_REVIEWER_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
```

执行真实闭环：

```powershell
npm run live:validate
```

更多参数说明见：

- `docs/operations/local-docker-labs.md`
- `docs/operations/llm-settings.md`
- `docs/operations/mcp-onboarding-guide.md`

## 文档入口

建议阅读顺序：

1. `README.md`
2. `code_index.md`
3. `roadmap.md`

重点文档：

- `code_index.md`
  - 代码索引，便于其他 LLM 快速接手
- `roadmap.md`
  - 当前阶段、已完成项、下一阶段建议
- `docs/contracts/mcp-server-contract.md`
  - MCP 注册合同
- `docs/templates/mcp-connector-template.md`
  - 新 MCP 接入模板

## 当前状态说明

当前主线已经完成：

- 真实 LLM 设置持久化
- 严格 MCP 注册
- 空数据优先运行时
- 真实 `Juice Shop` 闭环验证
- 全量测试通过

仍建议后续继续推进：

- 新 MCP 能力族接入
- 更完整的 durable queue / cancellation
- `WebGoat` 第二靶场闭环验证
- 真实登录态用户信息渲染

## 备注

- `output/` 与 `.prototype-store/` 属于运行产物，不应作为正式源码的一部分提交
- `.txt` 已加入 git ignore
- 当前仓库更偏“可运行原型 + 后续开发底座”，还不是生产版本
