# Phase 11 Prompt: Host Platform Runtime Bridge And Hardening

你正在继续开发仓库 `D:\dev\llmpentest0326`。

这是“宿主平台仓库”，不是协议模板仓，也不是具体 MCP server 的实现仓。

它是一个授权渗透测试平台原型，核心边界是：

- `LLM = 大脑`
  - 负责计划、编排、审阅、解释、风险判断
- `MCP = 四肢`
  - 负责接触目标、执行外部动作、采集证据、回传结构化结果
- `宿主平台本身`
  - 负责项目、审批、调度、落库、结果归一化、审计、UI/API 展示

与它配套的协议标准源在：

- `D:\dev\llmpentest-mcp-template`

以后新增 MCP server，默认应先对照模板仓完成合同对齐，再在独立实现仓库开发，最后回本仓库补最小桥接。

## 开始前先阅读

1. `README.md`
2. `code_index.md`
3. `roadmap.md`
4. `docs/contracts/mcp-server-contract.md`
5. `docs/operations/standalone-mcp-scaffold-workflow.md`
6. `docs/operations/local-docker-labs.md`
7. `docs/operations/llm-settings.md`

## 当前状态

当前宿主平台已经具备：

- 登录、项目 CRUD、审批、设置、资产、证据、finding 展示
- 项目生命周期控制：`idle / running / paused / stopped`
- MCP Server 严格注册合同与工具持久化
- 调度队列、审批恢复、durable worker lease、orphan running task 恢复
- cooperative cancellation
- 真实 `Web 页面探测类`
- 真实 `HTTP / API 结构发现类`
- 真实 `受控验证类`
- 真实 `截图与证据采集类`
- 本地 `Juice Shop` 与 `WebGoat` 真实闭环验证

## 你的目标

不要把这个仓库重新变成“新增 MCP server 的出生地”。

这个仓库下一阶段的重点应是：

- 宿主平台运行时继续变 durable
- 宿主平台与模板合同、独立实现产物之间的桥接更稳定
- 结果归一化、调度、诊断、配置管理更成熟

## 优先顺序

1. 把当前 file-backed / mixed persistence 进一步往更 durable 的运行时形态推进
   - 调度状态
   - 执行租约
   - 运行中任务恢复
   - 长会话下的稳定性
2. 补强同能力族多工具并存时的“确定性选型”
   - 避免只靠 `requestedAction` 文本打分
   - 增加显式首选 tool binding 或更稳定的路由策略
3. 硬化 `/settings/llm`
   - `apiKey` 掩码
   - 连通性校验
   - 保存前校验
   - 更清晰的 fallback 行为
4. 补 `live:validate` 与本地靶场闭环诊断
   - 把截图与证据采集也纳入更稳定的固定回归链路
   - 改善 lab 健康检查与环境阻塞提示
5. 只有当模板仓定义了新能力族、而宿主平台当前无法接住时，再回本仓库补：
   - capability 枚举
   - connector
   - 结果归一化
   - UI/API 展示

## 约束

- 不要在本仓库里直接孵化新的独立 MCP server，除非它是宿主平台内部必需的 built-in 能力
- 保持 `LLM = 大脑 / MCP = 四肢` 的边界清晰
- 所有面向其他 LLM 的文档都要从 0 可读，不要假设读者知道前面对话
- 完成后更新：
  - `README.md`
  - `roadmap.md`
  - `code_index.md`
- 如涉及代码改动，完成后至少验证：
  - `npm run test`
  - `npm run build`
  - `npm run e2e`

## 交付物

- 平台侧运行时或桥接硬化改动
- 对应测试
- 更新后的中文文档
- 清晰说明：
  - 哪些问题应继续留在宿主平台仓库处理
  - 哪些问题应转到 `D:\dev\llmpentest-mcp-template` 或独立实现仓库
  - 当前是否需要新增 capability enum、connector 或归一化路径
