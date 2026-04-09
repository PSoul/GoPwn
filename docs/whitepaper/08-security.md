# 08 — 安全机制与审批系统

> 作为渗透测试平台，GoPwn 自身的安全性至关重要。本章描述平台的认证鉴权、CSRF 防护、审批工作流、Scope 策略和审计日志系统。

---

## 8.1 认证与鉴权

### JWT 会话管理

GoPwn 使用 JWT（JSON Web Token）进行会话管理：

1. 用户通过 `POST /api/auth/login` 提交账号密码
2. 服务端使用 bcryptjs 验证密码
3. 验证通过后，使用 jose 库生成 JWT token
4. JWT 存储在名为 `pentest_token` 的 HttpOnly cookie 中
5. 后续请求通过 `middleware.ts` 验证 JWT 有效性

### Middleware 路由保护

Next.js middleware 对所有请求执行认证检查：

| 路由类型 | 未认证行为 |
|---------|-----------|
| API 路由（非公开） | 返回 401 JSON |
| 页面路由（非登录页） | 302 重定向到 `/login?from=原路径` |
| 登录页（已认证） | 302 重定向到 `/dashboard` |
| 公开 API（login/logout/health） | 直接放行 |

### CSRF 防护

平台实现双重提交 Cookie 模式的 CSRF 防护：

1. 登录时服务端设置 `csrf_token` cookie
2. 前端请求时从 cookie 读取 token，放入 `x-csrf-token` 请求头
3. 服务端比对 cookie 中的 token 和请求头中的 token
4. E2E 测试模式（`E2E_TEST_MODE=true`）可绕过 CSRF 检查

### 密码安全

- 用户密码使用 bcryptjs 哈希存储（不存储明文）
- 生产环境必须设置 `PROTOTYPE_SESSION_SECRET`（JWT 签名密钥）
- 默认开发密钥 `dev-secret-change-in-production` 仅用于本地开发

## 8.2 审批工作流

### 风险等级分类

每个 MCP 工具注册时指定风险等级：

| 风险等级 | 说明 | 默认策略 |
|---------|------|---------|
| `low` | 被动侦察（DNS 查询、WHOIS） | 自动批准 |
| `medium` | 主动探测（端口扫描、目录扫描） | 可配置自动批准 |
| `high` | 侵入性操作（代码执行、漏洞利用） | 必须人工审批 |

### 审批流程

```
ReAct Worker 调用高风险工具
    │
    ├─ 检查 GlobalConfig 审批策略
    │   ├─ autoApproveLowRisk = true → 自动通过
    │   ├─ autoApproveMediumRisk = true → 自动通过
    │   └─ high risk 或策略要求 → 创建 Approval 记录
    │
    ▼
executing → waiting_approval
    │
    │ 前端 ProjectApprovalBar 显示待审批通知（琥珀色）
    │
    ▼
人工决策: PUT /api/approvals/[id]
    ├─ approved → RESOLVED → executing，继续 ReAct 循环
    └─ rejected → 记录拒绝理由，跳过该操作
```

### 审批策略配置

通过 `/settings/approval-policy` 页面或 API 配置：

```json
{
  "approvalEnabled": true,
  "autoApproveLowRisk": true,
  "autoApproveMediumRisk": true
}
```

- `approvalEnabled = false`：全部自动批准（不推荐生产使用）
- `autoApproveMediumRisk = false`：中风险操作也需人工审批

## 8.3 Scope 策略

### 自动边界推断

`scope-policy.ts` 从项目目标自动推断授权边界：

```typescript
const policy = createScopePolicy(targets)
// 域名目标 "example.com"
//   → DomainRule: *.example.com 均在 scope 内

// IP 目标 "192.168.1.100"
//   → SubnetRule: 192.168.1.0/24 均在 scope 内
```

### Scope 检查时机

每次 MCP 工具调用前，从 function call 参数中提取目标值（优先顺序：`target` > `url` > `host` > `address`），通过 `scopePolicy.isInScope()` 验证。

### 超出 Scope 的处理

超出范围的工具调用不执行，但会：
1. 将失败原因以 `tool` 消息写入 LLM 上下文
2. 发布 `scope_exceeded` SSE 事件
3. LLM 收到反馈后通常会调整目标

### 项目描述与智能 Scope

项目描述（`project.description`）注入所有 LLM Prompt，帮助 LLM 进行更智能的 scope 判断：

- 强关联资产（目标子域名、同网段 IP、官方关联域名）→ 深入测试
- 弱关联资产（CDN、第三方服务商、无明确关系的外部地址）→ 跳过

这种"软性 scope"不是硬拦截，而是通过 Prompt 引导 LLM 做出合理判断。

## 8.4 审计日志

### AuditEvent 记录

所有关键操作记录到 `audit_events` 表：

| 字段 | 说明 |
|------|------|
| category | 事件类别（project / approval / mcp / auth） |
| action | 具体动作（created / started / approved / rejected） |
| actor | 操作者（用户 ID 或 "system"） |
| detail | 详情（JSON 格式） |

### PipelineLog 记录

流水线日志提供更细粒度的可观测性：

| 字段 | 说明 |
|------|------|
| jobType | 任务类型（react_round / analyze_result / verify_finding 等） |
| stage | 阶段标识（如 mcp_result / mcp_error / stale_recovery） |
| level | 日志级别（debug / info / warn / error） |
| message | 日志消息 |
| data | 结构化数据（JSON） |
| duration | 耗时（ms） |

### 日志管理

- Pipeline 日志每 6 小时自动清理 30 天前的 debug 级别记录
- LLM 调用日志在 Worker 启动时清理卡在 `streaming` 状态的记录
- 前端 `/settings/work-logs` 页面提供日志查询和筛选

## 8.5 速率限制

Middleware 层实现滑动窗口速率限制，防止 API 滥用。限制策略按 IP 地址分组，超出限制返回 429 Too Many Requests。

## 8.6 安全设计总结

| 安全机制 | 实现方式 |
|---------|---------|
| 身份认证 | JWT (jose) + HttpOnly cookie |
| 密码存储 | bcryptjs 哈希 |
| CSRF 防护 | 双重提交 Cookie |
| API 权限 | Middleware 路由级检查 |
| 操作审批 | 三级风险 + 可配置策略 |
| 目标范围 | Scope 策略自动推断 + LLM 软引导 |
| 操作审计 | AuditEvent + PipelineLog 双层记录 |
| 速率限制 | 滑动窗口 |
| 会话管理 | JWT 过期 + 手动登出 |
