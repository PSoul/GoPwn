# API 参考

> 最后更新: 2026-04-02 | 48 个 API 路由

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
| POST | `/api/projects` | 创建项目 `{name, targetInput, description}` |
| GET | `/api/projects/[id]` | 项目详情（含 detail、assets、findings） |
| PATCH | `/api/projects/[id]` | 更新项目 |
| DELETE | `/api/projects/[id]/archive` | 归档项目 |

### 项目执行控制

| 方法 | 路径 | 说明 |
|------|------|------|
| PATCH | `/api/projects/[id]/scheduler-control` | 控制生命周期 `{lifecycle: "running"/"paused"/"stopped"}` |
| GET | `/api/projects/[id]/operations` | 获取执行面板数据（runs, tasks, rounds, orchestrator） |

### 编排器

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects/[id]/orchestrator/plan` | 手动触发 LLM 计划生成 |
| POST | `/api/projects/[id]/orchestrator/local-validation` | 触发本地靶场验证 |
| POST | `/api/projects/[id]/mcp-workflow/smoke-run` | 单次 MCP 工具测试 |

### 审批

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/approvals` | 审批列表（含 pending/全部） |
| PATCH | `/api/approvals/[id]` | 审批决策 `{decision: "approved"/"rejected"/"deferred", reason}` |

### 结果数据

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/[id]/results/domains` | 域名资产 |
| GET | `/api/projects/[id]/results/network` | 端口/服务资产 |
| GET | `/api/projects/[id]/results/findings` | 漏洞/发现 |
| GET | `/api/projects/[id]/mcp-runs` | MCP 运行历史 |
| POST | `/api/projects/[id]/report-export` | 导出报告 |

### AI 日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/[id]/llm-logs` | 项目 LLM 调用日志 |
| GET | `/api/llm-logs/recent` | 最近全局 LLM 日志 |
| GET | `/api/llm-logs/stream` | SSE 流式 LLM 日志 |

### 设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PATCH | `/api/settings/llm` | LLM 配置 `{provider, apiKey, baseUrl, model, timeoutMs}` |
| POST | `/api/settings/mcp-servers/register` | 注册 MCP 服务器 |
| GET/PATCH | `/api/settings/mcp-tools/[id]` | MCP 工具管理 |
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

## 典型工作流 API 调用序列

```bash
# 1. 登录
POST /api/auth/login {account, password}

# 2. 创建项目
POST /api/projects {name: "Test", targetInput: "http://target.com", description: "..."}
# → 返回 project.id

# 3. 启动项目（触发 LLM 编排）
PATCH /api/projects/{id}/scheduler-control {lifecycle: "running"}
# → 后台开始执行，API 立即返回

# 4. 轮询进度
GET /api/projects/{id}/operations
# → 查看 mcpRuns, schedulerTasks, orchestratorRounds

# 5. 处理审批（如有）
GET /api/approvals?projectId={id}&status=pending
PATCH /api/approvals/{approvalId} {decision: "approved", reason: "..."}

# 6. 查看结果
GET /api/projects/{id}  # 含 finalConclusion
GET /api/projects/{id}/results/findings
GET /api/projects/{id}/results/domains
GET /api/projects/{id}/results/network

# 7. 导出报告
POST /api/projects/{id}/report-export
```
