# Phase 9 Prompt: Real Project Closure and New MCP Families

你正在接手一个基于 Next.js 15 App Router 的授权渗透测试平台原型。当前代码已经完成以下基础：

- 运行时默认空白，不再注入 demo 项目 / demo 资产 / demo 证据 / demo MCP server
- `/settings/llm` 已改为真实持久化配置，运行时遵循 `prototype-store` 优先、环境变量兜底
- `/settings/mcp-tools` 已支持严格 MCP 合同注册，注册通过后会写入 SQLite server 注册表和 JSON store 合同摘要
- 已有真实 Web stdio MCP 路径和真实 LLM 本地验证链路
- `npx vitest run`、`npm run lint`、`npm run build`、`npm run e2e` 当前可通过

## 本阶段目标

把“真实本地靶场验证”从一次性的技术演示，推进成“真实创建项目 -> 真实执行 -> 真实结果沉淀 -> 正常页面可见”的完整闭环；同时新增至少一个真实 MCP 家族。

## 必读文件

1. `code_index.md`
2. `roadmap.md`
3. `docs/contracts/mcp-server-contract.md`
4. `docs/operations/mcp-onboarding-guide.md`
5. `docs/templates/mcp-connector-template.md`

## 必做事项

1. 创建一个“真实验证项目 bootstrap”能力
   - 不允许依赖旧 demo 项目 ID
   - 执行本地验证前，必须先真实创建项目
   - 后续所有资产 / 证据 / 发现 / 工作日志都必须落到这个真实项目上

2. 改造 `npm run live:validate`
   - 不再默认使用旧 seed project
   - 运行时应自动创建或接收一个真实项目
   - 输出报告中必须包含真实项目 ID、项目名称、结果摘要、证据数量、发现数量

3. 再新增一个真实 MCP 家族
   候选优先级：
   - `HTTP / API 结构发现类`
   - `截图与证据采集类`

4. 补全测试
   - API 测试
   - 集成测试
   - 必要时新增 E2E
   - 如有真实本地靶场链路，保留真实测试结果并确保 UI 可见

5. 更新文档
   - `code_index.md`
   - `roadmap.md`
   - 如新增合同或注册规范，更新相应 docs

## 约束

- 不要恢复任何 runtime demo 数据
- 保持 `LLM = 大脑`, `MCP = 四肢`
- 所有新 MCP 注册必须遵循现有合同校验
- 继续使用独立分支 / worktree
- 如需搜索文档，优先使用 Context7 和官方资料

## 验收标准

- 干净环境下可以创建真实项目并完成一次本地靶场闭环
- 结果能在普通项目页面中看到，而不是只在脚本产物中看到
- 至少一个新真实 MCP 家族完成接入并可调度
- `npx vitest run`
- `npm run lint`
- `npm run build`
- `npm run e2e`
