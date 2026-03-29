# Phase 12 Prompt: Production Closure Hardening

你正在接手 `D:\dev\llmpentest0326` 这个宿主平台仓库。

请注意：

- 这个仓库是“平台本身”，不是新 MCP 的开发仓库
- `LLM = 大脑`
- `MCP = 四肢`
- 这个仓库负责：登录、项目生命周期、审批、调度、结果归一化、证据持久化、最终结论、报告导出、审计与系统设置
- 新 MCP server 的合同应先对照 `D:\dev\llmpentest-mcp-template`，具体实现应放到独立实现仓库或其他专门的 MCP 仓库中，不要在这里继续新增具体 MCP family

## 你开始前必须先读

1. `README.md`
2. `code_index.md`
3. `roadmap.md`
4. `docs/contracts/mcp-server-contract.md`
5. `docs/operations/standalone-mcp-scaffold-workflow.md`

## 当前平台已经具备的关键能力

- 登录与会话保护
- 项目创建/编辑
- 项目生命周期：`idle / running / paused / stopped`
- LLM 编排计划生成
- MCP 注册、调度、审批、恢复
- 资产 / 证据 / 漏洞与发现落库
- 报告导出
- 最终结论持久化
- 队列跑空后的自动收束
- 审批恢复后的继续推进
- Juice Shop / WebGoat 本地闭环验证

## 本阶段目标

不要扩新的 MCP。

请把当前平台朝“更接近生产可用”继续推进，重点是：

1. 运行时诊断
2. 自动收束链路的可观察性
3. 已完成项目的稳定语义
4. 浏览器级专项 E2E 回归
5. 更 durable 的长期运行基础

## 本阶段优先任务

### 1. 自动收束可观察性

- 明确展示一个项目为什么还没有收束
- 区分：
  - 仍有待审批动作
  - 仍有活跃任务
  - 报告尚未导出
  - 最终结论尚未生成
- 在项目详情或任务与调度页中给出更清晰的 closure blocker 提示

### 2. 已完成项目语义硬化

- 已完成项目的 UI 和 API 语义要稳定
- 避免页面仍给出容易误导的“继续开始”感受
- 补更清晰的 badge、说明文案、交互禁用状态
- 补相关 API / 组件测试

### 3. 专项 E2E

新增一条浏览器级专项回归，至少覆盖：

- 登录
- 新建项目
- 手动点击开始
- 等待项目自动收束
- 查看最终结论
- 查看报告导出面板

如果现有 E2E 结构不适合，就在现有 smoke 套件基础上补一个独立 case。

### 4. 运行时 durability

在不大改架构的前提下，继续提高以下内容的可靠性：

- 队列状态恢复
- 项目结论记录持久化
- 报告导出记录持久化
- 更清晰的异常诊断日志

### 5. 文档同步

完成后必须更新：

- `README.md`
- `roadmap.md`
- `code_index.md`

如果本阶段形成了新的接手边界，再补一个新的 prompt 文件。

## 强约束

- 不要在这个仓库里开发新的具体 MCP server
- 不要引入 mock 展示数据
- 保留当前“单用户研究员席位”的产品设定
- 保持现有模板风格，不要把 UI 改成另一套设计语言
- 所有新增行为都要补测试，优先 API + E2E

## 验收标准

- `npm run test` 通过
- `npm run lint` 通过
- `npm run build` 通过
- `npm run e2e` 通过
- 项目自动收束路径有专项测试
- 文档已同步
