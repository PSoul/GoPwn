# GoPwn 白皮书

> **GoPwn — AI Agent 驱动的下一代渗透测试平台**
>
> 版本: 1.0 | 日期: 2026-04-08 | 许可证: MIT

---

## 目录

| 章节 | 标题 | 面向读者 | 内容概要 |
|------|------|----------|----------|
| [01](01-overview.md) | 项目概述与愿景 | 所有人 | GoPwn 是什么、解决什么问题、核心理念 |
| [02](02-architecture.md) | 系统架构设计 | 开发者 / 技术决策者 | 双进程架构、领域分层、数据流、状态机 |
| [03](03-react-engine.md) | ReAct 执行引擎 | 开发者 / AI 工程师 | Thought→Action→Observation 循环、上下文管理、与旧架构对比 |
| [04](04-mcp-tools.md) | MCP 工具体系 | 开发者 / 安全工程师 | 13 个 MCP Server、38 个工具、能力族、接入流程 |
| [05](05-llm-integration.md) | LLM 集成与 Prompt 工程 | AI 工程师 / 开发者 | 四个 Prompt 模板、Function Calling、流式调用、上下文压缩 |
| [06](06-data-model.md) | 数据模型与存储 | 开发者 | 19 个 Prisma 模型、9 个枚举、实体关系、索引设计 |
| [07](07-frontend.md) | 前端界面与用户体验 | 用户 / 前端开发者 | 16 个页面、102 个组件、实时 SSE、暗色主题 |
| [08](08-security.md) | 安全机制与审批系统 | 安全团队 / 运维 | 认证鉴权、CSRF、审批工作流、Scope 策略、审计日志 |
| [09](09-testing.md) | 测试体系 | 开发者 / QA | Vitest 单元测试、Playwright E2E、性能基准、测试策略 |
| [10](10-deployment.md) | 部署与运维 | 运维 / DevOps | Docker Compose、裸机部署、PM2、监控、备份 |
| [11](11-usage-guide.md) | 使用指南 | 用户 | 从安装到第一次渗透测试的完整流程 |
| [12](12-market.md) | 行业定位与竞品分析 | 决策者 / 投资人 | 市场痛点、技术差异化、发展路线 |

---

## 阅读建议

- **快速了解项目**: 阅读 [01 项目概述](01-overview.md)
- **评估技术方案**: 阅读 01 → 02 → 03
- **动手使用**: 阅读 01 → 11 → 10
- **参与开发**: 阅读 01 → 02 → 03 → 04 → 05 → 06
- **安全评估**: 阅读 01 → 08 → 04

## 项目链接

- 官网: [gopwn.ai](https://gopwn.ai)
- GitHub: [PSoul/GoPwn](https://github.com/PSoul/GoPwn)
- 许可证: MIT
