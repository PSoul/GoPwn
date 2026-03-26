# MCP Connector Template

## 基本信息

- 工具名称：
- 版本：
- 能力族：
- 边界类型：
  - `外部目标交互` / `平台内部处理`
- 默认风险级别：
  - `高` / `中` / `低`
- 是否默认需要审批：

## 目标与场景

- 这个连接器解决什么问题：
- 适用于哪个项目阶段：
- 典型输入：
- 典型输出：

## 输入契约

- `target`
- `requestedAction`
- 需要的前置上下文：
- 可能依赖的审批信息：

## 输出契约

- `summaryLines`
- `rawOutput`
- `structuredContent`
- `outputs`

请明确以下字段会不会产出：

- `normalizedTargets`
- `discoveredSubdomains`
- `webEntries`
- `validatedTargets`
- `generatedFindings`
- `reportDigest`

## supports(context) 规则

- 在什么条件下返回 `true`
- 在什么条件下必须明确让位给别的连接器

## execute(context) 规则

- 成功时返回什么
- 可重试失败时返回什么
- 不可重试失败时返回什么
- 是否需要标记 `mode = local` 或 `mode = real`

## 结果沉淀映射

- 哪些输出映射到资产
- 哪些输出映射到证据
- 哪些输出映射到漏洞与发现
- 哪些输出写入工作日志

## 风险与审批

- 为什么这个工具是这个风险等级
- 哪些动作必须人工审批
- 停止条件是什么

## 测试计划

- 单测文件：
- 集成测试文件：
- E2E 验证路径：

## 注册位置

- 连接器实现文件：
- 注册表位置：
- 工具元数据位置：
