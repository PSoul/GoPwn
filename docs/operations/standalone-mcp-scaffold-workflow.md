# MCP 协议模板协同工作流

## 1. 目的

从本阶段开始，平台主仓库不再承担“协议标准源 + 具体 MCP 实现”双重职责。

后续新增 MCP 建议分成两步：

1. 先以 `D:\dev\llmpentest-mcp-template` 为协议标准完成合同对齐。
2. 再在独立实现仓库或专门工作目录里开发具体 MCP server，最后把注册 JSON 回填到平台。

## 2. 职责边界

### 平台主仓库负责

- 项目、审批、调度、结果沉淀
- MCP 注册入口与合同校验
- 连接器选择、执行、归一化和审计
- 平台 UI、API、运行态控制

### 协议模板仓负责

- 四层 schema
- 示例 JSON
- 协议说明文档
- 示例校验与一致性测试

### 独立实现仓库负责

- 具体 MCP server 代码
- 运行时 smoke
- 平台自动注册 helper
- 与具体工具相关的适配逻辑

## 3. 推荐开发流程

1. 在 `D:\dev\llmpentest-mcp-template` 确认能力族、边界、结果映射和字段合同
2. 参考模板仓里的 schema、examples 和文档准备注册 JSON
3. 在模板仓跑协议校验：
   - `npm run build`
   - `npm run test`
   - `npm run validate:examples`
4. 在独立实现仓库开发具体 MCP server，并补充该仓库自己的 smoke 或注册 helper
5. 把合同注册回平台：
   - 手工粘贴到 `/settings/mcp-tools`
   - 或使用实现仓库内的自动注册 helper
6. 如果平台现有连接器/归一化逻辑不够，再回平台主仓库补最小桥接

## 4. 什么情况下必须改平台主仓库

以下情况不能只改模板仓或实现仓：

- 新能力族不在平台注册枚举里
- 新能力的输出需要新的资产/证据/发现归一化逻辑
- 现有连接器无法识别该 MCP server 暴露的方法形状
- 新能力需要新的风险、审批或调度表达

## 5. 当前最小桥接结论

当前平台已经把 `受控验证类` 连接器从“写死某个工具名”放宽到了“任何已注册的 `受控验证类` 工具绑定，只要它暴露共享的 HTTP validation MCP 形状，都可以复用现有路径”。

这意味着：

- 只要合同形状和共享 MCP 方法满足现有桥接约束，同类 MCP 可以先复用已有运行时路径
- 后续同类 `受控验证类` MCP 不需要每次都先补一个新的平台连接器
- 但跨能力族时，仍然要按实际情况补平台桥接

## 6. 文档入口

建议按下面顺序阅读：

1. 平台主仓库 `README.md`
2. 平台主仓库 `roadmap.md`
3. 平台主仓库 `code_index.md`
4. 平台主仓库 `docs/contracts/mcp-server-contract.md`
5. 平台主仓库 `docs/templates/mcp-connector-template.md`
6. 平台主仓库 `docs/operations/mcp-onboarding-guide.md`
7. 模板仓库 `README.md`
