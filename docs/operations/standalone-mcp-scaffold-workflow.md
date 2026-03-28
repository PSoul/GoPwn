# 独立 MCP 脚手架工作流

## 1. 目的

从本阶段开始，平台主仓库不再承担“直接孵化所有新 MCP server”的职责。后续新增 MCP，优先在独立脚手架仓库中开发、校验和整理文档，再注册回平台。

推荐脚手架仓库路径：

- `D:\dev\llmpentest-mcp-scaffold`

## 2. 职责边界

### 平台主仓库负责

- 项目、审批、调度、结果沉淀
- MCP 注册入口与合同校验
- 连接器选择、执行、归一化和审计
- 平台 UI、API、运行态控制

### 独立脚手架仓库负责

- MCP server 模板
- 能力族 starter
- 平台合同镜像校验
- 示例合同 JSON
- stdio smoke
- 平台自动注册 helper
- 面向后续 LLM 的 handoff 文档

## 3. 推荐开发流程

1. 在脚手架仓库选择或复制一个示例 starter
2. 修改能力族、输入输出 schema、结果映射和默认策略
3. 跑脚手架本地校验：
   - `npm run build`
   - `npm run test`
   - `npm run contract:validate`
   - `npm run smoke:stdio`
4. 把合同注册回平台：
   - 手工粘贴到 `/settings/mcp-tools`
   - 或使用脚手架仓库内的自动注册 helper
5. 如果平台现有连接器/归一化逻辑不够，再回平台主仓库补最小桥接

## 4. 什么情况下必须改平台主仓库

以下情况不能只改脚手架仓库：

- 新能力族不在平台注册枚举里
- 新能力的输出需要新的资产/证据/发现归一化逻辑
- 现有连接器无法识别该 MCP server 暴露的方法形状
- 新能力需要新的风险、审批或调度表达

## 5. 当前最小桥接结论

当前平台已经把 `受控验证类` 连接器从“写死某个工具名”放宽到了“任何已注册的 `受控验证类` 工具绑定，只要它暴露共享的 HTTP validation MCP 形状，都可以复用现有路径”。

这意味着：

- 脚手架仓库里的 `HTTP 请求工作台` 示例可以直接接回平台
- 后续同类 `受控验证类` MCP 不需要每次都先补一个新的平台连接器
- 但跨能力族时，仍然要按实际情况补平台桥接

## 6. 文档入口

建议按下面顺序阅读：

1. 平台主仓库 `README.md`
2. 平台主仓库 `roadmap.md`
3. 平台主仓库 `code_index.md`
4. 脚手架仓库 `README.md`
5. 脚手架仓库 `docs/capability-matrix.md`
6. 脚手架仓库 `docs/integration/platform-registration-workflow.md`
