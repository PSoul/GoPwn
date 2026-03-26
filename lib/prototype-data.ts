import type {
  ApprovalRecord,
  AssetRecord,
  EvidenceRecord,
  McpToolRecord,
  MetricCard,
  ProjectRecord,
  TaskRecord,
  TimelineStage,
} from "@/lib/prototype-types"

export const dashboardMetrics: MetricCard[] = [
  { label: "项目总数", value: "12", delta: "+2 本周", tone: "neutral" },
  { label: "运行中项目", value: "5", delta: "2 个待接管", tone: "info" },
  { label: "已发现资产", value: "428", delta: "+31 今日", tone: "success" },
  { label: "已确认问题", value: "14", delta: "3 个待复核", tone: "warning" },
  { label: "待审批动作", value: "6", delta: "2 个高风险", tone: "danger" },
]

export const projects: ProjectRecord[] = [
  {
    id: "proj-huayao",
    name: "华曜科技匿名外网面梳理",
    seed: "huayao.com",
    targetType: "domain",
    stage: "待验证项生成",
    status: "运行中",
    pendingApprovals: 2,
    lastUpdated: "今天 12:10",
    riskSummary: "发现 1 个高危候选登录入口",
  },
  {
    id: "proj-xingtu",
    name: "星图教育开放资产评估",
    seed: "portal.xingtuedu.cn",
    targetType: "url",
    stage: "发现与指纹识别",
    status: "运行中",
    pendingApprovals: 1,
    lastUpdated: "今天 10:22",
    riskSummary: "新增 2 个 API 入口待识别",
  },
  {
    id: "proj-yunlan",
    name: "云岚医械公网暴露面验证",
    seed: "203.107.18.0/24",
    targetType: "cidr",
    stage: "审批前排队",
    status: "已阻塞",
    pendingApprovals: 3,
    lastUpdated: "昨天 18:40",
    riskSummary: "3 个高风险动作等待审批",
  },
]

export const projectTimeline: TimelineStage[] = [
  { title: "授权与范围定义", state: "done", note: "授权说明与范围规则已锁定" },
  { title: "种子目标接收", state: "done", note: "域名与种子 URL 已标准化" },
  { title: "持续信息收集", state: "watching", note: "发现新管理入口，已回流补采" },
  { title: "目标关联与范围判定", state: "done", note: "新增子域已确认为授权范围内" },
  { title: "发现与指纹识别", state: "done", note: "识别到 nginx、Next.js 与管理入口特征" },
  { title: "待验证项生成", state: "current", note: "2 个高风险验证项等待人工判断" },
  { title: "审批前排队", state: "blocked", note: "审批通过后进入受控验证" },
]

export const projectTasks: TaskRecord[] = [
  {
    id: "task-01",
    title: "认证绕过验证候选单生成",
    status: "waiting_approval",
    reason: "等待“高风险受控验证”审批通过",
    priority: "P1",
  },
  {
    id: "task-02",
    title: "admin.huayao.com 归属确认",
    status: "waiting_dependency",
    reason: "依赖候选资产范围判定完成",
    priority: "P1",
  },
  {
    id: "task-03",
    title: "夜间被动情报刷新",
    status: "scheduled",
    reason: "已排入 23:30 调度窗口",
    priority: "P3",
  },
]

export const dashboardPriorities = [
  {
    title: "审批阻塞优先清理",
    detail: "华曜科技项目有 2 个高风险验证项待处理，已阻塞主路径进入受控 PoC 验证。",
    tone: "danger" as const,
  },
  {
    title: "新入口回流补采",
    detail: "发现 admin.huayao.com 与 assets.huayao.com，需补做范围判定和信息收集。",
    tone: "warning" as const,
  },
  {
    title: "MCP 工具异常需要巡检",
    detail: "capture-evidence 当前健康检查异常，影响证据截图链路。",
    tone: "info" as const,
  },
]

export const approvals: ApprovalRecord[] = [
  {
    id: "APR-20260326-014",
    projectName: "华曜科技匿名外网面梳理",
    target: "admin.huayao.com/login",
    actionType: "受控认证绕过验证",
    riskLevel: "高",
    rationale: "入口识别到旧版认证框架特征，存在历史高频问题线索",
    impact: "对登录入口发起受控验证请求",
    mcpCapability: "受控验证类",
    tool: "auth-guard-check",
    status: "待处理",
  },
  {
    id: "APR-20260326-015",
    projectName: "云岚医械公网暴露面验证",
    target: "api.yunlanmed.com/v1",
    actionType: "敏感接口权限校验",
    riskLevel: "高",
    rationale: "API 文档暴露鉴权缺失线索，需受控验证",
    impact: "对匿名接口进行只读权限验证",
    mcpCapability: "受控验证类",
    tool: "api-scope-check",
    status: "待处理",
  },
]

export const assets: AssetRecord[] = [
  {
    id: "asset-443",
    projectName: "华曜科技匿名外网面梳理",
    type: "service",
    label: "443/tcp",
    profile: "nginx 1.22 + Next.js 前端入口",
    scopeStatus: "已纳入",
    lastSeen: "今天 11:52",
  },
  {
    id: "asset-22",
    projectName: "星图教育开放资产评估",
    type: "port",
    label: "22/tcp",
    profile: "OpenSSH 8.4 版本线索",
    scopeStatus: "已纳入",
    lastSeen: "今天 09:14",
  },
  {
    id: "asset-api",
    projectName: "云岚医械公网暴露面验证",
    type: "api",
    label: "api.yunlanmed.com/v1",
    profile: "REST API，疑似使用 Spring Boot",
    scopeStatus: "待确认",
    lastSeen: "昨天 17:08",
  },
]

export const evidenceRecords: EvidenceRecord[] = [
  {
    id: "EV-20260326-009",
    projectName: "华曜科技匿名外网面梳理",
    title: "后台登录页暴露管理端标识",
    source: "页面截图 + 302 响应链路",
    confidence: "0.78",
    conclusion: "待复核问题",
    linkedApprovalId: "APR-20260326-014",
  },
]

export const mcpTools: McpToolRecord[] = [
  {
    id: "mcp-01",
    capability: "目标解析类",
    toolName: "seed-normalizer",
    version: "1.4.2",
    riskLevel: "低",
    status: "启用",
  },
  {
    id: "mcp-02",
    capability: "受控验证类",
    toolName: "auth-guard-check",
    version: "2.3.0",
    riskLevel: "高",
    status: "启用",
  },
  {
    id: "mcp-03",
    capability: "截图与证据采集类",
    toolName: "capture-evidence",
    version: "1.9.1",
    riskLevel: "中",
    status: "异常",
  },
]
