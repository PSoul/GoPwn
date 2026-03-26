import type {
  ApprovalRecord,
  AssetRecord,
  ControlSetting,
  EvidenceRecord,
  McpToolRecord,
  MetricCard,
  PolicyRecord,
  ProjectDetailRecord,
  ProjectFormPreset,
  ProjectKnowledgeItem,
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
    code: "PRJ-20260326-001",
    name: "华曜科技匿名外网面梳理",
    seed: "huayao.com",
    targetType: "domain",
    targetSummary: "huayao.com / admin.huayao.com / assets.huayao.com",
    owner: "研究员席位 A",
    priority: "高",
    stage: "待验证项生成",
    status: "运行中",
    pendingApprovals: 2,
    openTasks: 4,
    assetCount: 37,
    evidenceCount: 12,
    createdAt: "2026-03-24 09:30",
    lastUpdated: "今天 12:10",
    lastActor: "审批中心 · 待人工接管",
    riskSummary: "发现 1 个高危候选登录入口，1 个待确认 API 入口",
    summary: "围绕后台入口、静态资源域名和登录链路做授权外网面梳理，当前主路径停在高风险动作审批前。",
    authorizationSummary: "仅允许匿名外网面识别、只读验证和证据采集，不进入写操作与登录后业务流。",
    scopeSummary: "允许 huayao.com 及明确归属的子域、端口、Web/API 入口；新增子域先做归属判定。",
    forbiddenActions: "禁止无人审批的高风险受控验证；禁止超出授权窗口的主动探测；禁止对第三方托管节点继续推进。",
    defaultConcurrency: "项目级 3 / 高风险 1",
    rateLimit: "被动 120 req/min / 验证 12 req/min",
    timeout: "45s / 1 次重试",
    approvalMode: "高风险动作逐项审批",
    tags: ["高优先级", "匿名面", "待审批"],
  },
  {
    id: "proj-xingtu",
    code: "PRJ-20260325-014",
    name: "星图教育开放资产评估",
    seed: "portal.xingtuedu.cn",
    targetType: "url",
    targetSummary: "portal.xingtuedu.cn / ops.xingtuedu.cn / portal.xingtuedu.cn/graphql",
    owner: "研究员席位 B",
    priority: "中",
    stage: "发现与指纹识别",
    status: "运行中",
    pendingApprovals: 1,
    openTasks: 3,
    assetCount: 18,
    evidenceCount: 6,
    createdAt: "2026-03-23 14:10",
    lastUpdated: "今天 10:22",
    lastActor: "任务调度器 · 夜间窗口待确认",
    riskSummary: "新增 2 个 API 入口待识别，1 个 SSH 暴露面待归属复核",
    summary: "面向教育平台开放入口做识别与归属校验，当前重点在 GraphQL 暴露与运维节点归属判断。",
    authorizationSummary: "允许站点首页、开放 API 文档、匿名接口与被动端口识别，不进入登录后流程。",
    scopeSummary: "以 portal.xingtuedu.cn 为主，ops 子域与 GraphQL 入口均需结合归属复核后纳入。",
    forbiddenActions: "禁止对供应商运维节点继续深度验证；禁止对学生数据相关接口做写操作测试。",
    defaultConcurrency: "项目级 2 / 高风险 1",
    rateLimit: "被动 90 req/min / 验证 8 req/min",
    timeout: "40s / 1 次重试",
    approvalMode: "中高风险动作审批",
    tags: ["开放接口", "待归属", "夜间窗口"],
  },
  {
    id: "proj-yunlan",
    code: "PRJ-20260321-007",
    name: "云岚医械公网暴露面验证",
    seed: "203.107.18.0/24",
    targetType: "cidr",
    targetSummary: "203.107.18.0/24 / api.yunlanmed.com / swagger-ui",
    owner: "研究员席位 A",
    priority: "高",
    stage: "审批前排队",
    status: "已阻塞",
    pendingApprovals: 3,
    openTasks: 5,
    assetCount: 26,
    evidenceCount: 9,
    createdAt: "2026-03-20 17:45",
    lastUpdated: "昨天 18:40",
    lastActor: "审批中心 · 阻塞主路径",
    riskSummary: "3 个高风险动作等待审批，开放 API 文档与匿名接口链路待继续验证",
    summary: "项目已经完成发现与证据采样，但关键验证动作因审批未决而停在队列中。",
    authorizationSummary: "允许对授权公网段和已确认关联域名做只读外网面验证，所有高风险动作必须人工放行。",
    scopeSummary: "CIDR 内命中资产可直接纳入，域名与开放接口需结合证据链与归属判断补充。",
    forbiddenActions: "禁止在证据采集异常时继续推进高风险动作；禁止对医疗敏感接口做写操作或批量导出验证。",
    defaultConcurrency: "项目级 2 / 高风险 1",
    rateLimit: "被动 80 req/min / 验证 6 req/min",
    timeout: "60s / 0 次重试",
    approvalMode: "高风险逐项审批 + 30 分钟失效",
    tags: ["高风险", "阻塞中", "医疗行业"],
  },
]

const projectKnowledge = {
  huayaoDiscoveredInfo: [
    {
      title: "后台统一入口可匿名到达",
      detail: "登录页存在统一管理平台字样，302 链路表明认证后有独立管理台。",
      meta: "今天 11:46 · EV-20260326-009",
      tone: "warning",
    },
    {
      title: "静态资源域名疑似共用对象存储",
      detail: "assets.huayao.com 暴露静态资源结构，可能需要回流补采附件访问控制。",
      meta: "今天 12:18 · 待复核",
      tone: "info",
    },
    {
      title: "入口归属已回写范围判定",
      detail: "新增 admin 与 assets 子域均与主站指纹和命名体系一致。",
      meta: "今天 12:02 · 已归档",
      tone: "success",
    },
  ] satisfies ProjectKnowledgeItem[],
  huayaoServices: [
    {
      title: "443/tcp · admin.huayao.com",
      detail: "nginx 1.22 + Next.js 前端入口，已纳入主路径推进。",
      meta: "服务画像",
      tone: "info",
    },
    {
      title: "assets.huayao.com",
      detail: "静态资源分发域名，疑似同源对象存储出口。",
      meta: "待复核",
      tone: "warning",
    },
    {
      title: "登录入口 /login",
      detail: "存在 legacy-auth 组件命名线索，可作为审批后验证入口。",
      meta: "Web 入口",
      tone: "danger",
    },
  ] satisfies ProjectKnowledgeItem[],
  huayaoFingerprints: [
    {
      title: "Next.js + nginx",
      detail: "响应头与静态资源路径一致，前后端分层清晰。",
      meta: "指纹",
      tone: "neutral",
    },
    {
      title: "legacy-auth 组件命名",
      detail: "页面资源命名疑似沿用旧认证框架，值得继续验证。",
      meta: "高价值线索",
      tone: "warning",
    },
    {
      title: "统一管理平台字样",
      detail: "页面标题和可见文案都指向管理控制台场景。",
      meta: "UI 线索",
      tone: "info",
    },
  ] satisfies ProjectKnowledgeItem[],
  huayaoEntries: [
    {
      title: "admin.huayao.com/login",
      detail: "登录入口已确认在授权范围内，可进入审批视图继续推进。",
      meta: "待审批动作 2",
      tone: "danger",
    },
    {
      title: "assets.huayao.com/static",
      detail: "静态资源目录结构可见，需要确认是否存在附件链路。",
      meta: "回流补采",
      tone: "warning",
    },
    {
      title: "dashboard 跳转链路",
      detail: "登录后管理台路径已经暴露，可作为后续证据链锚点。",
      meta: "已建链",
      tone: "success",
    },
  ] satisfies ProjectKnowledgeItem[],
  huayaoScheduler: [
    {
      title: "夜间被动情报刷新",
      detail: "已排入 23:30 调度窗口，等待审批后串接入口复核。",
      meta: "scheduled",
      tone: "info",
    },
    {
      title: "登录链路截图补采",
      detail: "capture-evidence 恢复后自动回补关键页面截图。",
      meta: "blocked",
      tone: "warning",
    },
    {
      title: "审批后恢复 PoC 验证",
      detail: "高风险动作批准后自动恢复主路径队列。",
      meta: "waiting_approval",
      tone: "danger",
    },
  ] satisfies ProjectKnowledgeItem[],
  xingtuDiscoveredInfo: [
    {
      title: "GraphQL 暴露面可匿名识别",
      detail: "响应头和 schema 特征已被识别，当前等待夜间窗口确认。",
      meta: "APR-20260326-012",
      tone: "warning",
    },
    {
      title: "SSH 版本暴露",
      detail: "ops.xingtuedu.cn 返回 OpenSSH 8.4 线索，归属仍需复核。",
      meta: "EV-20260326-011",
      tone: "info",
    },
  ] satisfies ProjectKnowledgeItem[],
  xingtuServices: [
    {
      title: "portal.xingtuedu.cn",
      detail: "主站入口正在做指纹识别与 API 面挂接。",
      meta: "Web 入口",
      tone: "neutral",
    },
    {
      title: "portal.xingtuedu.cn/graphql",
      detail: "GraphQL 入口可达，待确认 introspection 暴露。",
      meta: "接口入口",
      tone: "warning",
    },
  ] satisfies ProjectKnowledgeItem[],
  xingtuFingerprints: [
    {
      title: "React + GraphQL",
      detail: "前端加载链与接口调用模式指向单页应用。",
      meta: "指纹",
      tone: "info",
    },
    {
      title: "OpenSSH 8.4",
      detail: "Banner 线索已采样，后续需结合归属判断。",
      meta: "端口画像",
      tone: "warning",
    },
  ] satisfies ProjectKnowledgeItem[],
  xingtuEntries: [
    {
      title: "portal.xingtuedu.cn/graphql",
      detail: "待在夜间窗口做 schema 暴露验证。",
      meta: "已延后",
      tone: "warning",
    },
    {
      title: "ops.xingtuedu.cn:22",
      detail: "待归属复核，防止误入供应商节点。",
      meta: "待确认",
      tone: "info",
    },
  ] satisfies ProjectKnowledgeItem[],
  xingtuScheduler: [
    {
      title: "夜间 schema 校验",
      detail: "等待负责人确认 22:00-24:00 验证窗口。",
      meta: "pending",
      tone: "warning",
    },
    {
      title: "开放接口目录重扫",
      detail: "低风险被动枚举已经排入常规刷新。",
      meta: "scheduled",
      tone: "info",
    },
  ] satisfies ProjectKnowledgeItem[],
  yunlanDiscoveredInfo: [
    {
      title: "开放 API 文档匿名可访问",
      detail: "Swagger/OpenAPI 文档已暴露接口结构和业务领域词汇。",
      meta: "EV-20260326-010",
      tone: "warning",
    },
    {
      title: "匿名接口返回业务 trace id",
      detail: "错误响应中包含 trace 标识，可辅助后续归因。",
      meta: "敏感接口候选",
      tone: "danger",
    },
  ] satisfies ProjectKnowledgeItem[],
  yunlanServices: [
    {
      title: "api.yunlanmed.com/v1",
      detail: "REST API，疑似使用 Spring Boot，当前待审批后继续验证。",
      meta: "待确认",
      tone: "warning",
    },
    {
      title: "swagger-ui",
      detail: "文档入口已采样，存在高价值结构化证据。",
      meta: "文档入口",
      tone: "info",
    },
  ] satisfies ProjectKnowledgeItem[],
  yunlanFingerprints: [
    {
      title: "Spring Boot / OpenAPI",
      detail: "错误响应样式与文档结构均指向 Spring 技术栈。",
      meta: "接口画像",
      tone: "info",
    },
    {
      title: "统一 JSON 错误体",
      detail: "业务 trace id 暴露说明错误处理层可被利用做归因。",
      meta: "错误响应",
      tone: "warning",
    },
  ] satisfies ProjectKnowledgeItem[],
  yunlanEntries: [
    {
      title: "api.yunlanmed.com/v1/report/list",
      detail: "匿名访问返回 401，但接口结构已可被枚举。",
      meta: "高风险待审批",
      tone: "danger",
    },
    {
      title: "GET /v1/openapi.json",
      detail: "文档入口 200，可持续暴露接口词汇与资源模型。",
      meta: "证据链已建立",
      tone: "info",
    },
  ] satisfies ProjectKnowledgeItem[],
  yunlanScheduler: [
    {
      title: "审批通过后恢复接口只读校验",
      detail: "仅执行 GET/HEAD 权限校验，不触发业务变更。",
      meta: "waiting_approval",
      tone: "danger",
    },
    {
      title: "文档暴露复核",
      detail: "若文档更新，将自动刷新结构化摘要。",
      meta: "scheduled",
      tone: "info",
    },
  ] satisfies ProjectKnowledgeItem[],
}

const huayaoTimeline: TimelineStage[] = [
  { title: "授权与范围定义", state: "done", note: "授权说明与范围规则已锁定" },
  { title: "种子目标接收", state: "done", note: "域名与种子 URL 已标准化" },
  { title: "持续信息收集", state: "watching", note: "发现新管理入口，已回流补采" },
  { title: "目标关联与范围判定", state: "done", note: "新增子域已确认为授权范围内" },
  { title: "发现与指纹识别", state: "done", note: "识别到 nginx、Next.js 与管理入口特征" },
  { title: "待验证项生成", state: "current", note: "2 个高风险验证项等待人工判断" },
  { title: "审批前排队", state: "blocked", note: "审批通过后进入受控验证" },
]

const xingtuTimeline: TimelineStage[] = [
  { title: "授权与范围定义", state: "done", note: "开放资产评估授权范围已确认" },
  { title: "种子目标接收", state: "done", note: "主 URL 与关联子域已标准化" },
  { title: "持续信息收集", state: "done", note: "被动信息刷新已建立周期任务" },
  { title: "目标关联与范围判定", state: "watching", note: "ops 节点归属仍需人工复核" },
  { title: "发现与指纹识别", state: "current", note: "GraphQL 与 SSH 暴露面仍在识别中" },
  { title: "待验证项生成", state: "blocked", note: "等待负责人确认夜间窗口" },
]

const yunlanTimeline: TimelineStage[] = [
  { title: "授权与范围定义", state: "done", note: "公网段与关联域名授权已登记" },
  { title: "种子目标接收", state: "done", note: "CIDR 目标与域名入口已关联" },
  { title: "持续信息收集", state: "done", note: "开放文档、错误响应与资产画像已采样" },
  { title: "目标关联与范围判定", state: "done", note: "开放 API 入口已作为候选资产纳入" },
  { title: "发现与指纹识别", state: "done", note: "Spring Boot 与 OpenAPI 指纹已确认" },
  { title: "待验证项生成", state: "done", note: "高风险接口权限校验候选单已生成" },
  { title: "审批前排队", state: "blocked", note: "3 个高风险动作等待人工放行" },
]

const allProjectTasks: TaskRecord[] = [
  {
    id: "task-01",
    projectId: "proj-huayao",
    title: "认证绕过验证候选单生成",
    status: "waiting_approval",
    reason: "等待“高风险受控验证”审批通过",
    priority: "P1",
    owner: "审批中心",
    updatedAt: "今天 12:06",
    linkedTarget: "APR-20260326-014",
  },
  {
    id: "task-02",
    projectId: "proj-huayao",
    title: "admin.huayao.com 归属确认",
    status: "waiting_dependency",
    reason: "依赖候选资产范围判定完成",
    priority: "P1",
    owner: "资产中心",
    updatedAt: "今天 11:52",
    linkedTarget: "asset-443",
  },
  {
    id: "task-03",
    projectId: "proj-huayao",
    title: "夜间被动情报刷新",
    status: "scheduled",
    reason: "已排入 23:30 调度窗口",
    priority: "P3",
    owner: "任务调度器",
    updatedAt: "今天 09:30",
  },
  {
    id: "task-04",
    projectId: "proj-huayao",
    title: "capture-evidence 异常复核",
    status: "needs_review",
    reason: "证据截图工具异常导致链路可信度下降",
    priority: "P2",
    owner: "系统设置",
    updatedAt: "今天 12:12",
    linkedTarget: "mcp-03",
  },
  {
    id: "task-05",
    projectId: "proj-xingtu",
    title: "GraphQL schema 暴露验证",
    status: "waiting_approval",
    reason: "等待夜间窗口确认后再执行只读 introspection 探测",
    priority: "P2",
    owner: "审批中心",
    updatedAt: "今天 10:22",
    linkedTarget: "APR-20260326-012",
  },
  {
    id: "task-06",
    projectId: "proj-xingtu",
    title: "ops 节点归属复核",
    status: "waiting_dependency",
    reason: "需先确认是否属于供应商运维跳板机",
    priority: "P1",
    owner: "资产中心",
    updatedAt: "今天 09:20",
    linkedTarget: "asset-22",
  },
  {
    id: "task-07",
    projectId: "proj-xingtu",
    title: "开放接口目录重扫",
    status: "scheduled",
    reason: "低风险被动枚举已排入常规刷新任务",
    priority: "P3",
    owner: "任务调度器",
    updatedAt: "今天 08:45",
  },
  {
    id: "task-08",
    projectId: "proj-yunlan",
    title: "敏感接口权限校验",
    status: "waiting_approval",
    reason: "待高风险审批动作放行后恢复受控验证",
    priority: "P1",
    owner: "审批中心",
    updatedAt: "今天 11:24",
    linkedTarget: "APR-20260326-015",
  },
  {
    id: "task-09",
    projectId: "proj-yunlan",
    title: "开放文档暴露复核",
    status: "ready",
    reason: "文档入口证据完整，可继续做结构化补充",
    priority: "P2",
    owner: "证据中心",
    updatedAt: "昨天 17:08",
    linkedTarget: "EV-20260326-010",
  },
  {
    id: "task-10",
    projectId: "proj-yunlan",
    title: "高风险动作阻塞复盘",
    status: "needs_review",
    reason: "审批未决影响项目主路径，需要补充人工说明",
    priority: "P1",
    owner: "项目负责人",
    updatedAt: "昨天 18:40",
  },
]

export const projectDetails: ProjectDetailRecord[] = [
  {
    projectId: "proj-huayao",
    target: "huayao.com / admin.huayao.com / assets.huayao.com",
    blockingReason: "2 个高风险验证项待审批，主路径暂停进入受控 PoC 验证。",
    nextStep: "优先处理管理后台与 API 入口审批，随后恢复受控验证并补齐截图链路。",
    reflowNotice: "发现新管理入口 admin.huayao.com，已回流至持续信息收集并补充前置任务。",
    currentFocus: "先清审批，再恢复受控验证与证据复核。",
    timeline: huayaoTimeline,
    tasks: allProjectTasks.filter((task) => task.projectId === "proj-huayao"),
    discoveredInfo: projectKnowledge.huayaoDiscoveredInfo,
    serviceSurface: projectKnowledge.huayaoServices,
    fingerprints: projectKnowledge.huayaoFingerprints,
    entries: projectKnowledge.huayaoEntries,
    scheduler: projectKnowledge.huayaoScheduler,
    activity: [
      {
        title: "12:06 提交高风险审批",
        detail: "认证绕过验证候选单已进入审批中心，阻塞主路径。",
        meta: "审批中心",
        tone: "danger",
      },
      {
        title: "11:52 新资产归属完成",
        detail: "admin.huayao.com 已确认纳入授权范围。",
        meta: "资产中心",
        tone: "success",
      },
      {
        title: "11:46 证据链路成型",
        detail: "页面截图与 302 响应链路已完成结构化归档。",
        meta: "证据中心",
        tone: "info",
      },
    ],
  },
  {
    projectId: "proj-xingtu",
    target: "portal.xingtuedu.cn / ops.xingtuedu.cn / portal.xingtuedu.cn/graphql",
    blockingReason: "主路径未阻塞，但 GraphQL 暴露验证需要等待夜间窗口确认。",
    nextStep: "先完成 ops 节点归属，再在授权窗口内做 schema 暴露校验。",
    reflowNotice: "新发现 SSH 节点后，前置归属判断任务已重新入队。",
    currentFocus: "围绕 GraphQL 暴露和运维节点归属做低风险推进。",
    timeline: xingtuTimeline,
    tasks: allProjectTasks.filter((task) => task.projectId === "proj-xingtu"),
    discoveredInfo: projectKnowledge.xingtuDiscoveredInfo,
    serviceSurface: projectKnowledge.xingtuServices,
    fingerprints: projectKnowledge.xingtuFingerprints,
    entries: projectKnowledge.xingtuEntries,
    scheduler: projectKnowledge.xingtuScheduler,
    activity: [
      {
        title: "10:22 GraphQL 候选入口回写",
        detail: "入口被标记为夜间窗口验证对象。",
        meta: "项目详情",
        tone: "warning",
      },
      {
        title: "09:20 SSH Banner 归档",
        detail: "OpenSSH 8.4 版本线索已写入证据与资产画像。",
        meta: "证据中心",
        tone: "info",
      },
    ],
  },
  {
    projectId: "proj-yunlan",
    target: "203.107.18.0/24 / api.yunlanmed.com / swagger-ui",
    blockingReason: "3 个高风险动作等待审批，项目当前停在审批前排队阶段。",
    nextStep: "补充审批说明与只读约束后，再恢复敏感接口权限校验。",
    reflowNotice: "开放文档与匿名接口错误响应已回写任务与证据链，不需要重置主阶段。",
    currentFocus: "优先清理审批阻塞，并维持证据链完整性。",
    timeline: yunlanTimeline,
    tasks: allProjectTasks.filter((task) => task.projectId === "proj-yunlan"),
    discoveredInfo: projectKnowledge.yunlanDiscoveredInfo,
    serviceSurface: projectKnowledge.yunlanServices,
    fingerprints: projectKnowledge.yunlanFingerprints,
    entries: projectKnowledge.yunlanEntries,
    scheduler: projectKnowledge.yunlanScheduler,
    activity: [
      {
        title: "11:24 提交敏感接口权限校验审批",
        detail: "审批未决导致受控验证无法恢复。",
        meta: "审批中心",
        tone: "danger",
      },
      {
        title: "17:08 开放文档资产归档",
        detail: "api.yunlanmed.com/v1 已进入待确认资产列表。",
        meta: "资产中心",
        tone: "info",
      },
    ],
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
    projectId: "proj-huayao",
    projectName: "华曜科技匿名外网面梳理",
    target: "admin.huayao.com/login",
    actionType: "受控认证绕过验证",
    riskLevel: "高",
    rationale: "入口识别到旧版认证框架特征，存在历史高频问题线索",
    impact: "对登录入口发起受控验证请求",
    mcpCapability: "受控验证类",
    tool: "auth-guard-check",
    status: "待处理",
    parameterSummary: "登录入口只读校验，速率 1 req/s，最长 3 分钟，自动脱敏保存响应片段。",
    prerequisites: ["确认目标仍在授权范围内", "校验时间窗口在 14:00 之后", "启用 capture-evidence 记录链路"],
    stopCondition: "出现验证码升级、账户锁定迹象或命中告警页立即终止。",
    blockingImpact: "阻塞“认证绕过验证候选单生成”，项目主路径停在待验证项生成阶段。",
    queuePosition: 1,
    submittedAt: "今天 12:06",
  },
  {
    id: "APR-20260326-015",
    projectId: "proj-yunlan",
    projectName: "云岚医械公网暴露面验证",
    target: "api.yunlanmed.com/v1",
    actionType: "敏感接口权限校验",
    riskLevel: "高",
    rationale: "API 文档暴露鉴权缺失线索，需受控验证",
    impact: "对匿名接口进行只读权限验证",
    mcpCapability: "受控验证类",
    tool: "api-scope-check",
    status: "待处理",
    parameterSummary: "仅执行 GET/HEAD 权限校验，不落库，不写入，不触发敏感业务状态变更。",
    prerequisites: ["完成接口归属确认", "启用只读模式", "并发限制为 1"],
    stopCondition: "接口返回 429、5xx 波动或命中敏感字段时自动停止。",
    blockingImpact: "阻塞云岚医械项目进入受控 PoC 验证与问题定级。",
    queuePosition: 2,
    submittedAt: "今天 11:24",
  },
  {
    id: "APR-20260326-012",
    projectId: "proj-xingtu",
    projectName: "星图教育开放资产评估",
    target: "portal.xingtuedu.cn/graphql",
    actionType: "Schema 暴露验证",
    riskLevel: "中",
    rationale: "响应头暴露 GraphQL 特征，需判断 introspection 是否开启。",
    impact: "发起只读 introspection 探测",
    mcpCapability: "接口识别类",
    tool: "graphql-surface-check",
    status: "已延后",
    parameterSummary: "仅检查 schema 暴露与匿名 introspection，不提交 mutation。",
    prerequisites: ["等待项目负责人确认夜间窗口", "限制总请求数不超过 8"],
    stopCondition: "出现速率限制或匿名 introspection 被显式禁用即停止。",
    blockingImpact: "不阻塞主路径，但影响开放 API 风险判定完整度。",
    queuePosition: 5,
    submittedAt: "昨天 18:08",
  },
]

export const assets: AssetRecord[] = [
  {
    id: "asset-443",
    projectId: "proj-huayao",
    projectName: "华曜科技匿名外网面梳理",
    type: "service",
    label: "443/tcp",
    profile: "nginx 1.22 + Next.js 前端入口",
    scopeStatus: "已纳入",
    lastSeen: "今天 11:52",
    host: "admin.huayao.com",
    ownership: "华曜科技管理后台入口",
    confidence: "0.86",
    exposure: "对外可访问，关联登录入口与 dashboard 跳转线索。",
    linkedEvidenceId: "EV-20260326-009",
    linkedTaskTitle: "认证绕过验证候选单生成",
    issueLead: "疑似旧版统一认证组件暴露管理端能力。",
    relations: [
      { id: "asset-rel-001", label: "huayao.com", type: "domain", relation: "父域名", scopeStatus: "已纳入" },
      { id: "asset-rel-002", label: "admin.huayao.com/login", type: "entry", relation: "登录入口", scopeStatus: "已纳入" },
      { id: "asset-rel-003", label: "EV-20260326-009", type: "evidence", relation: "关联证据", scopeStatus: "已纳入" },
    ],
  },
  {
    id: "asset-22",
    projectId: "proj-xingtu",
    projectName: "星图教育开放资产评估",
    type: "port",
    label: "22/tcp",
    profile: "OpenSSH 8.4 版本线索",
    scopeStatus: "已纳入",
    lastSeen: "今天 09:14",
    host: "ops.xingtuedu.cn",
    ownership: "运维跳板机候选入口",
    confidence: "0.72",
    exposure: "公网开放端口，握手信息可见 OpenSSH 8.4 线索。",
    linkedEvidenceId: "EV-20260326-011",
    linkedTaskTitle: "SSH 暴露面版本复核",
    issueLead: "需确认是否属于供应商运维节点，避免误入范围外目标。",
    relations: [
      { id: "asset-rel-004", label: "portal.xingtuedu.cn", type: "subdomain", relation: "同项目关联域名", scopeStatus: "已纳入" },
      { id: "asset-rel-005", label: "EV-20260326-011", type: "evidence", relation: "Banner 采样证据", scopeStatus: "已纳入" },
    ],
  },
  {
    id: "asset-api",
    projectId: "proj-yunlan",
    projectName: "云岚医械公网暴露面验证",
    type: "api",
    label: "api.yunlanmed.com/v1",
    profile: "REST API，疑似使用 Spring Boot",
    scopeStatus: "待确认",
    lastSeen: "昨天 17:08",
    host: "api.yunlanmed.com",
    ownership: "云岚医械开放接口集群",
    confidence: "0.67",
    exposure: "匿名访问可见 OpenAPI 片段，部分路径返回统一 JSON 错误体。",
    linkedEvidenceId: "EV-20260326-010",
    linkedTaskTitle: "敏感接口权限校验",
    issueLead: "疑似存在匿名可访问只读接口，需审批后验证。",
    relations: [
      { id: "asset-rel-006", label: "swagger-ui", type: "entry", relation: "文档入口", scopeStatus: "待确认" },
      { id: "asset-rel-007", label: "APR-20260326-015", type: "approval", relation: "待审批动作", scopeStatus: "待确认" },
    ],
  },
  {
    id: "asset-rpa",
    projectId: "proj-huayao",
    projectName: "华曜科技匿名外网面梳理",
    type: "service",
    label: "assets.huayao.com",
    profile: "静态资源分发域名，疑似共用对象存储出口",
    scopeStatus: "待复核",
    lastSeen: "今天 12:18",
    host: "assets.huayao.com",
    ownership: "静态资源与附件出口",
    confidence: "0.61",
    exposure: "目录结构线索与主站一致，但归属尚未完全确认。",
    linkedEvidenceId: "EV-20260326-012",
    linkedTaskTitle: "新增子域归属与范围判定",
    issueLead: "若确认纳入，需要回流补采对象存储与附件访问控制。",
    relations: [
      { id: "asset-rel-008", label: "admin.huayao.com", type: "subdomain", relation: "同源关联", scopeStatus: "待复核" },
      { id: "asset-rel-009", label: "对象存储桶", type: "storage", relation: "疑似后端依赖", scopeStatus: "待复核" },
    ],
  },
]

export const evidenceRecords: EvidenceRecord[] = [
  {
    id: "EV-20260326-009",
    projectId: "proj-huayao",
    projectName: "华曜科技匿名外网面梳理",
    title: "后台登录页暴露管理端标识",
    source: "页面截图 + 302 响应链路",
    confidence: "0.78",
    conclusion: "待复核问题",
    linkedApprovalId: "APR-20260326-014",
    rawOutput: ["GET /login -> 302 /dashboard", "response header: x-powered-by=Next.js", "html title: 华曜科技统一管理平台"],
    screenshotNote: "登录页顶部出现统一管理平台字样，右下角存在版本标识。",
    structuredSummary: [
      "确认存在后台入口，且匿名可抵达登录页。",
      "302 链路指向 dashboard，说明存在认证后管理界面。",
      "页面静态资源路径带有 legacy-auth 组件命名。",
    ],
    linkedTaskTitle: "认证绕过验证候选单生成",
    linkedAssetLabel: "443/tcp",
    timeline: ["11:38 发现新入口", "11:42 页面截图采集完成", "11:46 响应链路结构化解析完成", "12:06 提交审批"],
    verdict: "需要审批通过后继续受控认证验证，暂不直接下结论。",
  },
  {
    id: "EV-20260326-010",
    projectId: "proj-yunlan",
    projectName: "云岚医械公网暴露面验证",
    title: "开放 API 文档片段泄露鉴权结构",
    source: "OpenAPI JSON 片段 + 错误响应采样",
    confidence: "0.74",
    conclusion: "待复核问题",
    linkedApprovalId: "APR-20260326-015",
    rawOutput: [
      "GET /v1/openapi.json -> 200",
      "paths include /patient/export, /report/list",
      "anonymous GET /report/list -> 401 with business trace id",
    ],
    screenshotNote: "Swagger 文档页可匿名访问，接口分组暴露患者与报表域名词汇。",
    structuredSummary: [
      "文档入口匿名暴露，说明接口面结构可被直接枚举。",
      "错误响应包含业务 trace id，可辅助后续归因。",
      "高敏接口是否缺失鉴权仍需受控验证确认。",
    ],
    linkedTaskTitle: "敏感接口权限校验",
    linkedAssetLabel: "api.yunlanmed.com/v1",
    timeline: ["16:58 文档入口发现", "17:01 错误响应采样完成", "17:08 资产归档进入待确认", "11:24 提交审批"],
    verdict: "文档暴露已成立，但敏感接口权限缺失仍需审批后验证。",
  },
  {
    id: "EV-20260326-011",
    projectId: "proj-xingtu",
    projectName: "星图教育开放资产评估",
    title: "SSH Banner 暴露版本信息",
    source: "Banner 抓取",
    confidence: "0.71",
    conclusion: "待复核问题",
    linkedApprovalId: "APR-20260326-012",
    rawOutput: ["SSH-2.0-OpenSSH_8.4", "cipher: curve25519-sha256", "host key: ecdsa-sha2-nistp256"],
    screenshotNote: "命令行截图显示端口开放与版本回显。",
    structuredSummary: [
      "公网端口直接返回 OpenSSH 版本线索。",
      "尚未确认是否属于供应商托管节点。",
      "需要结合归属结果决定是否继续版本风险校验。",
    ],
    linkedTaskTitle: "SSH 暴露面版本复核",
    linkedAssetLabel: "22/tcp",
    timeline: ["09:10 端口探测命中", "09:14 Banner 采样完成", "09:20 归属待确认"],
    verdict: "当前先做资产归属，避免对潜在非授权目标继续探测。",
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
    category: "输入标准化",
    defaultConcurrency: "8",
    rateLimit: "120 req/min",
    timeout: "15s",
    retry: "2 次",
    lastCheck: "今天 11:40",
  },
  {
    id: "mcp-02",
    capability: "受控验证类",
    toolName: "auth-guard-check",
    version: "2.3.0",
    riskLevel: "高",
    status: "启用",
    category: "认证验证",
    defaultConcurrency: "1",
    rateLimit: "12 req/min",
    timeout: "180s",
    retry: "0 次",
    lastCheck: "今天 12:02",
  },
  {
    id: "mcp-03",
    capability: "截图与证据采集类",
    toolName: "capture-evidence",
    version: "1.9.1",
    riskLevel: "中",
    status: "异常",
    category: "证据采集",
    defaultConcurrency: "3",
    rateLimit: "30 req/min",
    timeout: "45s",
    retry: "1 次",
    lastCheck: "今天 12:12",
  },
  {
    id: "mcp-04",
    capability: "接口识别类",
    toolName: "graphql-surface-check",
    version: "0.8.6",
    riskLevel: "中",
    status: "启用",
    category: "接口识别",
    defaultConcurrency: "2",
    rateLimit: "20 req/min",
    timeout: "60s",
    retry: "1 次",
    lastCheck: "昨天 23:18",
  },
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
    value: "1 个异常工具待人工确认",
    description: "capture-evidence 健康异常，已切换到审慎模式。",
    tone: "danger",
  },
]

export const approvalPolicies: PolicyRecord[] = [
  {
    title: "高风险受控验证必须人工批准",
    description: "认证绕过、权限缺失、敏感数据导出类动作一律进入审批中心，不允许自动放行。",
    owner: "平台负责人",
    status: "生效中",
  },
  {
    title: "审批通过后 30 分钟内自动失效",
    description: "防止环境变化导致审批语境失真，超过窗口需要重新确认。",
    owner: "研究员",
    status: "生效中",
  },
  {
    title: "证据采集异常时禁止继续高风险动作",
    description: "当 capture-evidence 异常时，仅允许只读识别与归属判断，不进入受控 PoC。",
    owner: "系统策略",
    status: "已触发",
  },
]

export const scopeRules: PolicyRecord[] = [
  {
    title: "新增子域名默认进入待确认",
    description: "发现新子域后先判定归属，再决定是否回流到前置阶段任务。",
    owner: "项目流程",
    status: "启用",
  },
  {
    title: "供应商或第三方托管节点需要单独复核",
    description: "若归属存在第三方托管迹象，不自动纳入项目范围。",
    owner: "范围策略",
    status: "启用",
  },
  {
    title: "CIDR 范围外新增 IP 自动标记待复核",
    description: "即便由现有资产反查得到，也不直接视为授权资产。",
    owner: "范围策略",
    status: "启用",
  },
]

const projectFormPresetMap: Record<string, ProjectFormPreset> = Object.fromEntries(
  projects.map((project) => [
    project.id,
    {
      name: project.name,
      seed: project.seed,
      targetType: project.targetType,
      owner: project.owner,
      priority: project.priority,
      targetSummary: project.targetSummary,
      authorizationSummary: project.authorizationSummary,
      scopeSummary: project.scopeSummary,
      forbiddenActions: project.forbiddenActions,
      defaultConcurrency: project.defaultConcurrency,
      rateLimit: project.rateLimit,
      timeout: project.timeout,
      approvalMode: project.approvalMode,
      tags: project.tags.join(" / "),
      deliveryNotes: `${project.summary}\n\n最近动作：${project.lastActor}\n当前阶段：${project.stage}`,
    },
  ]),
)

export const defaultProjectFormPreset: ProjectFormPreset = {
  name: "北栖支付开放暴露面初筛",
  seed: "open.beiqi-pay.cn",
  targetType: "domain",
  owner: "研究员席位 C",
  priority: "中",
  targetSummary: "open.beiqi-pay.cn / pay-gateway.beiqi-pay.cn / docs.beiqi-pay.cn",
  authorizationSummary: "仅执行匿名外网面识别、开放文档采样和低风险只读验证，不进入写操作。",
  scopeSummary: "主域及明确归属子域纳入；新增公网 IP、对象存储或第三方节点一律待确认。",
  forbiddenActions: "禁止无人审批的高风险动作；禁止越权登录后流程；禁止高频压测类操作。",
  defaultConcurrency: "项目级 2 / 高风险 1",
  rateLimit: "被动 100 req/min / 验证 10 req/min",
  timeout: "45s / 1 次重试",
  approvalMode: "高风险逐项审批，低风险自动执行",
  tags: "支付 / 匿名面 / 原型项目",
  deliveryNotes: "创建后先进入种子目标接收与持续信息收集阶段，并建立审批与证据链基线。",
}

export const leadProject = projects[0]
const leadDetail = projectDetails[0]

export const projectTasks = leadDetail.tasks
export const projectTimeline = leadDetail.timeline
export const projectDetailSummary = {
  name: leadProject.name,
  target: leadDetail.target,
  currentStage: leadProject.stage,
  status: leadProject.status,
  pendingApprovals: leadProject.pendingApprovals,
  riskSummary: leadProject.riskSummary,
  lastUpdated: leadProject.lastUpdated,
  blockingReason: leadDetail.blockingReason,
  nextStep: leadDetail.nextStep,
  reflowNotice: leadDetail.reflowNotice,
}

export function getProjectById(projectId: string) {
  return projects.find((project) => project.id === projectId)
}

export function getProjectDetailById(projectId: string) {
  return projectDetails.find((detail) => detail.projectId === projectId)
}

export function getProjectFormPreset(projectId?: string) {
  if (!projectId) {
    return defaultProjectFormPreset
  }

  return projectFormPresetMap[projectId] ?? defaultProjectFormPreset
}

export function getProjectTasks(projectId: string) {
  return allProjectTasks.filter((task) => task.projectId === projectId)
}

export function getProjectApprovals(projectId: string) {
  return approvals.filter((approval) => approval.projectId === projectId)
}

export function getProjectAssets(projectId: string) {
  return assets.filter((asset) => asset.projectId === projectId)
}

export function getProjectEvidence(projectId: string) {
  return evidenceRecords.filter((record) => record.projectId === projectId)
}
