# LLM 渗透测试平台原型

一个面向授权安全测试场景的本地全栈原型平台。

本项目的核心边界是：

- `LLM = 大脑`
  - 负责计划、编排、审阅、解释、风险判断
- `MCP = 四肢`
  - 负责接触目标、调用外部工具、采集证据、回传结构化结果
- `平台本身`
  - 负责审批、调度、持久化、结果归一化、审计、状态推进

当前仓库已经不再是纯前端静态原型，而是一个可运行的 `Next.js + API + 本地持久化 + MCP 注册/调度 + 真实 LLM 接入 + 本地靶场验证` 的全栈原型底座。

## 1. 当前状态

- 当前版本：`v0.2.2`
- 当前形态：可运行全栈原型
- 版本定位：第二阶段原型里程碑，重点补齐了 `WebGoat` 真实 finding 闭环、项目生命周期控制、durable worker、cooperative cancellation，以及“项目自动收束到报告与最终结论”的闭环
- 当前主线：已完成 `Juice Shop` 与 `WebGoat` 两条本地真实闭环验证
- 当前进行中：主线已收敛到 `v0.2.2` 基线；新增 MCP 将优先迁移到独立脚手架仓库中开发，平台主仓库继续负责运行时、调度、审批、结果沉淀和项目收束

### 已完成的核心能力

- 模板风格对齐的控制台前端与登录页
- `Next.js App Router` 页面层与内置 API 层
- 平台账号登录、会话保护、中间件鉴权
- 项目、审批、资产、证据、审计日志、本地设置持久化
- 项目详情拆分为结果、阶段流转、任务与调度、证据与上下文子页
- 项目生命周期状态机：`idle / running / paused / stopped`
- 新建项目后默认不自动运行，必须手动点击开始才会触发 LLM 编排
- 项目支持 `开始 / 暂停 / 继续 / 停止`，且停止后不可重新开始
- 项目开始后会在队列跑空时自动补一次报告导出，并生成持久化的“最终结论”
- 审批通过后不再只恢复单个 MCP run，而是会继续推进项目后续动作并判断是否可以自动收束
- 项目最终结论已经成为正式持久化模型，会回流到项目概览、报告导出面板和项目状态
- LLM 编排增加了范围约束，URL 指向 IP / localhost 时不会再误派 `DNS / 子域 / 证书情报类` 动作
- 真实 LLM 设置页面与持久化配置
- 严格 MCP Server 注册合同与字段校验
- MCP Server 元数据、调用日志、工具注册持久化
- 项目级 MCP 调度、审批暂停、审批恢复、结果沉淀
- LLM 编排大脑提示词集中管理，项目启动、恢复、本地靶场计划都走统一提示词构建
- Durable worker lease、orphan running task 恢复
- Cooperative cancellation，支持停止已经运行中的任务
- 本地 Docker 靶场验证链路
- 平台内置基础 MCP 工具兜底（`seed-normalizer`、`report-exporter`）
- 项目操作页内的真实报告导出闭环
- 真实 `HTTP / API 结构发现类` stdio MCP
- 真实 `HTTP / API 结构发现类` 结果归一化落库，能把 GraphQL / Swagger / Actuator 候选入口沉淀成资产与证据
- 真实 `受控验证类` HTTP workbench stdio MCP
- 真实 `截图与证据采集类` Playwright stdio MCP
- 真实页面截图与 HTML 快照 artifact 持久化，以及带会话校验的 artifact 读取 API
- 证据详情页支持直接预览截图并打开 HTML 快照

### 已确认跑通的真实闭环

- `真实 LLM -> 编排计划 -> MCP 调度 -> 审批阻塞/恢复 -> 资产/证据/发现沉淀`
- 已通过的样例：`Juice Shop`
- 对应真实项目：`proj-20260327-f6a3fd0c`
- 对应报告目录：`output/live-validation/2026-03-27T05-09-27-704Z-juice-shop/`
- 已通过的样例：`WebGoat`（低风险识别闭环）
- 对应真实项目：`proj-20260327-c98173af`
- 对应报告目录：`output/live-validation/2026-03-27T10-36-16-464Z-webgoat/`
- 浏览器级导出截图：`output/playwright/webgoat-operations-report-export.png`
- 已通过的样例：`WebGoat`（真实 finding / 报告导出闭环）
- 对应真实项目：`proj-20260327-4e3a91b0`
- 对应报告目录：`output/live-validation/2026-03-27T11-12-11-708Z-webgoat/`
- 浏览器级 finding 截图：`output/playwright/webgoat-findings-page.png`
- 浏览器级导出截图：`output/playwright/webgoat-operations-report-export-after-finding.png`
- 已通过的样例：`WebGoat`（结构发现证据增强后的复验闭环）
- 对应真实项目：`proj-20260327-af2ebd69`
- 对应报告目录：`output/live-validation/2026-03-27T11-38-59-701Z-webgoat/`
- 关键证据标题：`Web 入口与响应特征识别`、`HTTP / API 结构线索识别`、`Spring Actuator 管理端点匿名暴露`

### 当前主要缺口

- 后端持久化仍有一部分在文件存储层，尚未完全演进到更 durable 的长期运行形态
- LLM 设置目前为了调试仍是明文展示，后续要补掩码、连通性校验与更强的配置治理
- 当前的 LLM 控制仍以“按次生成计划 + 队列跑空后收束”为主，还不是长期常驻的状态化控制环
- 本地靶场健康状态、runner 诊断、页面提示还没有完全统一
- 现有 E2E 已覆盖主要页面，但还缺“从手动开始到自动收束”的浏览器级专项回归
- 已完成项目、阻塞项目、待审批项目的运行态诊断还需要继续细化，避免操作者只看到状态名却不知道下一步该做什么

## 2. 适合谁看

这个 README 主要服务三类角色：

- 想立刻启动项目并体验当前原型的人
- 想接手继续开发的平台工程师
- 想快速理解仓库结构、继续推进开发的其他 LLM

如果你是后两者，建议阅读顺序：

1. `README.md`
2. `code_index.md`
3. `roadmap.md`

## 3. 技术栈

- `Next.js 15`
- `React 19`
- `TypeScript`
- `Tailwind CSS`
- `Vitest`
- `Playwright`
- `@modelcontextprotocol/sdk`

## 4. 仓库结构

- `app/`
  - 页面与 API 路由
- `components/`
  - 业务 UI 组件
- `lib/`
  - 仓储、调度、编排、MCP、LLM、类型与服务层
- `scripts/`
  - E2E、真实联调、live validation 脚本
- `docker/local-labs/`
  - 本地漏洞靶场定义
- `docs/`
  - 合同、操作文档、路线图、设计与阶段 prompt
- `tests/`
  - API / 组件 / 服务层测试
- `e2e/`
  - 浏览器端到端测试

## 5. 快速启动

### 安装依赖

```powershell
npm install
```

### 启动开发环境

```powershell
npm run dev
```

默认访问地址：

- 平台首页：`http://127.0.0.1:3000`
- 登录页：`http://127.0.0.1:3000/login`

### 当前使用方式说明

1. 登录平台
2. 新建项目，只填写项目名称、目标、项目说明
3. 进入项目后先查看概览和结果子页
4. 需要手动点击“开始项目”，平台才会把目标交给 LLM 生成首轮计划并驱动 MCP 调度
5. 运行中可以暂停、继续，停止后项目进入终态，不能重新开始
6. 当当前轮次队列跑空、没有待审批动作时，平台会自动补一次报告导出并生成最终结论

### 默认测试账号

- 账号：`researcher@company.local`
- 密码：`Prototype@2026`
- 验证码：`7K2Q`

## 6. 常用命令

```powershell
npm run dev
npm run test
npm run lint
npm run build
npm run e2e
npm run test:all
npm run live:validate
```

## 7. 真实 LLM 配置

当前平台支持在 `/settings/llm` 中直接配置：

- `apiKey`
- `baseUrl`
- `model`
- `timeoutMs`
- `temperature`
- `enabled`

当前为了调试方便，`apiKey` 仍然以明文方式展示；后续会增加掩码模式与显隐切换。

如果希望通过环境变量进行 live validation，也可以这样设置：

```powershell
$env:LLM_API_KEY = "你的 key"
$env:LLM_BASE_URL = "https://api.siliconflow.cn/v1"
$env:LLM_ORCHESTRATOR_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
$env:LLM_REVIEWER_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2"
```

## 8. 本地靶场与真实闭环验证

### 启动靶场

```powershell
docker compose -f docker/local-labs/compose.yaml up -d
```

### 查看靶场状态

```powershell
docker compose -f docker/local-labs/compose.yaml ps
```

### 执行真实闭环

```powershell
npm run live:validate
```

常用环境变量：

```powershell
$env:LIVE_VALIDATION_LAB_ID = "juice-shop"
$env:LIVE_VALIDATION_PROJECT_ID = ""
$env:LIVE_VALIDATION_AUTO_APPROVE = "1"
$env:LIVE_VALIDATION_START_LABS = "1"
$env:LIVE_VALIDATION_STOP_LABS = "0"
$env:LIVE_VALIDATION_STATE_MODE = "isolated"
```

状态持久化模式：

- `isolated`
  - 默认模式
  - 每次跑独立 store，不污染当前工作区
- `workspace`
  - 真实项目、资产、证据、发现直接保留到当前工作区 `.prototype-store/`
  - 适合在正常页面里持续查看结果

### 当前真实验证结论

- `Juice Shop`
  - 已真实跑通
- `WebGoat`
  - 已确认宿主机 `127.0.0.1:18080/WebGoat` 与 `127.0.0.1:18080/WebGoat/actuator/health` 可达
  - 当前仓库默认通过 `18080:8080` 与 `19090:9090` 规避原 `8080` 占用问题
  - 已完成低风险真实闭环，结果已沉淀到普通项目页，并已在项目操作页完成一次浏览器级报告导出

## 9. MCP 接入原则

当前平台已经具备严格的 MCP 注册合同校验能力，新接入的 MCP 必须先通过合同验证，才能进入平台调度候选池。

本仓库的宿主合同以 `D:\dev\llmpentest-mcp-template` 为协议标准源。

当前建议流程是：

- 先对照 `D:\dev\llmpentest-mcp-template` 完成协议自检
- 再在独立实现仓库或专门工作目录开发具体 MCP server
- 最后把注册 JSON 回填到 `/settings/mcp-tools`

建议优先阅读：

- `docs/contracts/mcp-server-contract.md`
- `docs/templates/mcp-connector-template.md`
- `docs/operations/mcp-onboarding-guide.md`
- `docs/operations/standalone-mcp-scaffold-workflow.md`

当前合同重点约束：

- 宿主当前接受模板定义的 `12` 个能力族、`8` 种结果映射和 `3` 种边界类型
- `serverName`、`version`、`transport`、`enabled`、`tools` 是顶层必填
- `endpoint`、`notes` 可省略，宿主持久化时会统一归一为空字符串
- `tools[]` 中必须显式声明能力族、风险等级、审批要求、结果映射
- `inputSchema` 和 `outputSchema` 都必须显式声明
- 新工具不能只“能调用”，还必须“能被平台理解并落库”
- 并非所有模板能力都已经完成运行时桥接；当前主仓优先保证“可注册、可校验、可说明”

## 10. 文档入口

重点文档如下：

- `code_index.md`
  - 全量代码索引，便于其他 LLM 快速接手
- `roadmap.md`
  - 当前阶段、已完成事项、后续优先级
- `docs/operations/local-docker-labs.md`
  - 本地 Docker 靶场与 live validation 操作文档
- `docs/operations/llm-settings.md`
  - LLM 设置页面与 API 说明
- `docs/contracts/mcp-server-contract.md`
  - MCP Server 注册合同
- `docs/templates/mcp-connector-template.md`
  - MCP 接入模板
- `docs/operations/standalone-mcp-scaffold-workflow.md`
  - 如何围绕协议模板仓、宿主仓和独立实现仓协同开发新 MCP
- `docs/prompts/2026-03-28-phase-11-platform-runtime-bridge-hardening-prompt.md`
  - 下一阶段给“宿主平台仓库”本身使用的接手 prompt，重点是 runtime bridge、调度、配置与结果归一化硬化，而不是继续在这里孵化新 MCP
- `docs/prompts/2026-03-28-phase-12-production-closure-hardening-prompt.md`
  - 下一阶段给“宿主平台仓库”继续做非 MCP、面向生产闭环硬化时使用的接手 prompt，重点是自动收束可观察性、最终结论体验与专项 E2E

## 11. 运行产物说明

以下目录主要是运行产物或临时状态，不是业务源码主体：

- `.prototype-store/`
  - 本地运行时状态
- `output/`
  - live validation 报告、截图、日志等输出
- `playwright-report/`
  - Playwright 报告
- `test-results/`
  - 测试输出

当前 `.txt` 文件已在 `.gitignore` 中忽略。

## 12. 已完成事项总览

- [x] 前端原型页面、路由与模板对齐
- [x] 登录、鉴权、中间件保护
- [x] 项目 CRUD 与本地持久化
- [x] 审批中心与审批恢复
- [x] 资产、证据、发现结果页
- [x] 设置中心拆分与真实配置持久化
- [x] MCP Server 严格注册与工具合同校验
- [x] 真实 DNS / 子域 / 证书情报类 connector
- [x] 真实 Web 页面探测 stdio MCP connector
- [x] 真实 HTTP / API 结构发现 stdio MCP connector
- [x] 真实 HTTP 受控验证 stdio MCP connector
- [x] 真实截图与证据采集 stdio MCP connector
- [x] 调度任务队列、pause / resume / retry / cancel
- [x] 项目生命周期控制：手动开始、暂停、继续、停止
- [x] 项目自动收束：队列跑空后补报告导出并生成最终结论
- [x] 审批恢复后的后续推进与自动收束
- [x] Durable worker lease 与 orphan running task 恢复
- [x] Cooperative cancellation 打通运行中任务停止链路
- [x] 本地 Juice Shop 真实闭环验证
- [x] 本地 WebGoat 真实 finding / 报告导出闭环验证
- [x] `npm run test`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run e2e`

## 13. TODO List

下面这份 TODO 按优先级排序。这个仓库后续优先做“闭环稳定性、运行时治理、配置治理、结果体验”，不在这里继续新增具体 MCP 或 `fscan` 相关实现。

### P0：当前最高优先级

- [x] 把平台主线收敛到 `v0.2.2`
- [x] 新建独立 MCP 脚手架仓库，避免后续 MCP 开发继续耦合在平台主仓库中
- [x] 提供独立脚手架仓库的示例 MCP、合同校验、平台注册 helper 与交接文档
- [ ] 把当前 `WebGoat` 的“offline / 不可达”提示继续收敛成更可执行的环境诊断信息
- [ ] 把“为什么项目还没收束”解释得更清楚，覆盖待审批、运行中任务、导出缺失、结论缺失等 blocker
- [ ] 为“已完成 / 已停止”项目统一终态语义，避免 UI、API、按钮行为不一致

### P1：运行时与后端稳定性

- [ ] 继续把队列/执行状态从 prototype 级文件存储向更 durable 的长期运行模型演进
- [ ] 完善 cooperative cancellation 在更多 connector family 上的传播与回滚语义
- [ ] 增强运行中任务的超时、重试、熔断、限流策略
- [ ] 补更明确的 worker 诊断、lease 争抢、ownership lost 可视化
- [ ] 增强异常恢复后的审计链，确保“谁接手、何时恢复、为什么恢复”可追溯
- [ ] 评估是否要把当前“按次请求式 LLM 编排 + 自动收束”演进成更强的状态化控制环，并定义真正的模型侧 pause / resume / finalize 语义
- [ ] 让截图与 HTML artifact 生命周期进入更 durable 的存储与清理策略

### P1：真实数据与闭环质量

- [ ] 清理历史临时演示数据痕迹，确保默认界面继续保持 empty-first
- [ ] 补更多真实项目闭环样本，避免平台只验证过单一目标
- [ ] 为真实结果页补更稳定的分页、筛选、排序与大数据量展示策略
- [ ] 让项目详情页更明确区分“阶段信息”和“结果信息”，避免信息再次混杂
- [ ] 让最终结论、报告导出、项目状态在更多页面共用同一份权威读模型，避免多处摘要不一致

### P1：LLM 与配置管理

- [ ] 为 `/settings/llm` 增加配置连通性校验与保存前校验
- [ ] 补 `apiKey` 掩码模式与“显示/隐藏”调试开关
- [ ] 增加多模型 profile 管理，而不仅是固定角色配置
- [ ] 增加失败回退策略，例如主模型失败时切换到备用模型
- [ ] 记录更完整的 LLM 请求/响应元数据，便于调试但不泄露敏感内容

### P1：MCP 契约与平台治理

- [ ] 继续完善 MCP Server 注册校验错误提示，让字段问题更容易定位
- [ ] 增加注册前预检与健康检查，降低错误注册概率
- [ ] 让 MCP 注册页支持模板导入、合同示例与字段自动补全
- [ ] 增加平台侧 capability coverage 视图，直观看到哪些能力族已经有真实 MCP
- [ ] 增加 MCP tool 级别的审批策略覆盖与默认并发策略

### P2：外部 MCP 仓库协同

- [ ] 与独立 MCP 仓库对齐合同版本，避免平台注册字段和外部脚手架漂移
- [ ] 为平台补更明确的“工具缺失提示”，在某个能力族未注册时给操作者清晰反馈
- [ ] 梳理哪些能力族只需要合同即可，哪些能力族必须补平台桥接或结果归一化

### P2：前端与运维体验

- [ ] 增强系统状态页，展示队列长度、worker 健康、活跃 connector、活跃审批
- [ ] 增强工作日志与审计日志筛选能力
- [ ] 补更多结果页联动跳转，例如从漏洞直接跳证据、从证据跳资产
- [ ] 增强新项目创建后的首次引导，降低空白页困惑
- [ ] 为关键页面补更完整的加载态、错误态、空态

### P2：测试与质量保障

- [ ] 为 `WebGoat` 第二靶场补自动化验证测试
- [ ] 增加 environment-blocked 场景测试，覆盖“容器起来但宿主机不可达”的诊断语义
- [ ] 增加长时间运行、任务中断、恢复接管场景的回归测试
- [ ] 增加更多真实 MCP 集成测试
- [ ] 增加“开始项目 -> 审批恢复 -> 自动收束 -> 最终结论”的专项 API 合同测试与 UI E2E 回归
- [ ] 增加版本化发布说明与 changelog 机制，避免后续里程碑不可追踪

### P3：后续可选增强

- [ ] 多用户与权限分层
- [ ] 更真实的审批策略矩阵
- [ ] 结果导出与外部报告生成
- [ ] 更完整的系统观测与告警
- [ ] 数据库存储全面替代 prototype-store

## 14. 推荐的下一步开发顺序

建议先按下面顺序继续推进：

1. 平台主仓库继续稳住 durable backend、项目收束诊断语义和项目闭环
2. 把 `/settings/llm` 做成更接近生产可用的配置入口，补连通性校验、显隐控制和失败诊断
3. 补“手动开始 -> 审批恢复 -> 自动收束 -> 最终结论”的专项 API 与 E2E 回归
4. 再继续扩大 durable backend 与运维观测能力
5. 只有当外部 MCP 仓库交付了新能力且确实需要平台桥接时，再回平台主仓库补连接器或结果归一化

## 15. 备注

- 当前仓库已经适合继续做下一阶段真实后端、运行时治理与项目闭环硬化，但还不适合作为生产系统直接上线
- 如果你是新的 LLM 接手本项目，先读 `code_index.md`，再读 `roadmap.md`
- 如果你准备新增一个 MCP，请先对照协议模板仓 `D:\dev\llmpentest-mcp-template` 完成合同设计，再在独立实现仓库里开发具体 server
- 当前版本 `v0.2.2` 更适合视为“可演示、可验证、可继续接近生产可用的原型里程碑”，而不是最终生产版本
