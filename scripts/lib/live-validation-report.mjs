function sanitizeSegment(value) {
  return String(value)
    .trim()
    .replace(/[:.]/g, "-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "run"
}

function toDurationSeconds(startedAt, finishedAt) {
  const startTime = Date.parse(startedAt)
  const endTime = Date.parse(finishedAt)

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
    return null
  }

  return Math.round((endTime - startTime) / 1000)
}

function buildPlanLines(planItems) {
  if (!Array.isArray(planItems) || planItems.length === 0) {
    return ["- No plan items recorded."]
  }

  return planItems.map((item, index) => {
    return `- ${index + 1}. [${item.riskLevel}] ${item.capability} | ${item.requestedAction} | ${item.target}`
  })
}

function buildRunLines(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return ["- No MCP runs recorded."]
  }

  return runs.map((run, index) => {
    const connectorMode = run.connectorMode ? ` / ${run.connectorMode}` : ""

    return `- ${index + 1}. ${run.status} | ${run.capability} | ${run.toolName}${connectorMode} | ${run.target}`
  })
}

function buildInvocationLines(invocations) {
  if (!Array.isArray(invocations) || invocations.length === 0) {
    return ["- No external MCP invocations recorded."]
  }

  return invocations.map((invocation, index) => {
    return `- ${index + 1}. ${invocation.status} | ${invocation.serverName} | ${invocation.toolName} | ${invocation.target}`
  })
}

export function buildLiveValidationArtifactBundle(input) {
  const directoryName = `${sanitizeSegment(input.startedAt)}-${sanitizeSegment(input.lab.id)}`
  const durationSeconds = toDurationSeconds(input.startedAt, input.finishedAt)
  const realRunCount = (input.validation.runs ?? []).filter((run) => run.connectorMode === "real").length
  const summary = {
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationSeconds,
    projectId: input.project.id,
    projectName: input.project.name,
    labId: input.lab.id,
    labName: input.lab.name,
    validationStatus: input.validation.status,
    approvalStatus: input.validation.approval?.status ?? null,
    provider: {
      provider: input.provider.provider,
      enabled: Boolean(input.provider.enabled),
      baseUrl: input.provider.baseUrl,
      orchestratorModel: input.provider.orchestratorModel,
    },
    counts: {
      planItems: input.validation.planItems?.length ?? 0,
      runs: input.validation.runs?.length ?? 0,
      realRuns: realRunCount,
      assets: input.context.assetCount ?? 0,
      evidence: input.context.evidenceCount ?? 0,
      findings: input.context.findingCount ?? 0,
      mcpServers: input.mcp.serverCount ?? 0,
      realMcpInvocations: input.mcp.invocationCount ?? 0,
    },
  }
  const markdownLines = [
    "# Real LLM / MCP / Local Lab Validation Report",
    "",
    "## Run",
    `- Project: ${input.project.name} (${input.project.id})`,
    `- Lab: ${input.lab.name} (${input.lab.id})`,
    `- Target: ${input.lab.baseUrl}`,
    `- Started At: ${input.startedAt}`,
    `- Finished At: ${input.finishedAt}`,
    `- Duration Seconds: ${durationSeconds ?? "unknown"}`,
    `- Validation Status: ${input.validation.status}`,
    "",
    "## Provider",
    `- Provider: ${input.provider.provider}`,
    `- Enabled: ${input.provider.enabled ? "yes" : "no"}`,
    `- Base URL: ${input.provider.baseUrl}`,
    `- Orchestrator Model: ${input.provider.orchestratorModel}`,
    "",
    "## Plan",
    `- Summary: ${input.validation.planSummary}`,
    ...buildPlanLines(input.validation.planItems),
    "",
    "## MCP Runs",
    ...buildRunLines(input.validation.runs),
    "",
    "## Approval",
    `- Status: ${input.validation.approval?.status ?? "none"}`,
    `- Approval ID: ${input.validation.approval?.id ?? "none"}`,
    `- Action: ${input.validation.approval?.actionType ?? "none"}`,
    "",
    "## Project Context",
    `- Assets: ${input.context.assetCount ?? 0}`,
    `- Evidence: ${input.context.evidenceCount ?? 0}`,
    `- Findings: ${input.context.findingCount ?? 0}`,
    "",
    "## External MCP Evidence",
    `- Connected Servers: ${input.mcp.serverCount ?? 0}`,
    `- Recent Invocations: ${input.mcp.invocationCount ?? 0}`,
    ...buildInvocationLines(input.mcp.invocations),
  ]

  return {
    directoryName,
    summary,
    markdown: markdownLines.join("\n"),
  }
}
