# V2 架构文档

> 本文档描述 LLM 渗透测试平台 v2 的架构设计、与 v1 的对比分析以及当前状态。

## 1. 架构总览

V2 采用 **双进程 + 异步任务队列 + 事件驱动** 架构：

```
┌──────────────────────────────────┐
│  Next.js 进程 (API + SSR)       │
│  ├─ API Routes (<5s 响应)       │
│  ├─ SSR 页面渲染               │
│  └─ SSE 端点 (实时事件推送)     │
└──────────────┬───────────────────┘
               │ pg-boss 任务队列
               │ PostgreSQL LISTEN/NOTIFY
┌──────────────▼───────────────────┐
│  Worker 进程 (长任务处理)        │
│  ├─ Planning Worker  (LLM 规划)  │
│  ├─ Execution Worker (MCP 执行)  │
│  ├─ Analysis Worker  (LLM 分析)  │
│  ├─ Verification Worker (PoC)    │
│  └─ Lifecycle Worker (生命周期)  │
└──────────────────────────────────┘
```

**技术栈**: Next.js 15 + React 19 + TypeScript + Prisma 7 + PostgreSQL 16 + pg-boss + JWT

---

## 2. 核心设计决策

### 2.1 纯函数状态机

10 个状态，12 种事件，所有转换通过 `transition(current, event)` 纯函数完成：

```
idle → planning → executing → reviewing → planning (循环)
                      ↓
               waiting_approval → executing
                      
            → settling → completed
                 ↓
               failed → planning (RETRY)
```

### 2.2 五实体领域模型

| 实体 | 用途 | 关键字段 |
|------|------|---------|
| **Project** | 顶层容器 | lifecycle, currentPhase, currentRound, maxRounds |
| **Asset** | 发现的资产（树形） | kind, value, parentId, fingerprints[] |
| **Finding** | 安全发现 | severity, status(suspected→verified/false_positive), evidenceId |
| **Evidence** | 原始证据 | toolName, rawOutput, mcpRunId |
| **McpRun** | 工具执行记录 | status, riskLevel, phase, round, rawOutput |

辅助实体: Approval, OrchestratorPlan, OrchestratorRound, LlmCallLog, AuditEvent, Poc, Fingerprint

### 2.3 六种异步任务

| 任务 | 触发时机 | 处理逻辑 |
|------|---------|---------|
| `plan_round` | 项目启动 / 上轮继续 | LLM 规划 → 创建 MCP runs |
| `execute_tool` | 计划自动批准 / 人工批准 | 调用 MCP 工具 → 存储输出 |
| `analyze_result` | 工具执行成功 | LLM 分析 → 提取 asset/finding |
| `verify_finding` | 发现非 info 级别问题 | LLM 生成 PoC → 执行验证 |
| `round_completed` | 本轮所有 run 完成(延迟30s) | LLM 审查 → continue/settle |
| `settle_closure` | 审查决定结束 | 生成报告 → 标记 completed |

### 2.4 动态 MCP 工具管理

```
mcps/mcp-servers.json → loadServersFromManifest() → McpServer 表
                       → syncToolsFromServers() → stdio JSON-RPC tools/list → McpTool 表
                       → inferCapability() 自动推断能力族
```

**新增 MCP 工具的流程**:
1. 在 `mcps/` 下创建新的 MCP server
2. 在 `mcps/mcp-servers.json` 中添加配置
3. 重启 worker 或调用 `POST /api/settings/mcp/sync`
4. 工具自动发现、注册、归类

**15 种能力族**: dns_subdomain, dns_whois, external_intel, host_discovery, port_scan, asset_scan, credential_test, web_probe, waf_detection, fingerprint, web_crawl, http_interaction, tcp_interaction, vuln_scan, code_execution, crypto_tool, file_io, screenshot

### 2.5 System Prompt 动态加载

LLM 的系统提示从文件加载（默认 `mcps/pentest-agent-prompt.md`），包含完整的 11 阶段渗透方法论。修改提示不需要改代码。

---

## 3. V1 vs V2 对比

### 3.1 架构级差异

| 维度 | V1 | V2 |
|------|----|----|
| **进程模型** | 单进程（HTTP 请求内执行长任务） | 双进程（API + Worker 分离） |
| **编排方式** | 同步 while 循环在 HTTP 请求中 | 异步任务链在 Worker 中 |
| **任务队列** | 手动 SchedulerTask + 租约机制 | pg-boss（PostgreSQL 原生） |
| **状态管理** | 隐式（字符串条件分支） | 显式纯函数状态机 |
| **数据模型** | 13 个 JSON 列在 ProjectDetail 中 | 规范化表（13 个模型，10 个枚举） |
| **状态值** | 中文字符串 `"运行中"` | TypeScript 枚举 `executing` |
| **MCP 连接器** | 10 个专用连接器 | 1 个通用 stdio 连接器 + 注册表 |
| **错误处理** | `catch {}` 静默吞错 | 类型化 DomainError + 重试 |
| **代码量** | lib/ ~15,000 行 | lib/ ~7,700 行 |
| **可扩展性** | 不可能（状态在内存中） | 可水平扩展（无状态 Worker） |

### 3.2 V1 的根本问题

1. **HTTP 请求超时**: 5-30 分钟的渗透流程在单个 HTTP 请求中执行，超时后成为僵尸进程
2. **手动租约管理**: SchedulerTask 用时间戳 + UUID 管理租约，存在竞态条件
3. **无检查点**: 进程崩溃后无法恢复，项目卡在 "运行中"
4. **JSON 列反模式**: 所有状态塞在 JSON 列中，无法查询优化
5. **同步执行**: `Promise.allSettled()` 在请求中等待所有工具完成
6. **LLM 流中断**: SSE 流断裂后 `completeLlmCallLog()` 永远不会被调用

### 3.3 V2 如何解决

| V1 Bug | V2 方案 |
|--------|---------|
| 调度任务卡在 "running" | pg-boss 自动检测停滞任务并重试 |
| LLM 日志卡在 "streaming" | Worker 启动时 `cleanupStale()` 清理超时日志 |
| 自动重规划崩溃 | 每个 job 独立；失败不传播 |
| 项目卡在 "运行中" | `round_completed` 任务始终运行，始终更新状态 |
| 工具结果丢失 | 每个 job 结果持久化到 DB 后才触发下一步 |
| 审批绕过 | `approveAction()` API 立即调度 `execute_tool` |
| 并发数据竞争 | Prisma 事务保证原子性 |

### 3.4 V2 的当前限制

1. **无水平扩展测试**: 虽然架构支持多 Worker，但未实测
2. **能力推断**: `inferCapability()` 基于名称/描述模式匹配，新工具可能需要调整
3. **证据存储**: 原始输出存 DB 文本列，大文件应考虑对象存储
4. ~~**Finding 去重**: 跨轮次无内建去重机制~~ **[Phase 24b 已修复]** — normalizeTitle 模糊匹配去重
5. **可观测性**: 无 Prometheus 指标，依赖日志和审计事件
6. **连接池**: 每个 MCP server 一个 stdio 进程，不支持并行工具调用

### 3.5 Phase 24b 稳定性修复 (2026-04-05)

| 问题 | 修复 |
|------|------|
| IPv6 连接超时 | `instrumentation.ts` 设置 `dns.setDefaultResultOrder("ipv4first")` |
| MCP 进程超时卡死 | stdio-connector RPC timeout 时 SIGKILL 子进程 |
| DB 连接池耗尽 | PrismaPg 配置 `max: 10, idleTimeoutMillis: 30000` |
| round_completed 不触发 | `updateStatus` 转 terminal 时自动检查并发布 |
| Finding 重复 | `normalizeTitle()` 模糊匹配（去除空格/标点/通用词差异） |
| 工具参数错误 | `buildToolInput` 增加 `rawRequest` 自动构造 |

---

## 4. 目录结构

```
lib/
├── domain/          # 纯领域逻辑（无 I/O）
│   ├── lifecycle.ts       # 状态机
│   ├── phases.ts          # 渗透阶段定义
│   ├── risk-policy.ts     # 风险审批策略
│   └── errors.ts          # 领域错误类型
│
├── infra/           # 基础设施
│   ├── prisma.ts          # Prisma 客户端
│   ├── job-queue.ts       # pg-boss 抽象
│   ├── event-bus.ts       # PostgreSQL NOTIFY
│   ├── pg-listener.ts     # LISTEN（SSE 用）
│   ├── auth.ts            # JWT 认证
│   └── api-handler.ts     # API 错误包装
│
├── workers/         # 5 个 Job Handler
│   ├── planning-worker.ts
│   ├── execution-worker.ts
│   ├── analysis-worker.ts
│   ├── verification-worker.ts
│   └── lifecycle-worker.ts
│
├── mcp/             # MCP 工具管理
│   ├── connector.ts       # 接口定义
│   ├── stdio-connector.ts # stdio JSON-RPC
│   ├── registry.ts        # 工具注册 + 能力推断
│   └── index.ts
│
├── llm/             # LLM 提供者
│   ├── provider.ts        # 抽象接口
│   ├── openai-provider.ts # OpenAI 兼容实现
│   ├── call-logger.ts     # 调用日志装饰器
│   ├── prompts.ts         # 4 种角色 prompt
│   ├── system-prompt.ts   # 动态加载系统提示
│   └── index.ts
│
├── services/        # 业务逻辑
│   ├── project-service.ts
│   ├── approval-service.ts
│   ├── mcp-bootstrap.ts
│   └── ...
│
├── repositories/    # 数据访问层
│   ├── project-repo.ts
│   ├── asset-repo.ts
│   ├── finding-repo.ts
│   ├── mcp-run-repo.ts
│   ├── mcp-tool-repo.ts
│   └── ...
│
└── hooks/           # React Hooks
    └── use-project-events.ts

worker.ts            # Worker 入口
middleware.ts         # JWT 认证中间件
mcps/                # 14 个 MCP Server
mcps/mcp-servers.json       # Server 清单
mcps/pentest-agent-prompt.md # LLM 系统提示
```

---

## 5. API 端点

### 项目管理
| 方法 | 路由 | 功能 |
|------|------|------|
| GET | /api/projects | 项目列表 |
| POST | /api/projects | 创建项目 |
| GET | /api/projects/[id] | 项目详情 |
| POST | /api/projects/[id]/start | 启动渗透 |
| POST | /api/projects/[id]/stop | 停止渗透 |

### 项目数据
| 方法 | 路由 | 功能 |
|------|------|------|
| GET | /api/projects/[id]/assets | 资产列表 |
| GET | /api/projects/[id]/findings | 发现列表 |
| GET | /api/projects/[id]/evidence | 证据列表 |
| GET | /api/projects/[id]/mcp-runs | 执行记录 |
| GET | /api/projects/[id]/llm-logs | LLM 日志 |
| GET | /api/projects/[id]/orchestrator | 规划&轮次 |
| GET | /api/projects/[id]/events | SSE 实时事件 |

### 审批
| 方法 | 路由 | 功能 |
|------|------|------|
| GET | /api/projects/[id]/approvals | 待审批列表 |
| PUT | /api/approvals/[id] | 审批决策 |

### 设置
| 方法 | 路由 | 功能 |
|------|------|------|
| GET/POST | /api/settings/llm | LLM 配置 |
| GET/POST | /api/settings/mcp/servers | MCP 服务器管理 |
| POST | /api/settings/mcp/sync | 触发工具发现 |

### 认证
| 方法 | 路由 | 功能 |
|------|------|------|
| POST | /api/auth/login | 登录（JWT cookie） |
| POST | /api/auth/logout | 登出 |

---

## 6. MCP 工具清单 (38 个工具)

| Server | 工具名 | 能力族 | 描述 |
|--------|--------|--------|------|
| **fscan** | fscan_host_discovery | host_discovery | ICMP/ping 主机存活探测 |
| | fscan_port_scan | port_scan | 端口扫描 + 服务识别 |
| | fscan_service_bruteforce | credential_test | 服务弱口令爆破 |
| | fscan_vuln_scan | vuln_scan | 已知漏洞扫描 (MS17-010 等) |
| | fscan_web_scan | vuln_scan | Web POC 扫描 |
| | fscan_full_scan | port_scan | 综合扫描 |
| **subfinder** | subfinder_enum | dns_subdomain | 被动子域名枚举 |
| | subfinder_verify | dns_subdomain | 子域名枚举 + DNS 验证 |
| **httpx** | httpx_probe | host_discovery | Web 存活探测 |
| | httpx_tech_detect | fingerprint | 技术栈识别 |
| **curl** | http_request | http_interaction | 自定义 HTTP 请求 |
| | http_raw_request | http_interaction | 原始 TCP 发送 HTTP 包 |
| | http_batch | http_interaction | 批量 HTTP 请求 |
| **netcat** | tcp_connect | tcp_interaction | TCP 连接 + 数据收发 |
| | udp_send | tcp_interaction | UDP 发送 |
| | tcp_banner_grab | tcp_interaction | TCP Banner 抓取 |
| **afrog** | afrog_scan | vuln_scan | POC 漏洞扫描 |
| | afrog_list_pocs | vuln_scan | 列出可用 POC |
| **dirsearch** | dirsearch_scan | web_crawl | 目录/文件扫描 |
| | dirsearch_recursive | web_crawl | 递归目录扫描 |
| **fofa** | fofa_search | external_intel | FOFA 资产搜索 |
| | fofa_host | external_intel | FOFA 主机详情 |
| | fofa_stats | external_intel | FOFA 统计 |
| **whois** | whois_query | dns_whois | 域名 WHOIS |
| | whois_ip | dns_whois | IP WHOIS |
| | icp_query | dns_whois | ICP 备案查询 |
| **encode** | encode_decode | crypto_tool | 编解码 (base64/hex/URL 等) |
| | hash_compute | crypto_tool | 哈希计算 |
| | crypto_util | crypto_tool | 加解密 + JWT 解析 |
| **wafw00f** | wafw00f_detect | waf_detection | WAF 检测 |
| | wafw00f_list | waf_detection | WAF 列表 |
| **github-recon** | github_code_search | external_intel | GitHub 代码泄露搜索 |
| | github_repo_search | external_intel | GitHub 仓库搜索 |
| | github_commit_search | external_intel | GitHub 提交搜索 |
| **script** | execute_code | code_execution | 执行 Node.js 代码 |
| | execute_command | code_execution | 执行 shell 命令 |
| | read_file | file_io | 读取文件 |
| | write_file | file_io | 写入文件 |

---

## 7. 渗透流程 (完整生命周期)

```
用户创建项目 → POST /api/projects
     ↓
用户启动 → POST /api/projects/{id}/start
     ↓
idle → planning (触发 plan_round job)
     ↓
┌─ LLM Planner 生成计划 (最多5个任务)
│  ├─ 低风险: 自动批准 → execute_tool
│  └─ 高风险: 创建 Approval → waiting_approval
│
│  (用户审批 → PUT /api/approvals/{id})
│
├─ Execution Worker 调用 MCP 工具
│  └─ 成功 → analyze_result
│
├─ Analysis Worker: LLM 提取 asset/finding
│  └─ 非 info → verify_finding
│
├─ Verification Worker: LLM 生成 PoC → 执行
│  └─ verified / false_positive
│
├─ 所有 run 完成 → round_completed (30s延迟)
│
├─ Lifecycle Worker: LLM Reviewer 决策
│  ├─ continue → plan_round(round+1)
│  └─ settle → settle_closure → completed
│
└─ 实时事件通过 SSE 推送到前端
```
