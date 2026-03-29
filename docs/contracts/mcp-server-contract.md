# MCP Server Contract

## 1. 协议来源

本仓库的宿主合同以 `D:\dev\llmpentest-mcp-template` 为标准源。

这里的文档用于说明“宿主平台当前接受什么注册载荷、如何持久化、哪些能力只是先注册后接入运行时”，不复制模板仓的 schema 原件。

## 2. 注册顶层结构

```json
{
  "serverName": "web-surface-stdio",
  "version": "1.0.0",
  "transport": "stdio",
  "command": "node",
  "args": ["scripts/mcp/web-surface-server.mjs"],
  "enabled": true,
  "tools": []
}
```

### 顶层必填字段

- `serverName`
- `version`
- `transport`
- `enabled`
- `tools`

### 顶层可选字段

- `command`
- `args`
- `endpoint`
- `notes`

### 传输约束

- `transport = stdio` 时，`command` 必填。
- `args` 为字符串数组，可省略，默认按空数组处理。
- `endpoint` 与 `notes` 可以省略；宿主持久化时会统一归一为 `""`，避免存储层迁移。

## 3. Tool 合同要求

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
- `outputSchema`
- `defaultConcurrency`
- `rateLimit`
- `timeout`
- `retry`
- `owner`

### 额外规则

- `toolName` 在单次 server 注册请求中必须唯一。
- `inputSchema` 和 `outputSchema` 都必须是 JSON Schema 风格对象，且不能为空对象。
- 宿主当前采用 “JSON Schema-like object” 校验策略：对象至少应包含 `type`、`properties`、`items`、`oneOf`、`anyOf`、`allOf`、`$schema` 之一。

## 4. 平台枚举约束

### `capability`

- `目标解析类`
- `DNS / 子域 / 证书情报类`
- `端口探测类`
- `资产探测类`
- `Web 页面探测类`
- `HTTP / API 结构发现类`
- `HTTP 数据包交互类`
- `TCP 数据包交互类`
- `受控验证类`
- `截图与证据采集类`
- `报告导出类`
- `外部情报查询类`

### `boundary`

- `外部目标交互`
- `平台内部处理`
- `外部第三方API`

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
- `assets`
- `intelligence`

## 5. 宿主支持口径

- 当前宿主已经完成严格合同校验，以上枚举值都可以合法注册。
- 并非所有模板能力都已完成运行时桥接。
- 当前主仓优先保证“可注册、可校验、可说明”，新增能力的实际执行、归一化和调度桥接会分阶段补齐。

这意味着：

- 新能力族或新映射可以先作为合同能力进入注册表。
- 是否已经具备真实连接器和归一化落库，需要结合运行时实现另行判断。

## 6. 注册成功后会写到哪里

### SQLite

- `mcp_servers`

### JSON prototype store

- `mcpServerContracts`
- `mcpToolContracts`
- `mcpTools`

宿主持久化时会把可选输入统一标准化，确保设置页、调度层和审计层读取到的是稳定字段。

## 7. 失败行为

- 注册失败返回 `400`
- `error` 会携带首个失败字段路径与原因

常见示例：

- `tools.0.outputSchema: Required`
- `command: command is required when transport is stdio`
- `tools.1.toolName: toolName must be unique within a server registration`

## 8. 推荐实践

- 优先在 `D:\dev\llmpentest-mcp-template` 对照 schema、示例和文档完成合同自检。
- 具体 MCP server 的实现应放在独立实现仓库或专门目录中，不建议继续在宿主平台主仓里直接孵化。
- 注册前至少补齐注册/API 测试；如果能力已经接入运行时，再补连接器和结果沉淀测试。
