# MCP 接入指南

## 1. 核心边界

本项目坚持这条边界：

- `LLM = 大脑`
  负责规划、解释、审阅、取舍。
- `MCP = 四肢`
  负责真正接触目标、执行探测、采集结果、返回结构化输出。

任何会触达目标环境的动作，优先通过 MCP 接入。平台内部的归一化、结果聚合、状态推进，不强制抽象成 MCP。

本仓库的宿主合同以 `D:\dev\llmpentest-mcp-template` 为标准源；这里负责“接受并解释协议”，不是协议模板仓本身。

## 2. 当前真实接入链路

1. LLM 或人工声明所需能力族。
2. 平台根据能力族挑选可用工具，并套用审批/并发/速率策略。
3. 新 MCP server 先经过合同校验，再进入平台真实注册表。
4. 调度器决定立即执行、等待审批、延后重试或终止。
5. 连接器或真实 MCP client 执行动作。
6. 输出被归一化并沉淀到资产、证据、发现、工作日志。

关键代码位置：

- `lib/mcp-registration-schema.ts`
- `lib/mcp-server-repository.ts`
- `lib/mcp-server-sqlite.ts`
- `lib/mcp-connectors/registry.ts`
- `lib/mcp-gateway-repository.ts`
- `lib/mcp-execution-service.ts`
- `lib/prototype-api.ts`

## 3. 注册前必须准备什么

新增 MCP 之前，请先补齐以下信息：

- server 名称与版本
- transport 类型
- stdio 模式下的 `command` 与 `args`
- 平台工具名称 `toolName`
- 能力族 `capability`
- 风险等级 `riskLevel`
- 边界类型 `boundary`
- 是否默认需要审批 `requiresApproval`
- 结果映射 `resultMappings`
- `inputSchema`
- 如有结构化输出，补 `outputSchema`
- 默认并发 / 速率 / 超时 / 重试
- owner 与说明文本

如果这些字段不齐，平台不会允许注册成功。

## 4. 合同约束

平台的 MCP 注册合同文件见：

- `docs/contracts/mcp-server-contract.md`

协议标准源见：

- `D:\dev\llmpentest-mcp-template`

当前约束要点：

- `inputSchema` 必填
- `outputSchema` 必填
- `toolName` 必须在单次 server 注册中唯一
- `capability`、`boundary`、`riskLevel`、`resultMappings` 必须使用平台定义的枚举值
- `endpoint`、`notes` 可以省略，宿主持久化时会归一为空字符串
- 注册成功后会同时写入：
  - SQLite MCP server 注册表
  - JSON prototype store 的 `mcpServerContracts`
  - JSON prototype store 的 `mcpToolContracts`
  - 真实可调度 `mcpTools`

当前宿主已经接受模板里的 `12` 个能力族、`8` 个结果映射和 `3` 个边界类型，但并非所有能力都已经完成真实连接器和结果归一化桥接。

## 5. 接入步骤

### Step 1. 先选能力族

优先确认：

- 它属于哪个能力族
- 会落在哪个项目阶段
- 默认风险是多少
- 是外部目标交互还是平台内部处理

### Step 2. 设计输入/输出

至少明确：

- 需要哪些目标输入
- 需要哪些前置上下文
- 失败如何表达
- 结果要沉淀到哪些平台表面

### Step 3. 补合同 JSON

建议从模板开始：

- `docs/templates/mcp-connector-template.md`
- `D:\dev\llmpentest-mcp-template`

### Step 4. 在设置页注册

进入：

- `/settings/mcp-tools`

将合同 JSON 粘贴进 “MCP 契约注册” 区域。平台会先做字段校验，再执行真实注册。

### Step 5. 如有真实执行器，再补连接器

如果该能力需要真正执行：

- 在 `lib/mcp-connectors/` 下实现连接器
- 在 `lib/mcp-connectors/registry.ts` 注册
- 如需外部 MCP stdio / SSE / streamable HTTP client，对接 `lib/mcp-client-service.ts`

如果只是先完成协议对齐，而宿主还没有桥接该能力，可以先停在“已注册、待桥接”的状态，不必在本次接入里强行补全运行时。

## 6. 测试要求

至少补三层：

1. 注册/API 测试
2. 连接器/执行测试
3. 结果沉淀或 E2E 测试

现有参考：

- `tests/api/mcp-registration-api.test.ts`
- `tests/api/mcp-tools-api.test.ts`
- `tests/lib/real-web-surface-mcp-connector.test.ts`
- `tests/settings/mcp-gateway-client.test.tsx`

## 7. 重要说明

- 运行时默认不再 seed 任何演示 MCP server
- 未注册的 server 不会出现在设置页
- 未通过合同校验的 tool 不会进入调度候选池
- 浏览器 E2E 已切到临时 store 目录，便于在空数据状态下稳定验证真实流程
- 新 MCP server 的具体实现建议放在独立实现仓库或单独工作目录中，而不是继续直接耦合在宿主平台主仓里
