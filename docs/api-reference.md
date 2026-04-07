# API 参考

> 最后更新: 2026-04-07 | 51 个 API 路由

---

## 认证

所有 API（除 login/captcha/health）需要 session cookie。

```bash
# 登录
curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin@company.local","password":"Prototype@2026"}'

# 后续请求带 cookie 和 CSRF token
CSRF=$(grep csrf_token cookies.txt | awk '{print $NF}')
curl -b cookies.txt -H "x-csrf-token: $CSRF" http://localhost:3001/api/...
```

---

## 核心路由

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 `{name, targetInput, description}` — description 会注入所有 LLM prompt |
| GET | `/api/projects/[id]` | 项目详情（含 detail、assets、findings） |
| DELETE | `/api/projects/[id]` | 删除项目 |

### 项目执行控制

| 方法 | 路径 | 说明 |
|------|------|------|
| PATCH | `/api/projects/[id]/scheduler-control` | 控制生命周期 `{lifecycle: "running"/"paused"/"stopped"}` |
| GET | `/api/projects/[id]/operations` | 获取执行面板数据（runs, tasks, rounds, orchestrator） |

### 编排器

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects/[id]/orchestrator/local-validation` | 触发本地靶场验证 |
| POST | `/api/projects/[id]/mcp-workflow/smoke-run` | 单次 MCP 工具测试 |

### 审批

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/approvals` | 审批列表（含 pending/全部） |
| PUT | `/api/approvals/[id]` | 审批决策 `{decision: "approved"/"rejected", note?}` |
| PATCH | `/api/approvals/[id]` | 审批决策（前端用） `{status: "approved"/"rejected"}` |

### 结果数据

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/[id]/results/domains` | 域名资产 |
| GET | `/api/projects/[id]/results/network` | 端口/服务资产 |
| GET | `/api/projects/[id]/results/findings` | 漏洞/发现 |
| GET | `/api/projects/[id]/mcp-runs` | MCP 运行历史 |
| POST | `/api/projects/[id]/mcp-runs` | 手动调度 MCP 工具执行 |
| GET | `/api/projects/[id]/rounds/[round]/steps` | 获取指定轮次的 ReAct 步骤记录 |
| POST | `/api/projects/[id]/report-export` | 导出报告 |

### 实时事件

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/[id]/events` | SSE 实时事件流（Server-Sent Events） |

### AI 日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/[id]/llm-logs` | 项目 LLM 调用日志 |
| GET | `/api/llm-logs/recent` | 最近全局 LLM 日志 |
| GET | `/api/llm-logs/stream` | SSE 流式 LLM 日志 |

### 设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PUT/PATCH | `/api/settings/llm` | LLM 配置 `{provider, apiKey, baseUrl, model, timeoutMs}` |
| POST | `/api/settings/mcp-servers/register` | 注册 MCP 服务器 |
| PATCH | `/api/settings/mcp-tools/[id]` | MCP 工具配置更新 `{enabled, requiresApproval, timeout, description}` |
| POST | `/api/settings/mcp-tools/[id]/health-check` | MCP 工具健康巡检 |
| GET/PATCH | `/api/settings/approval-policy` | 审批策略 |
| GET/PATCH | `/api/settings/agent-config` | Agent 配置（maxRounds, maxParallelTools, timeout） |
| GET | `/api/settings/system-status` | 系统状态（DB/MCP/LLM 连接） |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/dashboard` | 仪表板聚合数据 |
| GET | `/api/vuln-center/summary` | 漏洞中心摘要 |

---

## 关键接口详情

### GET `/api/projects/[id]/rounds/[round]/steps`

返回指定轮次内所有 ReAct 步骤记录（McpRun 记录），按 `stepIndex` 升序排列。

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 项目 ID |
| `round` | number | 轮次编号（从 1 开始） |

**响应示例**

```json
{
  "steps": [
    {
      "stepIndex": 1,
      "thought": "需要先进行端口扫描以了解目标开放的服务",
      "functionArgs": {
        "tool": "nmap_scan",
        "target": "192.168.1.1",
        "ports": "1-1000"
      },
      "toolName": "nmap_scan",
      "status": "completed",
      "outputSummary": "发现开放端口：22, 80, 443",
      "createdAt": "2026-04-05T10:23:00Z"
    },
    {
      "stepIndex": 2,
      "thought": "HTTP 服务已确认，接下来进行目录扫描",
      "functionArgs": {
        "tool": "dirsearch",
        "url": "http://192.168.1.1"
      },
      "toolName": "dirsearch",
      "status": "completed",
      "outputSummary": "发现路径：/admin, /api, /login",
      "createdAt": "2026-04-05T10:25:30Z"
    }
  ],
  "totalSteps": 2,
  "round": 1
}
```

---

### GET `/api/projects/[id]/events`

SSE（Server-Sent Events）实时事件流，用于前端实时监听项目执行状态变化，无需轮询。

**连接方式**

```js
const es = new EventSource(`/api/projects/${id}/events`, { withCredentials: true });
es.onmessage = (e) => {
  const event = JSON.parse(e.data);
  console.log(event.type, event.payload);
};
```

**事件类型**

| 事件类型 | 触发时机 | payload 说明 |
|----------|----------|-------------|
| `react_step_started` | ReAct 步骤开始执行 | `{round, stepIndex, toolName, thought}` |
| `react_step_completed` | ReAct 步骤执行完毕 | `{round, stepIndex, toolName, status, outputSummary}` |
| `react_round_progress` | 轮次进度更新 | `{round, completedSteps, maxSteps}` |
| `round_reviewed` | 审阅者完成轮次评审 | `{round, decision: "continue"/"settle", reason}` |
| `lifecycle_changed` | 项目生命周期状态变化 | `{lifecycle: "running"/"paused"/"stopped"/"completed"}` |

---

## ReAct 执行模型

平台采用 **ReAct（Reason + Act）** 模式驱动渗透测试，每轮由 LLM 自主决策工具调用序列，无需预先生成计划。

### 轮次生命周期

```
lifecycle: "running"
      ↓
  触发 react_round 任务
      ↓
  LLM 通过 function calling 逐步选择工具
  （每步：thought → 选择工具 → 执行 → 观察结果 → 下一步）
      ↓
  轮次结束条件（满足其一）：
    • LLM 调用 done 控制函数
    • 达到最大步骤数（默认 30 步）
      ↓
  审阅者评审本轮结果
    • continue  → 触发下一轮 react_round
    • settle    → 触发 settle_closure（生成最终报告）
```

### 控制函数

LLM 在 ReAct 循环中可调用以下内置控制函数（非 MCP 工具）：

| 函数名 | 作用 |
|--------|------|
| `done` | 主动结束当前轮次，提交 summary 和 phase_suggestion |
| `report_finding` | 直接报告发现的漏洞或安全问题 |

---

## 典型工作流 API 调用序列

```bash
# 1. 登录
POST /api/auth/login {account, password}

# 2. 创建项目
POST /api/projects {name: "Test", targetInput: "http://target.com", description: "..."}
# → 返回 project.id

# 3. 启动项目（直接触发 react_round 任务，跳过规划阶段）
PATCH /api/projects/{id}/scheduler-control {lifecycle: "running"}
# → 后台开始 ReAct 执行，API 立即返回

# 4a. 实时监听进度（推荐）
GET /api/projects/{id}/events
# → SSE 流，监听 react_step_started / react_step_completed / react_round_progress 等事件

# 4b. 轮询进度（备选）
GET /api/projects/{id}/operations
# → 查看 mcpRuns, schedulerTasks, orchestratorRounds

# 5. 查看某轮次的 ReAct 步骤详情
GET /api/projects/{id}/rounds/1/steps
# → 返回该轮所有步骤，含 thought、functionArgs、执行结果

# 6. 处理审批（如有高风险操作触发审批）
GET /api/approvals?projectId={id}&status=pending
PATCH /api/approvals/{approvalId} {status: "approved"}

# 7. 审阅者评审轮次结果（continue 继续下一轮，settle 结案）
# → 通过 round_reviewed 事件监听评审决策结果

# 8. 查看结果
GET /api/projects/{id}
GET /api/projects/{id}/results/findings
GET /api/projects/{id}/results/domains
GET /api/projects/{id}/results/network

# 9. 导出报告
POST /api/projects/{id}/report-export
```
