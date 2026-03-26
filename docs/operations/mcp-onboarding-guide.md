# MCP 接入指南

## 边界原则

本项目坚持这条核心边界：

- `LLM = 大脑`
  - 负责规划、排序、解释、复核
- `MCP = 四肢`
  - 负责真正接触目标、执行探测、采集结果、返回结构化输出

如果一个动作会对目标环境产生观测、探测、识别、验证、截图或其他交互，它就应该优先通过 MCP 接入。

## 当前执行链路

新接入的 MCP 能力，需要理解并适配以下链路：

1. LLM 或人工请求声明“需要什么能力”
2. MCP 网关根据能力族挑选工具并判断是否需要审批
3. 调度器决定立即执行、延后重试、等待审批或终止
4. 连接器真正执行动作
5. 结果被归一化并写回资产、证据、漏洞/发现、工作日志

关键文件：

- [lib/mcp-connectors/types.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/mcp-connectors/types.ts)
- [lib/mcp-connectors/registry.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/mcp-connectors/registry.ts)
- [lib/mcp-gateway-repository.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/mcp-gateway-repository.ts)
- [lib/mcp-scheduler-service.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/mcp-scheduler-service.ts)
- [lib/mcp-execution-service.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/mcp-execution-service.ts)

## 接入步骤

### 1. 先定义能力，而不是先想工具名

优先回答这些问题：

- 这个 MCP 属于哪个能力族
- 它作用在哪个阶段
- 默认风险是高、中、还是低
- 它是否真的需要触达目标环境

如果只是平台内部聚合、归一化、总结，不一定要抽象成 MCP。

### 2. 明确输入与输出

至少明确以下内容：

- 输入目标是什么
- 需要哪些前置上下文
- 会返回哪些结构化字段
- 失败时如何表达
- 哪些结果要沉淀为资产、证据或漏洞

### 3. 实现连接器

连接器需要满足 [lib/mcp-connectors/types.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/mcp-connectors/types.ts) 里的 `McpConnector` 接口。

最小要求：

- `key`
- `mode`
- `supports(context)`
- `execute(context)`

推荐先参考：

- [lib/mcp-connectors/local-foundational-connectors.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/mcp-connectors/local-foundational-connectors.ts)
- [lib/mcp-connectors/real-dns-intelligence-connector.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/mcp-connectors/real-dns-intelligence-connector.ts)

### 4. 注册到连接器注册表

把新连接器加入 [lib/mcp-connectors/registry.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/mcp-connectors/registry.ts)。

要求：

- 不要破坏现有连接器顺序，除非你明确需要覆盖策略
- 如果是“真实连接器优先、本地连接器回退”，顺序要体现这个优先级

### 5. 注册工具元数据

如果这是一个新的 MCP 工具，还需要在原型数据或后续真实存储里登记：

- 工具名称
- 版本
- 能力族
- 风险级别
- 边界类型
- 默认并发 / 速率 / 超时 / 重试
- 是否默认需要审批

当前原型里的元数据主要来自 [lib/prototype-data.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/lib/prototype-data.ts)。

### 6. 补测试

至少补三类测试：

- 连接器单测
- API 或服务层集成测试
- 结果沉淀验证

推荐优先仿照：

- [tests/lib/mcp-connectors.test.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/tests/lib/mcp-connectors.test.ts)
- [tests/api/mcp-runs-api.test.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/tests/api/mcp-runs-api.test.ts)
- [tests/api/mcp-workflow-smoke-api.test.ts](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/tests/api/mcp-workflow-smoke-api.test.ts)

## 接入检查清单

- 能力族命名是否稳定
- 风险等级是否正确
- 是否清楚区分“自动执行”和“必须审批”
- 是否返回了足够的结构化输出
- 是否能沉淀到资产 / 证据 / 漏洞
- 是否在失败时提供了可审计的错误信息
- 是否补了单测与集成测试

## 模板

新工具接入前，先复制并填写：

- [docs/templates/mcp-connector-template.md](/D:/dev/llmpentest0326/.worktrees/llm-orchestrator-docker-validation-2026-03-26/docs/templates/mcp-connector-template.md)
