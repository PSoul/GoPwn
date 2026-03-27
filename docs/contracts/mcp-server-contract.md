# MCP Server Contract

## 1. 目的

这个合同定义了“一个新 MCP server 如何被本平台接受并注册”。

平台目标不是简单保存 server 信息，而是确保：

- 字段完整
- 能力族明确
- 风险与审批规则明确
- 结果映射明确
- 注册后可直接进入真实调度候选池

## 2. 顶层结构

注册 payload 结构如下：

```json
{
  "serverName": "web-surface-stdio",
  "version": "1.0.0",
  "transport": "stdio",
  "command": "node",
  "args": ["scripts/mcp/web-surface-server.mjs"],
  "endpoint": "stdio://web-surface-stdio",
  "enabled": true,
  "notes": "真实 Web 页面探测 MCP server",
  "tools": []
}
```

## 3. 顶层字段要求

### 必填字段

- `serverName`
- `version`
- `transport`
- `endpoint`
- `enabled`
- `notes`
- `tools`

### `transport` 枚举

- `stdio`
- `streamable_http`
- `sse`

### 条件字段

- 当 `transport = stdio` 时，`command` 必填
- `args` 为字符串数组，可为空

## 4. Tool 字段要求

每个 `tools[]` 项必须包含：

- `toolName`
- `title`
- `description`
- `version`
- `capability`
- `boundary`
- `riskLevel`
- `requiresApproval`
- `resultMappings`
- `inputSchema`
- `defaultConcurrency`
- `rateLimit`
- `timeout`
- `retry`
- `owner`

### 可选字段

- `outputSchema`

### `toolName` 规则

- 在单个 server 注册请求中必须唯一
- 建议使用平台稳定名称，而不是一次性的临时名称

## 5. 平台枚举约束

### `capability`

- `目标解析类`
- `DNS / 子域 / 证书情报类`
- `端口探测类`
- `Web 页面探测类`
- `HTTP / API 结构发现类`
- `受控验证类`
- `截图与证据采集类`
- `报告导出类`

### `boundary`

- `外部目标交互`
- `平台内部处理`

### `riskLevel`

- `高`
- `中`
- `低`

### `resultMappings`

- `domains`
- `webEntries`
- `network`
- `findings`
- `evidence`
- `workLogs`

## 6. Schema 约束

### `inputSchema`

- 必填
- 必须是 JSON Schema 风格对象
- 至少应能表达工具主输入

### `outputSchema`

- 可选
- 如果工具会输出结构化内容，建议显式声明

当前平台校验采用“JSON Schema-like object”策略：

- 不能为空对象
- 至少要包含 `type`、`properties`、`items`、`oneOf`、`anyOf`、`allOf`、`$schema` 之一

## 7. 注册成功后会写到哪里

### SQLite

- `mcp_servers`

用于保存：

- server 基础信息
- transport
- command / args
- enabled 状态
- tool bindings
- 最近心跳时间

### JSON prototype store

- `mcpServerContracts`
- `mcpToolContracts`
- `mcpTools`

用于保存：

- 已验证合同摘要
- 平台真实可调度工具记录
- 设置页与调度层读取所需的标准化字段

## 8. 失败行为

注册失败时：

- 返回 `400`
- `error` 中包含第一个失败字段路径与原因

示例：

- `tools.0.inputSchema: Required`
- `command: command is required when transport is stdio`

## 9. 推荐实践

- 每个能力族先只接一个稳定的真实 server，再逐步扩容
- `toolName` 尽量与平台能力命名习惯一致
- 在注册前先补测试，再贴进设置页
- 如果要跑真实 E2E，优先使用本地临时 store，避免污染已有数据
