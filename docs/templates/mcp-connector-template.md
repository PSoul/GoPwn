# MCP Connector Template

## 1. Server 信息

- `serverName`:
- `version`:
- `transport`:
  - `stdio` / `streamable_http` / `sse`
- `command`:
- `args`:
- `endpoint`:
  - 可选
- `enabled`:
- `notes`:
  - 可选

## 2. Tool 基本信息

- `toolName`:
- `title`:
- `description`:
- `version`:
- `capability`:
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
- `boundary`:
  - `外部目标交互` / `平台内部处理` / `外部第三方API`
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
  - 必填
  - 宿主当前要求显式声明，用于注册时合同校验

## 6. 结果映射

- `resultMappings`:
  - `domains`
  - `webEntries`
  - `network`
  - `findings`
  - `evidence`
  - `workLogs`
  - `assets`
  - `intelligence`

说明：

- 哪些字段会进入资产或综合资产视图
- 哪些字段会进入证据
- 哪些字段会形成发现
- 哪些字段会进入外部情报视图
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

当前示例保留一个“已具备运行时桥接”的 `Web 页面探测类` 能力，方便直接在宿主设置页试填。模板仓里定义的其他能力族即便已经可以注册，也不代表宿主当前一定已经完成真实执行桥接。

```json
{
  "serverName": "",
  "version": "",
  "transport": "stdio",
  "command": "",
  "args": [],
  "enabled": true,
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
