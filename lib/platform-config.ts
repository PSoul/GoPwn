import type {
  ApprovalControl,
  ControlSetting,
  McpBoundaryRule,
  McpCapabilityRecord,
  McpRegistrationField,
  MetricCard,
  ProjectFormPreset,
  SettingsSectionRecord,
  SystemStatusRecord,
} from "@/lib/prototype-types"

export const MCP_CAPABILITY_NAMES = [
  "目标解析类",
  "DNS / 子域 / 证书情报类",
  "端口探测类",
  "资产探测类",
  "Web 页面探测类",
  "HTTP / API 结构发现类",
  "HTTP 数据包交互类",
  "TCP 数据包交互类",
  "受控验证类",
  "截图与证据采集类",
  "报告导出类",
  "外部情报查询类",
  "编解码与密码学工具类",
] as const

export const MCP_BOUNDARY_TYPES = ["外部目标交互", "平台内部处理", "外部第三方API"] as const
export const MCP_RISK_LEVELS = ["高", "中", "低"] as const
export const MCP_TRANSPORTS = ["stdio", "streamable_http", "sse"] as const
export const MCP_RESULT_MAPPINGS = ["domains", "webEntries", "network", "findings", "evidence", "workLogs", "assets", "intelligence"] as const

export const dashboardMetrics: MetricCard[] = [
  { label: "项目总数", value: "0", delta: "等待真实项目", tone: "neutral" },
  { label: "已发现资产", value: "0", delta: "等待真实资产数据", tone: "success" },
  { label: "已发现漏洞", value: "0", delta: "等待真实发现沉淀", tone: "warning" },
  { label: "待审批动作", value: "0", delta: "按项目实时聚合", tone: "danger" },
]

export const mcpCapabilityRecords: McpCapabilityRecord[] = [
  {
    id: "cap-target-normalization",
    name: "目标解析类",
    description: "处理公司名、域名、URL、IP、CIDR 的标准化与展开，为后续流程提供干净的种子目标。",
    defaultRiskLevel: "低",
    defaultApprovalRule: "默认自动执行",
    boundary: "平台内部处理",
    mappedStages: ["种子目标接收", "持续信息收集", "目标关联与范围判定"],
    connectedTools: [],
  },
  {
    id: "cap-dns-passive",
    name: "DNS / 子域 / 证书情报类",
    description: "负责外网资产发现、子域扩展、证书相关线索补充。",
    defaultRiskLevel: "低",
    defaultApprovalRule: "默认自动执行",
    boundary: "外部目标交互",
    mappedStages: ["持续信息收集"],
    connectedTools: [],
  },
  {
    id: "cap-port-scan",
    name: "端口探测类",
    description: "负责开放端口发现，是服务与协议识别前的基础网络面能力。",
    defaultRiskLevel: "中",
    defaultApprovalRule: "受项目策略限制，可自动执行",
    boundary: "外部目标交互",
    mappedStages: ["发现与指纹识别"],
    connectedTools: [],
  },
  {
    id: "cap-web-surface",
    name: "Web 页面探测类",
    description: "负责页面入口、状态码、重定向、标题和基础页面特征识别。",
    defaultRiskLevel: "中",
    defaultApprovalRule: "默认低风险自动执行",
    boundary: "外部目标交互",
    mappedStages: ["持续信息收集", "发现与指纹识别"],
    connectedTools: [],
  },
  {
    id: "cap-asset-discovery",
    name: "资产探测类",
    description: "综合资产探测，包含主机、服务、开放端口和关联资产的聚合识别。",
    defaultRiskLevel: "高",
    defaultApprovalRule: "必须逐项审批",
    boundary: "外部目标交互",
    mappedStages: ["发现与指纹识别"],
    connectedTools: [],
  },
  {
    id: "cap-api-surface",
    name: "HTTP / API 结构发现类",
    description: "负责识别 API 入口、接口结构线索、文档入口等。",
    defaultRiskLevel: "中",
    defaultApprovalRule: "默认低风险自动执行",
    boundary: "外部目标交互",
    mappedStages: ["发现与指纹识别", "待验证项生成"],
    connectedTools: [],
  },
  {
    id: "cap-http-packet",
    name: "HTTP 数据包交互类",
    description: "发送完整 HTTP 请求并返回结构化响应，适合低风险协议级交互和样本采集。",
    defaultRiskLevel: "中",
    defaultApprovalRule: "受项目策略限制，可自动执行",
    boundary: "外部目标交互",
    mappedStages: ["发现与指纹识别", "受控 PoC 验证"],
    connectedTools: [],
  },
  {
    id: "cap-tcp-packet",
    name: "TCP 数据包交互类",
    description: "执行非 HTTP 的原始 TCP/UDP 协议交互，用于协议确认、服务识别和证据采样。",
    defaultRiskLevel: "中",
    defaultApprovalRule: "受项目策略限制，可自动执行",
    boundary: "外部目标交互",
    mappedStages: ["发现与指纹识别"],
    connectedTools: [],
  },
  {
    id: "cap-controlled-validation",
    name: "受控验证类",
    description: "执行审批后的高风险验证动作，并明确停止条件与证据留存要求。",
    defaultRiskLevel: "高",
    defaultApprovalRule: "必须逐项审批",
    boundary: "外部目标交互",
    mappedStages: ["审批前排队", "受控 PoC 验证"],
    connectedTools: [],
  },
  {
    id: "cap-evidence-capture",
    name: "截图与证据采集类",
    description: "负责页面、响应与关键结果的可视化或结构化证据采集。",
    defaultRiskLevel: "中",
    defaultApprovalRule: "默认自动执行，异常时可被策略阻断",
    boundary: "外部目标交互",
    mappedStages: ["受控 PoC 验证", "证据归档与结果判定"],
    connectedTools: [],
  },
  {
    id: "cap-report-export",
    name: "报告导出类",
    description: "导出结构化结果、报告和汇总信息，服务于项目结论与交付。",
    defaultRiskLevel: "低",
    defaultApprovalRule: "默认自动执行",
    boundary: "平台内部处理",
    mappedStages: ["报告与回归验证"],
    connectedTools: [],
  },
  {
    id: "cap-external-intel",
    name: "外部情报查询类",
    description: "调用第三方情报 API 获取资产、组织、开放端口和情报侧线索，不直接与目标交互。",
    defaultRiskLevel: "低",
    defaultApprovalRule: "默认自动执行",
    boundary: "外部第三方API",
    mappedStages: ["持续信息收集"],
    connectedTools: [],
  },
  {
    id: "cap-encode-crypto",
    name: "编解码与密码学工具类",
    description: "提供 Base64、URL 编解码、哈希计算等辅助能力，不与目标直接交互。",
    defaultRiskLevel: "低",
    defaultApprovalRule: "默认自动执行",
    boundary: "平台内部处理",
    mappedStages: ["发现与指纹识别", "受控 PoC 验证"],
    connectedTools: [],
  },
]

export const mcpBoundaryRules: McpBoundaryRule[] = [
  {
    title: "所有对目标产生观测或交互的动作必须经过 MCP 层",
    description: "探测、识别、采集、验证、截图等动作统一通过 MCP 网关执行，以保证边界清晰、可审计、可扩展。",
    type: "外部目标交互",
  },
  {
    title: "平台内部编排与结果归一化不强制抽象成 MCP",
    description: "任务规划、证据归一化、结果聚合、状态推进等内部处理动作可以留在平台内部完成，避免错误抽象。",
    type: "平台内部处理",
  },
  {
    title: "第三方情报查询必须走统一 API 边界",
    description: "FOFA、Shodan 等外部情报源需要通过统一凭据与审计出口调用，避免把第三方 API 误判成目标交互。",
    type: "外部第三方API",
  },
]

export const mcpRegistrationFields: McpRegistrationField[] = [
  { label: "工具名称", description: "用于在网关、审计日志和审批记录中稳定识别具体工具。" },
  { label: "工具版本", description: "确保任务、证据与审计链路能够回溯到当时使用的实现版本。" },
  { label: "能力类别", description: "平台按能力族而不是按具体工具名称进行调度和策略判断。" },
  { label: "输入模式", description: "明确工具接受的目标、上下文和约束输入，便于后续接入和校验。" },
  { label: "输出模式", description: "明确工具输出的结构化结果类型，便于结果沉淀与证据归档。" },
  { label: "风险级别", description: "用于决定默认审批门槛、并发限制和策略保护强度。" },
  { label: "是否必须审批", description: "标记该工具默认是否只能在人工确认后运行。" },
  { label: "默认限制", description: "包括并发、速率、超时和重试建议，作为调度默认值。" },
  { label: "启用状态", description: "决定该工具当前是否可被网关挑选进入执行路径。" },
  { label: "调用边界", description: "明确它属于外部目标交互、平台内部处理还是外部第三方 API 调用。" },
]

export const systemControlOverview: ControlSetting[] = [
  {
    label: "默认并发",
    value: "项目级 3 / 高风险 1",
    description: "高风险动作始终串行，普通收集任务允许有限并发。",
    tone: "info",
  },
  {
    label: "默认速率",
    value: "被动 120 req/min / 验证 12 req/min",
    description: "严格限制主动验证速率，确保平台行为可审计可回溯。",
    tone: "success",
  },
  {
    label: "超时与重试",
    value: "45s / 1 次",
    description: "证据类工具允许一次自动重试，避免偶发网络波动造成误判。",
    tone: "warning",
  },
  {
    label: "紧急停止",
    value: "等待真实策略事件",
    description: "当真实工具或目标异常出现时，这里会显示最近一次保护性切换。",
    tone: "danger",
  },
]

export const settingsSections: SettingsSectionRecord[] = [
  {
    title: "MCP 工具管理",
    href: "/settings/mcp-tools",
    description: "查看能力分类、风险等级、启停状态与工具健康，确认哪些 MCP 正在参与当前平台执行。",
    metric: "等待注册",
    tone: "info",
  },
  {
    title: "LLM 设置",
    href: "/settings/llm",
    description: "管理编排模型、审阅模型、上下文预算、默认推理强度和失败回退策略。",
    metric: "3 套角色配置",
    tone: "success",
  },
  {
    title: "审批策略",
    href: "/settings/approval-policy",
    description: "把审批开关、默认放行策略、范围规则和紧急停止放在单独子页集中管理。",
    metric: "默认策略已启用",
    tone: "warning",
  },
  {
    title: "工作日志",
    href: "/settings/work-logs",
    description: "按项目查看 LLM 与 MCP 的执行记录，回看日常运行到底做了什么。",
    metric: "等待首条日志",
    tone: "neutral",
  },
  {
    title: "审计日志",
    href: "/settings/audit-logs",
    description: "追踪审批、配置调整、系统切换和人工接管动作，确保操作全链路可回溯。",
    metric: "等待首条审计",
    tone: "danger",
  },
  {
    title: "系统状态",
    href: "/settings/system-status",
    description: "集中查看调度队列、浏览器池、日志存储、截图链路和 MCP 网关的当前健康状态。",
    metric: "按实时数据刷新",
    tone: "info",
  },
  {
    title: "用户管理",
    href: "/settings/users",
    description: "管理平台用户账号，分配管理员、研究员和审批员角色，启用或禁用账号。",
    metric: "多角色支持",
    tone: "info",
  },
]

export const defaultGlobalApprovalControl: ApprovalControl = {
  enabled: true,
  mode: "高风险审批，低风险自动通过",
  autoApproveLowRisk: true,
  description: "大部分 MCP 调用直接执行并写入审计，只有高风险验证、敏感路径探测和需要突破默认约束的动作才进入审批。",
  note: "审批关闭时不等于完全失控，系统仍保留审计、速率限制、超时和紧急停止。",
}

export const systemStatusCards: SystemStatusRecord[] = [
  {
    title: "MCP 网关",
    value: "0 / 0 已接入",
    description: "当前还没有注册任何 MCP server 或工具契约。",
    tone: "neutral",
  },
  {
    title: "调度队列",
    value: "0 条",
    description: "等待真实任务进入调度与审批链路。",
    tone: "info",
  },
  {
    title: "浏览器池",
    value: "待接入",
    description: "浏览器执行节点健康信息将在接入后显示。",
    tone: "warning",
  },
  {
    title: "日志存储",
    value: "就绪",
    description: "工作日志、审计日志和结果证据将以真实写入为准。",
    tone: "success",
  },
]

export const defaultProjectFormPreset: ProjectFormPreset = {
  name: "",
  targetInput: "",
  description: "",
}
