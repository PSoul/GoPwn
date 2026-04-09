# 01 — 项目概述与愿景

> GoPwn 是一个开源的 AI Agent 驱动渗透测试平台。LLM 作为大脑进行推理和决策，MCP 工具作为四肢执行真实探测，平台作为中枢负责调度和审计。

---

## 1.1 GoPwn 是什么

GoPwn 是一个将大语言模型（LLM）与安全工具深度融合的自动化渗透测试平台。它不是一个简单的"AI 套壳扫描器"，而是让 LLM 像一位经验丰富的渗透测试工程师一样思考：观察目标、分析结果、选择下一步行动、验证发现、撰写报告。

平台的名字 **GoPwn** 是一个祈使句 — Go（出发）+ Pwn（攻破），如同在终端中输入一条命令般直接。

### 核心三角架构

```
LLM（大脑）          推理、决策、审阅、风险判断
    ↕ ReAct Loop
Platform（中枢）     调度、审批、持久化、归一化、审计
    ↕ MCP stdio
MCP Tools（四肢）    真实探测、证据采集、结构化结果回传
```

- **LLM 是大脑** — 负责渗透测试的认知层面：分析目标、制定策略、选择工具、解读结果、判断风险。平台不给 LLM 具体的攻击代码或靶场路径，只教通用方法论，让 LLM 自主思考。
- **MCP 工具是四肢** — 13 个 MCP Server 提供 38 个安全工具，覆盖从 DNS 侦察到漏洞验证的完整攻击链。每个工具通过标准的 Model Context Protocol（MCP）协议以 stdio 方式与平台通信。
- **平台是中枢** — 负责将 LLM 的决策转化为实际行动：管理项目生命周期、调度工具执行、收集和持久化结果、提供实时可视化、执行审批流程、生成最终报告。

## 1.2 为什么做 GoPwn

### 行业痛点

传统渗透测试面临三个核心挑战：

1. **人力密集** — 一次完整的渗透测试需要资深安全工程师数天到数周的手工操作。全球安全人才缺口超过 340 万（ISC² 2025 报告），优秀的渗透测试工程师更是稀缺资源。

2. **工具割裂** — 渗透测试涉及几十种工具（Nmap、Burp Suite、SQLMap、Metasploit...），工程师需要在不同工具间手动切换、传递数据、解读输出。没有统一的编排层将这些工具串联成自动化流程。

3. **知识依赖** — 渗透测试的核心不在于执行扫描命令，而在于根据每一步的结果做出判断：这个端口暴露意味着什么？这个 HTTP 响应暗示了什么漏洞？下一步应该测试什么？这种推理能力高度依赖个人经验。

### GoPwn 的解决思路

GoPwn 的核心洞察是：**大语言模型已经具备了安全推理能力，缺的是执行能力**。

- LLM 知道 Redis 未授权访问应该怎么测试，但它不能直接连接 Redis
- LLM 知道 SQL 注入的各种变形手法，但它不能直接发送 HTTP 请求
- LLM 知道发现漏洞后应该验证并评估风险，但它不能执行 PoC 代码

GoPwn 通过 MCP 工具体系为 LLM 接上"四肢"，让它能够真正执行渗透测试的每一步操作。同时，ReAct 执行引擎确保 LLM 不是盲目执行预设脚本，而是在每一步观察真实结果后做出下一步决策。

## 1.3 核心特性

### ReAct 自主编排
LLM 在每一步通过 OpenAI Function Calling 动态选择工具和策略。不是固定流水线，而是真正的自主推理：看到端口扫描结果后决定测什么、发现 Web 应用后决定用哪个工具、遇到 WAF 后决定如何绕过。每轮最多 30 步，轮间由 LLM 审阅决定是否继续深入。

### 38 个 MCP 安全工具
13 个 MCP Server 覆盖渗透测试全生命周期：DNS 侦察（subfinder、whois）、端口扫描（fscan、netcat）、Web 探测（httpx、dirsearch、wafw00f）、漏洞扫描（afrog）、HTTP 交互（curl）、情报收集（fofa、github-recon）、编解码（encode）、自主脚本执行（script）。所有工具通过统一的 MCP stdio 协议通信，新增工具只需在 `mcps/` 目录下添加 MCP Server，平台自动发现和注册。

### SSE 流式 LLM 调用
完整支持任意 OpenAI 兼容 API 的 SSE 流式调用，包括各类反向代理和 API 聚合服务。已验证阿里云 DashScope（qwen3.6-plus）和 SiliconFlow（DeepSeek-V3.2）等 Provider。支持 `reasoning_content` 字段回退（reasoning 模型）、空响应自动重试（最多 3 次）。

### 智能 Scope 判断
项目描述注入所有 LLM Prompt（ReAct / Analyzer / Reviewer），LLM 基于项目上下文智能判断新发现资产的关联性。Scope 策略自动从项目目标推断边界：域名目标允许同根域名，IP 目标允许同 /24 子网。超出范围的工具调用自动拦截。

### 多轮迭代执行
每轮 ReAct 循环结束后，LLM Reviewer 审阅本轮结果并决定是否继续下一轮。项目可配置最大轮数（默认 10 轮），确保攻击面被充分覆盖。跨轮上下文通过系统提示中的资产/漏洞列表传递。

### 实时可视化
SSE（Server-Sent Events）流式推送 LLM 推理链和工具执行结果。前端实时展示每一步的 Thought（推理）、Action（工具调用）、Observation（结果），可观察 LLM 的完整决策过程。

### 完整可观测性
每次 MCP 工具执行记录详细日志：执行耗时、输出长度、输出预览、错误详情。每次 LLM 调用记录 prompt、response、model、duration、Function Call 详情。全部日志持久化到数据库，支持前端查询和导出。

### 审批与审计
高风险操作（如代码执行、特定漏洞利用）自动暂停等待人工审批。完整审计事件记录所有关键操作。支持自定义审批策略（低风险自动批准、中风险可配置、高风险必须人工审批）。

### Docker 靶场
内置 13 个 Docker 靶场环境，覆盖 HTTP 和 TCP 两大类：DVWA（SQL 注入/XSS/命令注入）、Juice Shop（OWASP Top 10）、WebGoat（教学型 Web 漏洞）、WordPress（CMS 弱口令）、Redis/SSH/MySQL/MongoDB/Elasticsearch（TCP 未授权访问/弱口令）、Tomcat（管理面板弱口令）等。一键启动，即可用于平台测试和演示。

### 漏洞智能去重
Finding 创建时执行三层去重：精确标题匹配、normalizeTitle 模糊匹配（中英文漏洞类型同义词归一化）、tokenSimilarity 分词相似度匹配（英文词 + 中文 bigram，互斥守卫防止不同服务误合并）。severity 只升不降。

## 1.4 技术栈总览

| 层 | 技术 | 版本 |
|---|------|------|
| 框架 | Next.js (App Router) | 15.2 |
| 前端 | React + Tailwind CSS + shadcn/ui + Radix UI | React 19 / Tailwind 3.4 |
| 语言 | TypeScript (strict mode) | 5.x |
| 数据库 | PostgreSQL + Prisma ORM | PG 16 / Prisma 7.x |
| 任务队列 | pg-boss (基于 PostgreSQL) | 12.x |
| MCP 协议 | @modelcontextprotocol/sdk (stdio) | 1.28 |
| LLM 调用 | OpenAI 兼容 API (SSE 流式) | — |
| 认证 | JWT (jose) + bcryptjs | — |
| 实时通信 | Server-Sent Events (SSE) | — |
| 日志 | Pino (结构化 JSON 日志) | 10.x |
| 表单 | react-hook-form + zod 验证 | — |
| 图表 | Recharts | 2.15 |
| 测试 | Vitest + Playwright | Vitest 3.0 / Playwright 1.58 |
| 容器 | Docker Compose | — |
| 进程管理 | PM2 (生产环境) | — |

## 1.5 项目规模

截至 2026-04-08：

| 指标 | 数值 |
|------|------|
| 控制台页面 | 16 个 |
| API 端点 | 36 个（28 个路由文件） |
| React 组件 | 102 个 |
| 后台 Worker | 4 个（ReAct / Analysis / Verification / Lifecycle） |
| MCP Server | 13 个 |
| MCP 工具 | 38 个 |
| Prisma 数据模型 | 19 个 |
| 枚举类型 | 9 个 |
| 单元/集成测试 | 444 个 + 13 性能基准 |
| E2E 测试 | 31 个（含真实渗透测试 8.2 分钟） |
| Docker 靶场 | 13 个 |
| lib/ 核心代码 | ~7,700 行 |

## 1.6 开源与许可

GoPwn 以 MIT 许可证开源，托管在 GitHub（[PSoul/GoPwn](https://github.com/PSoul/GoPwn)）。MIT 许可证允许自由使用、修改和分发，包括商业用途。

品牌域名 [gopwn.ai](https://gopwn.ai) 已注册。
