# LLM 渗透测试平台

AI Agent 驱动的授权安全评估全栈平台。

## 核心架构

```
LLM = 大脑     计划、编排、审阅、解释、风险判断
MCP = 四肢     接触目标、调用外部工具、采集证据、回传结构化结果
平台 = 中枢     审批、调度、持久化、结果归一化、审计、状态推进
```

## 当前状态

- 版本: `v0.8.0`
- 数据层: PostgreSQL via Prisma 7.x (`@prisma/adapter-pg`)，唯一数据层
- 测试: 206+ 单元测试 + 14 E2E 测试
- MCP: 14 个本地 MCP Server（36+ 工具）
- 靶场: 13 个 Docker 容器（DVWA / Juice Shop / WebGoat / Redis / SSH / Tomcat / Elasticsearch / MongoDB 等）
- 编排: 多轮 LLM 自动编排循环，支持自动续跑、并行执行、轮间自我反思
- LLM 分析: 三级 LLM profile（orchestrator/reviewer/analyzer），语义化工具输出解析

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 15 (App Router) |
| 前端 | React 19, Tailwind CSS, shadcn/ui |
| 后端 | Next.js API Routes, TypeScript |
| 数据库 | PostgreSQL 16 + Prisma 7.x (`@prisma/adapter-pg`) |
| MCP | `@modelcontextprotocol/sdk`, stdio 连接器 |
| 测试 | Vitest, Playwright |
| 容器 | Docker Compose (靶场 + PostgreSQL) |

## 快速启动

### 前置要求

- Node.js 20+
- Docker Desktop (用于 PostgreSQL + 靶场)
- npm

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 PostgreSQL

```bash
cd docker/postgres && docker compose up -d
```

### 3. 初始化数据库

```bash
npx prisma migrate dev
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 `http://127.0.0.1:3000`

### 5. 默认账号

| 字段 | 值 |
|------|---|
| 账号 | `researcher@company.local` |
| 密码 | `Prototype@2026` |
| 验证码 | `7K2Q` |

## 使用流程

1. 登录平台
2. 新建项目 — 填写项目名称、目标、说明
3. 点击 **开始项目** — LLM 自动生成首轮编排计划并驱动 MCP 调度
4. 运行中可暂停 / 继续，停止后进入终态
5. 队列跑空时平台自动补报告导出并生成最终结论

## 仓库结构

```
app/                    页面 (21) + API 路由 (48)
components/             业务 UI 组件
lib/                    核心业务层（9 个领域子目录）
  orchestration/        编排服务（多轮规划、执行、上下文构建）
  mcp/                  MCP 注册、执行引擎、调度器
  mcp-connectors/       MCP 连接器实现（stdio/real/local）
  llm/                  LLM prompt 工程与调用日志
  llm-provider/         LLM 客户端（OpenAI-compatible）
  gateway/              MCP 调度网关
  project/              项目 repository 与结果
  analysis/             工具输出分析与失败诊断
  infra/                基础设施（Prisma、transforms、local-lab）
  settings/             配置管理
  auth/                 认证与会话
  data/                 资产/证据/审批 repository
  types/                TypeScript 类型定义
mcps/                   14 个本地 MCP Server (36+ 工具)
docker/
  local-labs/           13 个 Docker 靶场定义
  postgres/             PostgreSQL 开发容器
prisma/
  schema.prisma         25 个数据模型
tests/                  单元测试 + API 测试
e2e/                    Playwright E2E 测试
prompts/                阶段开发 prompt
docs/                   合同、操作文档、设计 spec
```

## 常用命令

```bash
npm run dev              # 启动开发服务器
npm run build            # 生产构建
npm run test             # 运行单元测试 (vitest)
npm run e2e              # 运行 E2E 测试 (playwright)
npm run lint             # 代码检查
npm run test:all         # 单元 + E2E 全量测试
```

## Docker 靶场

### 启动靶场

```bash
cd docker/local-labs && docker compose up -d
```

### 靶场列表

| 靶场 | 端口 | 协议 |
|------|------|------|
| DVWA | 8081 | HTTP |
| Juice Shop | 3000 | HTTP |
| WebGoat | 18080 / 19090 | HTTP |
| Redis | 6379 | TCP |
| SSH | 2222 | TCP |
| MySQL | 13307 | TCP |
| MongoDB | 27017 | TCP |
| Tomcat | 8888 | HTTP |
| Elasticsearch | 9201 | HTTP |
| WordPress | 8082 | HTTP |

## LLM 配置

在 `/settings/llm` 页面配置，或通过环境变量：

```bash
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_ORCHESTRATOR_MODEL=Pro/deepseek-ai/DeepSeek-V3.2
LLM_REVIEWER_MODEL=Pro/deepseek-ai/DeepSeek-V3.2
```

## MCP 工具体系

14 个本地 MCP Server 覆盖以下能力族：

| 能力族 | MCP Server | 工具数 |
|--------|-----------|--------|
| 目标解析类 | 内置 seed-normalizer | 1 |
| DNS / 子域 / 证书 | subfinder, whois | 3 |
| Web 页面探测 | httpx, wafw00f | 3 |
| HTTP / API 结构发现 | curl, dirsearch | 4 |
| 端口 / 服务 / 网络 | fscan, netcat | 3 |
| 受控验证类 | curl (http-validation) | 2 |
| 截图与证据采集 | Playwright MCP | 2 |
| 编解码与密码学 | encode | 4 |
| 情报收集 | fofa, github-recon | 4 |
| 漏洞扫描 | afrog | 2 |
| 自主脚本执行 | script-mcp-server | 4 |
| 报告导出类 | 内置 report-exporter | 1 |

新 MCP 接入流程：参考 `docs/contracts/mcp-server-contract.md` 和 `docs/templates/mcp-connector-template.md`

## 核心能力

### AI Agent 能力
- 30+ 可调配置参数（参考 Claude Code / Codex / Aider 设计）
- 平台环境感知（OS / Shell / 可用工具）自动注入 LLM 决策上下文
- LLM 语义化工具输出分析（analyzer 自动提取 assets/evidence/findings）
- 失败智能分析（9 类错误分类 + 重试建议 + 替代工具推荐）
- 低 / 中风险工具批量并行执行，高风险串行审批
- 轮间确定性自我反思（无额外 LLM 调用）
- Token 预算上下文压缩

### 项目生命周期
- 状态机: `idle -> running -> paused -> stopped`
- 手动开始 -> LLM 多轮自动编排 -> 审批阻塞 / 恢复 -> 自动收束
- 队列跑空自动补报告导出 + 生成最终结论
- 审批恢复后继续推进后续动作

### 调度与执行
- Durable worker lease + orphan task 恢复
- Cooperative cancellation（运行中任务可停止）
- 项目级 pause / resume / cancel / retry
- MCP 编排范围约束（URL / IP 目标不误派 DNS 动作）

### 安全
- HMAC 签名 session cookie
- CSRF 双重提交 cookie
- 滑动窗口速率限制（登录 5/min, API 60/min）
- bcrypt 密码验证
- 多用户 RBAC（admin / researcher / approver）

## 已验证的真实闭环

以下靶场已通过完整的 `LLM 编排 -> MCP 执行 -> 发现 -> 报告` 闭环验证：

- **DVWA** — 多轮自动编排，发现 Apache 版本泄露 + 过时版本
- **DVWA Redis** — TCP 通用协议探测 + 未授权访问检测，4 资产、23 证据、1 高危发现（Redis 未授权访问）
- **Juice Shop** — 真实 LLM 编排 + Web 探测 + 审批恢复 + 结果沉淀
- **WebGoat** — 多次闭环验证，含 Actuator 匿名暴露发现 + 报告导出

## 文档索引

| 文档 | 用途 |
|------|------|
| `code_index.md` | 全量代码索引 |
| `roadmap.md` | 阶段规划与完成记录 |
| `docs/contracts/mcp-server-contract.md` | MCP Server 注册合同 |
| `docs/templates/mcp-connector-template.md` | MCP 接入模板 |
| `docs/operations/local-docker-labs.md` | Docker 靶场操作文档 |
| `docs/operations/llm-settings.md` | LLM 配置说明 |
| `docs/operations/mcp-onboarding-guide.md` | MCP 接入操作指南 |
| `docs/prompt-engineering.md` | Prompt 工程设计原则 |
| `docs/development-guide.md` | 开发指南 |

## 开发阶段历史

| Phase | 内容 | 状态 |
|-------|------|------|
| 1-3 | 前端原型 + Mock API + 真实后端核心 | 已完成 |
| 4-5 | MCP 编排执行 + 真实连接器 + 调度器 | 已完成 |
| 6-7 | 真实 LLM 编排 + Docker 验证 + MCP 扩展 | 已完成 |
| 8-9 | 调度控制 + 项目生命周期 + 自动收束 | 已完成 |
| 10-11 | 生产级 MCP 编排 + 前端闭环 | 已完成 |
| 12 | 漏洞驾驶舱重构 + LLM 日志系统 | 已完成 |
| 13-14 | 生产加固 (SSE / CSRF / 速率限制) + AI 聊天窗 | 已完成 |
| 15 | 多用户认证 + RBAC | 已完成 |
| 16 | Docker 靶场扩展 (TCP) + 自主脚本 MCP | 已完成 |
| 17a-d | Prisma 数据层迁移 (PostgreSQL 唯一数据层) | 已完成 |
| 17b | Agent 大脑进化 (配置 / 环境感知 / 压缩 / 反思) | 已完成 |
| 19 | 架构重构 (类型拆分 / facade 删除 / 模块分解) | 已完成 |
| 20 | 架构持续精简 + 二级模块拆分 | 已完成 |
| 21 | UI/UX 全站审查 + 5 轮真实使用 Debug | 已完成 |
| 22 | 真实渗透测试闭环验证 (多轮收敛 / 超时分离 / 覆盖检测) | 已完成 |
| 22b | LLM Writeback — 语义分析替代工具特定解析器 | 已完成 |
| 23 | 深度架构演进 (死代码清理 / 连接器工厂 / lib 领域化重组) | 已完成 |
| 23b | TCP 通用化 + llmCode 持久化 + 多轮上下文增强 | 已完成 |

## 接手指南

如果你是新接手的开发者或 LLM：

1. 读 `README.md`（本文件）了解全貌
2. 读 `code_index.md` 了解代码结构
3. 读 `roadmap.md` 了解阶段边界和当前优先级
4. 读 `prompts/phase20-continued-refactoring.md` 了解下一步开发方向

## 备注

- 当前版本适合作为可演示、可验证、可继续迭代的原型平台，尚未达到生产部署标准
- MCP Server 开发建议在独立仓库进行，完成后通过注册合同接入平台
- `.prototype-store/` 为历史遗留目录，数据已全部迁移到 PostgreSQL
