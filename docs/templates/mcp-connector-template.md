# MCP Connector Template

## 1. Server 信息

- `serverName`:
- `version`:
- `transport`:
  - `stdio` / `streamable_http` / `sse`
- `command`:
- `args`:
- `endpoint`:
- `enabled`:
- `notes`:

## 2. Tool 基本信息

- `toolName`:
- `title`:
- `description`:
- `version`:
- `capability`:
- `boundary`:
  - `外部目标交互` / `平台内部处理`
- `riskLevel`:
  - `高` / `中` / `低`
- `requiresApproval`:
- `owner`:

## 3. 运行默认值

- `defaultConcurrency`:
- `rateLimit`:
- `timeout`:
- `retry`:

## 4. 输入合同

- `inputSchema`:
  - 必填
  - 必须是 JSON Schema 风格对象
  - 至少说明目标输入和关键必填字段

建议最少写清：

- target / targetUrl / domain / ip / path 等主输入
- required 字段
- additionalProperties 策略

## 5. 输出合同

- `outputSchema`:
  - 可选
  - 如果会返回结构化内容，强烈建议补齐

## 6. 结果映射

- `resultMappings`:
  - `domains`
  - `webEntries`
  - `network`
  - `findings`
  - `evidence`
  - `workLogs`

说明：

- 哪些字段会进入资产
- 哪些字段会进入证据
- 哪些字段会形成发现
- 哪些字段只写工作日志

## 7. 平台行为说明

- 适用阶段：
- 什么时候应该被调度：
- 什么时候必须审批：
- 失败后是否允许重试：
- 停止条件：

## 8. 测试清单

- 注册 API 测试：
- 连接器 / 执行测试：
- 结果沉淀测试：
- E2E 场景：

## 9. 最终注册 JSON

```json
{
  "serverName": "",
  "version": "",
  "transport": "stdio",
  "command": "",
  "args": [],
  "endpoint": "",
  "enabled": true,
  "notes": "",
  "tools": [
    {
      "toolName": "",
      "title": "",
      "description": "",
      "version": "",
      "capability": "Web 页面探测类",
      "boundary": "外部目标交互",
      "riskLevel": "中",
      "requiresApproval": false,
      "resultMappings": ["evidence"],
      "inputSchema": {
        "type": "object"
      },
      "outputSchema": {
        "type": "object"
      },
      "defaultConcurrency": "1",
      "rateLimit": "10 req/min",
      "timeout": "15s",
      "retry": "1 次",
      "owner": ""
    }
  ]
}
```
