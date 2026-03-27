import path from "node:path"

const WEB_SURFACE_SERVER_NAME = "web-surface-stdio"
const WEB_SURFACE_TOOL_NAME = "web-surface-map"
const WEB_SURFACE_SERVER_SCRIPT = "scripts/mcp/web-surface-server.mjs"

const liveValidationLabDefinitions = {
  "juice-shop": {
    id: "juice-shop",
    name: "OWASP Juice Shop",
    description: "现代前后端一体化漏洞靶场，适合做本地 Web/API 低风险识别与审批链验证。",
    baseUrl: "http://127.0.0.1:3000",
    healthUrl: "http://127.0.0.1:3000",
    image: "bkimminich/juice-shop",
    ports: ["127.0.0.1:3000->3000"],
  },
  webgoat: {
    id: "webgoat",
    name: "OWASP WebGoat",
    description: "经典教学靶场，适合后续扩展到更复杂的教学型验证与审批场景。",
    baseUrl: "http://127.0.0.1:8080/WebGoat",
    healthUrl: "http://127.0.0.1:8080/WebGoat",
    image: "webgoat/webgoat",
    ports: ["127.0.0.1:8080->8080", "127.0.0.1:9090->9090"],
  },
}

function formatProjectStamp(startedAt) {
  const value = String(startedAt).trim()
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)

  if (!match) {
    return value.replace(/[^0-9]/g, "").slice(0, 14) || "run"
  }

  const [, year, month, day, hour, minute, second] = match
  return `${year}${month}${day}-${hour}${minute}${second}`
}

export function getLiveValidationLabDefinition(labId) {
  return liveValidationLabDefinitions[labId] ?? null
}

export function resolveLiveValidationPrototypeDataDir({
  cwd,
  explicitStateDir,
  runDirectoryName,
  stateMode = "isolated",
}) {
  const trimmedStateDir = explicitStateDir?.trim()

  if (trimmedStateDir) {
    return trimmedStateDir
  }

  if (stateMode === "workspace") {
    return null
  }

  return path.join(cwd, "output", "live-validation-state", runDirectoryName)
}

export function buildLiveValidationServerEnv({ baseEnv, prototypeDataDir }) {
  const configuredTimeout = String(baseEnv?.LLM_TIMEOUT_MS ?? "").trim()

  return {
    ...baseEnv,
    NEXT_TELEMETRY_DISABLED: "1",
    LLM_TIMEOUT_MS: configuredTimeout || "300000",
    ...(prototypeDataDir ? { PROTOTYPE_DATA_DIR: prototypeDataDir } : {}),
  }
}

export function buildLiveValidationProjectInput({ lab, startedAt }) {
  const projectStamp = formatProjectStamp(startedAt)
  const labLabel = lab?.name ?? "Local Lab"
  const baseUrl = lab?.baseUrl ?? "http://127.0.0.1"
  const ports = Array.isArray(lab?.ports) && lab.ports.length > 0 ? lab.ports.join(" / ") : "未提供"

  return {
    name: `${labLabel} 本地靶场闭环验证 ${projectStamp}`,
    seed: baseUrl,
    targetType: "url",
    owner: "平台自动验证",
    priority: "中",
    targetSummary: `${baseUrl} / 本地 Docker 靶场 / 端口 ${ports}`,
    authorizationSummary: "仅针对本地 Docker 靶场做自动化闭环联调，用于验证 LLM、MCP、审批与结果沉淀主链路。",
    scopeSummary: `仅限 ${baseUrl} 及容器映射端口 ${ports}；不对宿主机其它服务或外部互联网目标执行动作。`,
    forbiddenActions: "禁止脱离本地靶场范围；禁止写入宿主机业务数据；禁止将调试用密钥或敏感输出写入仓库。",
    defaultConcurrency: "项目级 1 / 高风险 1",
    rateLimit: "5 req/min",
    timeout: "45s / 1 次重试",
    approvalMode: "高风险逐项审批，低风险自动执行",
    tags: `本地靶场 / 自动验证 / ${lab?.id ?? "unknown-lab"}`,
    deliveryNotes: `自动创建的真实闭环验证项目。\n开始时间：${startedAt}\n目标靶场：${labLabel}\n说明：用于把真实 LLM 计划、MCP 调度、审批恢复和结果沉淀回写到普通项目页。`,
  }
}

function buildWebSurfaceRegistrationPayload() {
  return {
    serverName: WEB_SURFACE_SERVER_NAME,
    version: "1.0.0",
    transport: "stdio",
    command: "node",
    args: [WEB_SURFACE_SERVER_SCRIPT],
    endpoint: `stdio://${WEB_SURFACE_SERVER_NAME}`,
    enabled: true,
    notes: "真实 Web 页面探测 MCP server，用于本地靶场和项目闭环验证。",
    tools: [
      {
        toolName: WEB_SURFACE_TOOL_NAME,
        title: "Probe Web Surface",
        description: "对目标 URL 做只读页面探测，返回标题、状态码、关键响应头和最终入口信息。",
        version: "1.0.0",
        capability: "Web 页面探测类",
        boundary: "外部目标交互",
        riskLevel: "低",
        requiresApproval: false,
        resultMappings: ["webEntries", "evidence", "workLogs"],
        inputSchema: {
          type: "object",
          properties: {
            targetUrl: {
              type: "string",
              description: "需要探测的 HTTP 或 HTTPS URL。",
            },
          },
          required: ["targetUrl"],
          additionalProperties: false,
        },
        outputSchema: {
          type: "object",
          properties: {
            webEntries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string" },
                  finalUrl: { type: "string" },
                  title: { type: "string" },
                  statusCode: { type: "number" },
                  headers: {
                    type: "array",
                    items: { type: "string" },
                  },
                  fingerprint: { type: "string" },
                },
                required: ["url", "title", "statusCode", "headers"],
              },
            },
          },
        },
        defaultConcurrency: "1",
        rateLimit: "10 req/min",
        timeout: "15s",
        retry: "1 次",
        owner: "平台自动验证",
      },
    ],
  }
}

export async function ensureLiveValidationProject({
  baseUrl,
  cookie,
  lab,
  requestedProjectId,
  requestJson,
  startedAt,
}) {
  const projectsResult = await requestJson(`${baseUrl}/api/projects`, {
    cookie,
  })
  const existingProjects = Array.isArray(projectsResult?.payload?.items) ? projectsResult.payload.items : []
  const requestedProject = requestedProjectId
    ? existingProjects.find((project) => project.id === requestedProjectId)
    : null

  if (requestedProject) {
    return {
      created: false,
      projectId: requestedProject.id,
      projectName: requestedProject.name,
    }
  }

  const createResult = await requestJson(`${baseUrl}/api/projects`, {
    method: "POST",
    cookie,
    body: buildLiveValidationProjectInput({
      lab,
      startedAt,
    }),
  })
  const createdProject = createResult?.payload?.project

  if (!createdProject?.id) {
    throw new Error("Live validation project creation did not return a project id.")
  }

  return {
    created: true,
    projectId: createdProject.id,
    projectName: createdProject.name ?? "",
  }
}

export async function ensureWebSurfaceMcpRegistration({
  baseUrl,
  cookie,
  requestJson,
}) {
  const settingsResult = await requestJson(`${baseUrl}/api/settings/mcp-tools`, {
    cookie,
  })
  const servers = Array.isArray(settingsResult?.payload?.servers) ? settingsResult.payload.servers : []
  const toolContracts = Array.isArray(settingsResult?.payload?.toolContracts) ? settingsResult.payload.toolContracts : []
  const hasEnabledServer = servers.some((server) => server.serverName === WEB_SURFACE_SERVER_NAME && server.enabled)
  const hasToolContract = toolContracts.some(
    (contract) => contract.serverName === WEB_SURFACE_SERVER_NAME && contract.toolName === WEB_SURFACE_TOOL_NAME,
  )

  if (hasEnabledServer && hasToolContract) {
    return {
      registered: false,
      serverName: WEB_SURFACE_SERVER_NAME,
    }
  }

  const registrationResult = await requestJson(`${baseUrl}/api/settings/mcp-servers/register`, {
    method: "POST",
    cookie,
    body: buildWebSurfaceRegistrationPayload(),
  })

  return {
    registered: true,
    serverName: registrationResult?.payload?.server?.serverName ?? WEB_SURFACE_SERVER_NAME,
  }
}
