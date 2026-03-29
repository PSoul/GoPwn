# Production-Ready MCP Orchestration Design

**Date**: 2026-03-29
**Status**: Approved
**Goal**: 将平台从原型推进到生产可用，实现完整的自动化渗透测试闭环

## 1. 概述

当前平台已具备完整的项目生命周期、LLM 编排框架、审批网关、调度器和 UI 控制台。但存在两个核心差距：

1. **MCP 工具未真正对接** — 平台有 5 个内置 Node.js 连接器，但 `D:\dev\mcps` 的 12 个 MCP 服务器（34 个工具）尚未通过 stdio 协议接入
2. **编排是单轮的** — LLM 生成一批计划执行完就关闭项目，没有"分析结果 → 决定下一步 → 继续执行"的自动循环

### 目标流程

```
登录 → 新建项目 → 设置靶标 → 点击开始
→ LLM 第 1 轮：分析目标，生成计划（子域枚举、Web 探测等低风险动作）
→ MCP 通过 stdio 执行，结果回流平台
→ LLM 第 2 轮：分析结果，发现管理后台，安排目录枚举 + 端口扫描
→ MCP 执行，结果回流
→ LLM 第 N 轮：发现暴露接口，安排高风险验证（进审批）
→ 研究员批准 → MCP 执行验证 → 确认漏洞
→ LLM 判断"结果已足够" → 生成最终报告 → 项目完成
```

## 2. MCP 本地化与自动发现

### 2.1 目录结构

将 `D:\dev\mcps` 的内容复制到项目根目录的 `mcps/` 下：

```
项目根目录/
  mcps/
    fscan-mcp-server/
      src/index.ts
      package.json
    subfinder-mcp-server/
    httpx-mcp-server/
    curl-mcp-server/
    netcat-mcp-server/
    dirsearch-mcp-server/
    wafw00f-mcp-server/
    afrog-mcp-server/
    whois-mcp-server/
    fofa-mcp-server/
    github-recon-mcp-server/
    encode-mcp-server/
    mcp-servers.json            ← 中央配置（相对路径）
```

### 2.2 自动发现机制

平台启动（或设置页刷新）时：

1. 扫描 `mcps/` 下所有含 `package.json` + `src/index.ts` 的子目录
2. 读取 `mcps/mcp-servers.json` 获取启动命令和环境变量
3. 将发现的工具自动注册到平台 MCP 工具表
4. 按预定义映射表分配 capability / riskLevel / boundary
5. 标记为"已启用"状态

### 2.3 Capability 映射表

| MCP Server | 工具 | capability | riskLevel | boundary |
|---|---|---|---|---|
| subfinder | subfinder_enum | DNS / 子域 / 证书情报类 | 低 | external-target |
| subfinder | subfinder_verify | DNS / 子域 / 证书情报类 | 低 | external-target |
| fscan | fscan_host_discovery | 端口与服务探测类 | 中 | external-target |
| fscan | fscan_port_scan | 端口与服务探测类 | 中 | external-target |
| fscan | fscan_service_bruteforce | 受控验证类 | 高 | external-target |
| fscan | fscan_vuln_scan | 受控验证类 | 高 | external-target |
| fscan | fscan_web_scan | 受控验证类 | 高 | external-target |
| fscan | fscan_full_scan | 受控验证类 | 高 | external-target |
| httpx | httpx_probe | Web 页面探测类 | 低 | external-target |
| httpx | httpx_tech_detect | Web 页面探测类 | 低 | external-target |
| dirsearch | dirsearch_scan | HTTP / API 结构发现类 | 中 | external-target |
| dirsearch | dirsearch_recursive | HTTP / API 结构发现类 | 中 | external-target |
| curl | http_request | HTTP 数据包交互类 | 中 | external-target |
| curl | http_raw_request | HTTP 数据包交互类 | 中 | external-target |
| curl | http_batch | HTTP 数据包交互类 | 中 | external-target |
| netcat | tcp_connect | TCP/UDP 数据包交互类 | 中 | external-target |
| netcat | udp_send | TCP/UDP 数据包交互类 | 中 | external-target |
| netcat | tcp_banner_grab | TCP/UDP 数据包交互类 | 低 | external-target |
| wafw00f | wafw00f_detect | Web 页面探测类 | 低 | external-target |
| wafw00f | wafw00f_list | Web 页面探测类 | 低 | platform-internal |
| afrog | afrog_scan | 受控验证类 | 高 | external-target |
| afrog | afrog_list_pocs | 受控验证类 | 低 | platform-internal |
| whois | whois_query | 外部情报查询类 | 低 | external-third-party |
| whois | whois_ip | 外部情报查询类 | 低 | external-third-party |
| whois | icp_query | 外部情报查询类 | 低 | external-third-party |
| fofa | fofa_search | 外部情报查询类 | 低 | external-third-party |
| fofa | fofa_host | 外部情报查询类 | 低 | external-third-party |
| fofa | fofa_stats | 外部情报查询类 | 低 | external-third-party |
| github-recon | github_code_search | 外部情报查询类 | 低 | external-third-party |
| github-recon | github_repo_search | 外部情报查询类 | 低 | external-third-party |
| github-recon | github_commit_search | 外部情报查询类 | 低 | external-third-party |
| encode | encode_decode | 编解码与密码学工具类 | 低 | platform-internal |
| encode | hash_compute | 编解码与密码学工具类 | 低 | platform-internal |
| encode | crypto_util | 编解码与密码学工具类 | 低 | platform-internal |

### 2.4 zip 上传新增 MCP（本次预留接口，后续实现）

- 设置页提供 zip 上传入口
- 解压到 `mcps/` + 自动 `npm install` + 注册
- 需要 `mcp-manifest.json` 声明元数据

## 3. 通用 stdio MCP 连接器

### 3.1 架构

新增 `lib/mcp-connectors/stdio-mcp-connector.ts`，作为通用连接器：

```
连接器注册表优先级:
1. stdio MCP 连接器（匹配已注册的外部 MCP 工具）
2. 现有内置连接器（DNS、Web、HTTP结构、HTTP验证、Playwright）
3. 本地 fallback 连接器
```

### 3.2 执行流程

```
1. 从 mcp-servers.json 读取 server 启动配置
2. spawn 子进程: npx tsx mcps/<server>/src/index.ts
3. 通过 @modelcontextprotocol/sdk StdioClientTransport 建立连接
4. client.callTool(toolName, params) 发送请求
5. 等待响应（带超时 + AbortSignal）
6. 解析 JSON 响应 → 归一化为平台格式
7. 关闭连接 + kill 子进程
```

### 3.3 输出归一化

MCP 工具返回的 JSON 通过 capability 分支处理：

- **DNS/子域类** → `domains[]` → AssetRecord (type=domain)
- **端口探测类** → `network[]` → AssetRecord (type=port/service)
- **Web 探测类** → `webEntries[]` → AssetRecord (type=entry) + EvidenceRecord
- **目录枚举类** → `webEntries[]` → AssetRecord (type=entry)
- **情报查询类** → `intelligence{}` → EvidenceRecord + AssetRecord
- **受控验证类** → `findings[]` → ProjectFindingRecord + EvidenceRecord
- **HTTP/TCP 交互类** → raw response → EvidenceRecord
- **编解码类** → result → EvidenceRecord (辅助型，一般不产生资产)

### 3.4 进程管理

- 每次调用 spawn 新进程，执行完关闭（避免进程泄漏）
- 超时保护：默认 300s，高风险扫描类 600s
- AbortSignal 传播：收到中断信号时 kill 子进程
- 错误处理：spawn 失败、连接超时、解析失败均有明确错误码

## 4. 多轮自动编排循环

### 4.1 循环控制流

```
runProjectLifecycleKickoff(projectId, {controlCommand: "start"})
  ↓
[轮次 1] generateProjectLifecyclePlan() → executePlanItems() → drainStoredSchedulerTasks()
  ↓
队列清空 → checkAutoReplan(projectId)
  ↓ autoReplan === true
buildRoundSummary(projectId, roundNumber)    // 构建本轮摘要
  ↓
evaluateProgress(projectId)                   // 检查停止条件
  ↓ shouldContinue === true
generateProjectLifecyclePlan(projectId, {controlCommand: "replan"})
  ↓
[轮次 N] executePlanItems() → drainStoredSchedulerTasks()
  ↓
... 循环直到停止条件触发 ...
  ↓
settleProjectLifecycleClosure(projectId)      // 生成报告 + 最终结论
```

### 4.2 停止条件

任一触发即停止循环：

1. **LLM 主动停止** — 返回空 items 或 summary 包含明确收尾信号
2. **最大轮次** — 默认 10 轮，可在项目设置中调整
3. **无进展检测** — 连续 2 轮没有新增资产/证据/发现
4. **用户干预** — 手动暂停或停止
5. **审批阻塞** — 有未处理的高风险审批（暂停循环，审批通过后继续）

### 4.3 autoReplan 开关

- `ProjectSchedulerControl` 新增字段: `autoReplan: boolean`（默认 true）
- UI 操作面板新增开关："自动续跑"
- 关闭时：每轮执行完暂停，展示 LLM 建议，用户点"继续下一轮"触发 replan

### 4.4 轮次状态追踪

新增 `OrchestratorRoundRecord` 类型：

```typescript
type OrchestratorRoundRecord = {
  round: number
  startedAt: string
  completedAt: string
  planItemCount: number
  executedCount: number
  newAssetCount: number
  newEvidenceCount: number
  newFindingCount: number
  failedActions: string[]
  blockedByApproval: string[]
  summaryForNextRound: string    // 压缩摘要，注入下一轮 prompt
}
```

存储在 `PrototypeStore.orchestratorRounds[projectId]: OrchestratorRoundRecord[]`

## 5. Prompt 与上下文管理

### 5.1 分层上下文策略

```
┌─────────────────────────────────────────────┐
│  Layer 1: 固定上下文 (~15% token)            │
│  - 系统 prompt（编排规则）                    │
│  - 项目元数据（名称、目标、描述）             │
│  - 可用工具列表                               │
│  - 自动/手动状态、最大轮次、当前轮次         │
├─────────────────────────────────────────────┤
│  Layer 2: 轮次摘要 (~25% token)              │
│  - 最近 3 轮完整摘要                         │
│  - 更早轮次合并为单行概要                     │
├─────────────────────────────────────────────┤
│  Layer 3: 资产画像快照 (~30% token)           │
│  - 从平台存储实时构建（非缓存）              │
│  - 已确认资产清单（按类型分组）              │
│  - 已确认漏洞清单                             │
│  - 待处理审批队列                             │
│  - 未使用的能力列表                           │
├─────────────────────────────────────────────┤
│  Layer 4: 当前轮次指令 (~30% token)           │
│  - 上一轮执行结果详情（不压缩）              │
│  - 控制指令（继续/收尾）                     │
│  - 停止条件提示                               │
└─────────────────────────────────────────────┘
```

### 5.2 轮次摘要构建（平台代码生成，不消耗额外 LLM 调用）

```typescript
function buildRoundSummary(projectId: string, round: number): string {
  // 从平台存储直接计算，不调用 LLM
  const runs = getMcpRunsForRound(projectId, round)
  const newAssets = getNewAssetsInRound(projectId, round)
  const newFindings = getNewFindingsInRound(projectId, round)
  const failed = runs.filter(r => r.status === '已阻塞')
  const blocked = runs.filter(r => r.status === '待审批')

  return `第${round}轮: 执行${runs.length}个动作, ` +
    `新增${newAssets.length}个资产/${newFindings.length}个发现, ` +
    `${failed.length}个失败, ${blocked.length}个待审批. ` +
    `关键发现: ${newFindings.map(f => f.title).join(', ') || '无'}`
}
```

### 5.3 资产画像快照（实时从存储构建）

```typescript
function buildAssetSnapshot(projectId: string): string {
  const assets = listStoredAssets(projectId)
  const findings = listStoredProjectFindings(projectId)

  const domains = assets.filter(a => a.type === 'domain')
    .map(a => `${a.label} [${a.scopeStatus}]`)
  const ports = assets.filter(a => a.type === 'port')
    .map(a => `${a.label}`)
  const services = assets.filter(a => a.type === 'service')
    .map(a => `${a.label}`)
  const entries = assets.filter(a => a.type === 'entry')
    .map(a => `${a.label}`)
  const vulns = findings
    .map(f => `${f.title} [${f.severity}/${f.status}]`)

  // 每类最多展示 20 条，超出显示 "+N more"
  return formatSnapshotSection('域名', domains, 20) + '\n' +
    formatSnapshotSection('端口', ports, 20) + '\n' +
    formatSnapshotSection('服务', services, 20) + '\n' +
    formatSnapshotSection('Web入口', entries, 20) + '\n' +
    formatSnapshotSection('漏洞/发现', vulns, 20)
}
```

### 5.4 上下文压缩规则

- **最近 3 轮**: 保留完整摘要（每轮 ~100-200 tokens）
- **第 4 轮及更早**: 每 3 轮合并为 1 行概要（~50 tokens）
- **资产画像**: 每类最多 20 条，超出截断并标注数量
- **可用工具列表**: 只列出尚未在本项目中使用过的工具 + 最近使用的 3 个工具

### 5.5 增强版编排 Prompt

```
[系统 prompt]
你是授权渗透测试平台里的 LLM 编排大脑。
（现有规则保持不变）
新增规则：
- 当前是第 {N} 轮编排，你需要基于已有发现决定下一步。
- 如果认为当前结果已足够完整，返回 items: [] 并在 summary 中说明收尾原因。
- 不要重复已经成功执行过的相同动作。
- 优先覆盖尚未使用的能力维度。

[项目信息]
项目名称：xxx
目标列表：xxx
当前轮次：第 {N} 轮（共最多 {maxRounds} 轮）
自动续跑：{开启/关闭}

[历史轮次摘要]
第1-3轮概要：完成目标解析和子域枚举，发现12个子域、8个Web入口。
第4轮：对 admin.target.com 执行目录枚举，发现 /api-docs 和 /actuator。
第5轮：对 actuator 执行受控验证，确认匿名访问漏洞。

[当前资产画像]
域名(12): target.com, api.target.com, admin.target.com, ...
端口(5): admin.target.com:443, admin.target.com:8080, ...
漏洞(1): Spring Actuator 匿名暴露 [高危/已确认]
待审批(0)

[上一轮执行详情]
- afrog_scan(admin.target.com:8080) → 成功 → 发现 CVE-2024-xxxx
- httpx_tech_detect(api.target.com) → 成功 → Nginx 1.24 + React

[尚未使用的能力]
- TCP/UDP 数据包交互类 (netcat)
- 编解码与密码学工具类 (encode)
- 外部情报查询类 / FOFA (fofa)

[可用工具列表]
（完整列表）
```

## 6. LLM 配置预填

### 6.1 默认配置

三个 profile（orchestrator / reviewer / extractor）预填：

```
apiKey: sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc
baseUrl: https://api.siliconflow.cn/
model: Pro/deepseek-ai/DeepSeek-V3.2
```

### 6.2 实现方式

在 `lib/llm-settings-repository.ts` 的默认值中直接设置，而非硬编码在代码中。首次启动时如果没有已保存的 LLM 配置，自动使用上述默认值。用户可在设置页修改。

## 7. 需要修改的文件清单

### 新增文件

| 文件 | 职责 |
|---|---|
| `lib/mcp-connectors/stdio-mcp-connector.ts` | 通用 stdio MCP 连接器 |
| `lib/mcp-auto-discovery.ts` | MCP 自动发现与注册 |
| `lib/orchestrator-round-repository.ts` | 轮次记录存储与查询 |
| `lib/orchestrator-context-builder.ts` | 分层上下文构建器 |
| `mcps/` | 完整 MCP 工具目录（从外部复制） |

### 修改文件

| 文件 | 改动 |
|---|---|
| `lib/orchestrator-service.ts` | 加入多轮循环控制、replan 自动触发 |
| `lib/llm-brain-prompt.ts` | 增强 prompt 结构，支持轮次上下文 |
| `lib/mcp-connectors/registry.ts` | 注册 stdio 连接器，调整优先级 |
| `lib/mcp-execution-service.ts` | 扩展归一化处理，支持 34 个工具的输出格式 |
| `lib/prototype-types.ts` | 新增 OrchestratorRoundRecord、autoReplan 字段 |
| `lib/prototype-store.ts` | 新增 orchestratorRounds 存储 |
| `lib/project-scheduler-control-repository.ts` | 支持 autoReplan 开关 |
| `lib/llm-settings-repository.ts` | 默认 LLM 配置预填 |
| `lib/platform-config.ts` | 新增 capability 类型 |
| `components/projects/project-scheduler-runtime-panel.tsx` | 新增"自动续跑"开关 UI |
| `components/projects/project-orchestrator-panel.tsx` | 轮次状态展示 |
| `mcps/mcp-servers.json` | 路径改为相对路径 |
| `.gitignore` | 添加 *.txt 忽略规则 |

## 8. 测试策略

### 8.1 单元测试

- stdio 连接器：mock spawn + MCP 协议交互
- 自动发现：mock 文件系统扫描
- 多轮循环：mock LLM 响应序列，验证停止条件
- 上下文构建器：验证分层策略和压缩规则
- 轮次摘要：验证从存储数据生成摘要的准确性

### 8.2 API 测试

- 启动项目 → 验证多轮循环触发
- autoReplan 开关切换 → 验证行为差异
- 审批阻塞 → 验证循环暂停/恢复
- 最大轮次 → 验证停止

### 8.3 E2E 测试

- 完整闭环：登录 → 创建项目 → 设置目标 → 启动 → 等待多轮完成 → 查看报告
- 使用本地靶场（Juice Shop / WebGoat）作为真实目标

### 8.4 集成测试（真实 LLM + 真实 MCP）

- 使用提供的 SiliconFlow API 配置
- 对本地靶场执行至少 3 轮自动编排
- 验证资产/证据/发现的归一化和持久化

## 9. 不在本次范围

- zip 上传 MCP（预留接口）
- mcp-manifest.json 规范
- 生产级数据库替换
- 多用户 / RBAC
- 分布式执行
- MCP 市场
