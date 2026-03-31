/**
 * Bidirectional conversion between Prisma DB models and TypeScript interfaces.
 *
 * "to*Record" functions convert Prisma query results into the app-layer
 * types defined in `lib/prototype-types.ts`.
 *
 * "from*Record" functions convert app-layer types into Prisma create/update
 * input shapes (typed as `any` to stay decoupled from generated code).
 */

import type {
  ApprovalControl,
  ApprovalRecord,
  AssetRecord,
  AssetRelation,
  EvidenceRecord,
  LlmCallLogRecord,
  LlmProfileRecord,
  LogRecord,
  McpRunRecord,
  McpSchedulerTaskRecord,
  McpToolRecord,
  OrchestratorPlanItem,
  OrchestratorPlanRecord,
  OrchestratorRoundRecord,
  PolicyRecord,
  ProjectConclusionRecord,
  ProjectClosureStatusRecord,
  ProjectDetailRecord,
  ProjectFindingRecord,
  ProjectFormPreset,
  ProjectKnowledgeItem,
  ProjectRecord,
  ProjectResultMetric,
  ProjectInventoryGroup,
  ProjectSchedulerControl,
  ProjectStageSnapshot,
  TaskRecord,
  TimelineStage,
  UserRecord,
} from "@/lib/prototype-types"

// ──────────────────────────────────────────────
// Timestamp helpers
// ──────────────────────────────────────────────

/** Convert a JS Date to the display format used throughout the UI: "YYYY-MM-DD HH:MM" */
export function toDisplayTimestamp(date: Date): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const h = String(date.getHours()).padStart(2, "0")
  const mi = String(date.getMinutes()).padStart(2, "0")
  return `${y}-${mo}-${d} ${h}:${mi}`
}

/** Parse a "YYYY-MM-DD HH:MM" display string back to a Date. */
export function toDbTimestamp(display: string): Date {
  // Accept both "YYYY-MM-DD HH:MM" and ISO strings
  const d = new Date(display.replace(" ", "T"))
  if (isNaN(d.getTime())) {
    return new Date()
  }
  return d
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function dateToStr(v: Date | string | null | undefined): string {
  if (!v) return ""
  if (v instanceof Date) return toDisplayTimestamp(v)
  return String(v)
}

function optDateToStr(v: Date | string | null | undefined): string | undefined {
  if (v === null || v === undefined) return undefined
  if (v instanceof Date) return toDisplayTimestamp(v)
  return String(v)
}

// ──────────────────────────────────────────────
// User
// ──────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

export function toUserRecord(db: any): UserRecord {
  return {
    id: db.id,
    email: db.account,
    passwordHash: db.password,
    displayName: db.displayName,
    role: db.role,
    status: db.status,
    createdAt: dateToStr(db.createdAt),
    lastLoginAt: optDateToStr(db.lastLoginAt),
  }
}

export function fromUserRecord(record: UserRecord): any {
  return {
    id: record.id,
    account: record.email,
    password: record.passwordHash,
    displayName: record.displayName,
    role: record.role,
    status: record.status,
  }
}

// ──────────────────────────────────────────────
// Project
// ──────────────────────────────────────────────

export function toProjectRecord(db: any): ProjectRecord {
  return {
    id: db.id,
    code: db.code,
    name: db.name,
    targetInput: db.targetInput,
    targets: db.targets ?? [],
    description: db.description ?? "",
    stage: db.stage,
    status: db.status,
    pendingApprovals: db.pendingApprovals ?? 0,
    openTasks: db.openTasks ?? 0,
    assetCount: db.assetCount ?? 0,
    evidenceCount: db.evidenceCount ?? 0,
    createdAt: dateToStr(db.createdAt),
    lastUpdated: dateToStr(db.lastUpdated),
    lastActor: db.lastActor ?? "",
    riskSummary: db.riskSummary ?? "",
    summary: db.summary ?? "",
  }
}

export function fromProjectRecord(record: ProjectRecord): any {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    targetInput: record.targetInput,
    targets: record.targets,
    description: record.description,
    stage: record.stage,
    status: record.status,
    pendingApprovals: record.pendingApprovals,
    openTasks: record.openTasks,
    assetCount: record.assetCount,
    evidenceCount: record.evidenceCount,
    lastActor: record.lastActor,
    riskSummary: record.riskSummary,
    summary: record.summary,
  }
}

// ──────────────────────────────────────────────
// ProjectDetail (14 JSON columns)
// ──────────────────────────────────────────────

export function toProjectDetailRecord(db: any): ProjectDetailRecord {
  return {
    projectId: db.projectId,
    target: db.target ?? "",
    blockingReason: db.blockingReason ?? "",
    nextStep: db.nextStep ?? "",
    reflowNotice: db.reflowNotice ?? "",
    currentFocus: db.currentFocus ?? "",
    timeline: (db.timeline ?? []) as TimelineStage[],
    tasks: (db.tasks ?? []) as TaskRecord[],
    discoveredInfo: (db.discoveredInfo ?? []) as ProjectKnowledgeItem[],
    serviceSurface: (db.serviceSurface ?? []) as ProjectKnowledgeItem[],
    fingerprints: (db.fingerprints ?? []) as ProjectKnowledgeItem[],
    entries: (db.entries ?? []) as ProjectKnowledgeItem[],
    scheduler: (db.scheduler ?? []) as ProjectKnowledgeItem[],
    activity: (db.activity ?? []) as ProjectKnowledgeItem[],
    resultMetrics: (db.resultMetrics ?? []) as ProjectResultMetric[],
    assetGroups: (db.assetGroups ?? []) as ProjectInventoryGroup[],
    findings: [], // findings come from the Finding model, not stored in detail JSON
    currentStage: (db.currentStage ?? {}) as ProjectStageSnapshot,
    approvalControl: (db.approvalControl ?? {}) as ApprovalControl,
    closureStatus: (db.closureStatus ?? {}) as ProjectClosureStatusRecord,
    finalConclusion: (db.finalConclusion as ProjectConclusionRecord) ?? null,
  }
}

export function fromProjectDetailRecord(record: ProjectDetailRecord, projectId: string): any {
  return {
    projectId,
    target: record.target,
    blockingReason: record.blockingReason,
    nextStep: record.nextStep,
    reflowNotice: record.reflowNotice,
    currentFocus: record.currentFocus,
    timeline: record.timeline,
    tasks: record.tasks,
    discoveredInfo: record.discoveredInfo,
    serviceSurface: record.serviceSurface,
    fingerprints: record.fingerprints,
    entries: record.entries,
    scheduler: record.scheduler,
    activity: record.activity,
    resultMetrics: record.resultMetrics,
    assetGroups: record.assetGroups,
    currentStage: record.currentStage,
    approvalControl: record.approvalControl,
    closureStatus: record.closureStatus,
    finalConclusion: record.finalConclusion,
  }
}

// ──────────────────────────────────────────────
// Asset
// ──────────────────────────────────────────────

export function toAssetRecord(db: any): AssetRecord {
  return {
    id: db.id,
    projectId: db.projectId,
    projectName: db.projectName,
    type: db.type,
    label: db.label,
    profile: db.profile ?? "",
    scopeStatus: db.scopeStatus,
    lastSeen: db.lastSeen ?? "",
    host: db.host ?? "",
    ownership: db.ownership ?? "",
    confidence: db.confidence ?? "",
    exposure: db.exposure ?? "",
    linkedEvidenceId: db.linkedEvidenceId ?? "",
    linkedTaskTitle: db.linkedTaskTitle ?? "",
    issueLead: db.issueLead ?? "",
    relations: (db.relations ?? []) as AssetRelation[],
  }
}

export function fromAssetRecord(record: AssetRecord): any {
  return {
    id: record.id,
    projectId: record.projectId,
    projectName: record.projectName,
    type: record.type,
    label: record.label,
    profile: record.profile,
    scopeStatus: record.scopeStatus,
    lastSeen: record.lastSeen,
    host: record.host,
    ownership: record.ownership,
    confidence: record.confidence,
    exposure: record.exposure,
    linkedEvidenceId: record.linkedEvidenceId,
    linkedTaskTitle: record.linkedTaskTitle,
    issueLead: record.issueLead,
    relations: record.relations,
  }
}

// ──────────────────────────────────────────────
// Evidence
// ──────────────────────────────────────────────

export function toEvidenceRecord(db: any): EvidenceRecord {
  return {
    id: db.id,
    projectId: db.projectId,
    projectName: db.projectName,
    title: db.title,
    source: db.source ?? "",
    confidence: db.confidence ?? "",
    conclusion: db.conclusion ?? "",
    linkedApprovalId: db.linkedApprovalId ?? "",
    rawOutput: db.rawOutput ?? [],
    screenshotNote: db.screenshotNote ?? "",
    structuredSummary: db.structuredSummary ?? [],
    linkedTaskTitle: db.linkedTaskTitle ?? "",
    linkedAssetLabel: db.linkedAssetLabel ?? "",
    timeline: db.timeline ?? [],
    verdict: db.verdict ?? "",
    capturedUrl: db.capturedUrl ?? undefined,
    screenshotArtifactPath: db.screenshotArtifactPath ?? undefined,
    htmlArtifactPath: db.htmlArtifactPath ?? undefined,
  }
}

export function fromEvidenceRecord(record: EvidenceRecord): any {
  return {
    id: record.id,
    projectId: record.projectId,
    projectName: record.projectName,
    title: record.title,
    source: record.source,
    confidence: record.confidence,
    conclusion: record.conclusion,
    linkedApprovalId: record.linkedApprovalId,
    rawOutput: record.rawOutput,
    screenshotNote: record.screenshotNote,
    structuredSummary: record.structuredSummary,
    linkedTaskTitle: record.linkedTaskTitle,
    linkedAssetLabel: record.linkedAssetLabel,
    timeline: record.timeline,
    verdict: record.verdict,
    capturedUrl: record.capturedUrl,
    screenshotArtifactPath: record.screenshotArtifactPath,
    htmlArtifactPath: record.htmlArtifactPath,
  }
}

// ──────────────────────────────────────────────
// Approval
// ──────────────────────────────────────────────

export function toApprovalRecord(db: any): ApprovalRecord {
  return {
    id: db.id,
    projectId: db.projectId,
    projectName: db.projectName,
    target: db.target,
    actionType: db.actionType,
    riskLevel: db.riskLevel,
    rationale: db.rationale ?? "",
    impact: db.impact ?? "",
    mcpCapability: db.mcpCapability ?? "",
    tool: db.tool ?? "",
    status: db.status,
    parameterSummary: db.parameterSummary ?? "",
    prerequisites: db.prerequisites ?? [],
    stopCondition: db.stopCondition ?? "",
    blockingImpact: db.blockingImpact ?? "",
    queuePosition: db.queuePosition ?? 0,
    submittedAt: dateToStr(db.submittedAt),
  }
}

export function fromApprovalRecord(record: ApprovalRecord): any {
  return {
    id: record.id,
    projectId: record.projectId,
    projectName: record.projectName,
    target: record.target,
    actionType: record.actionType,
    riskLevel: record.riskLevel,
    rationale: record.rationale,
    impact: record.impact,
    mcpCapability: record.mcpCapability,
    tool: record.tool,
    status: record.status,
    parameterSummary: record.parameterSummary,
    prerequisites: record.prerequisites,
    stopCondition: record.stopCondition,
    blockingImpact: record.blockingImpact,
    queuePosition: record.queuePosition,
    submittedAt: toDbTimestamp(record.submittedAt),
  }
}

// ──────────────────────────────────────────────
// Finding
// ──────────────────────────────────────────────

export function toFindingRecord(db: any): ProjectFindingRecord {
  return {
    id: db.id,
    projectId: db.projectId,
    severity: db.severity,
    status: db.status,
    title: db.title,
    summary: db.summary ?? "",
    affectedSurface: db.affectedSurface ?? "",
    evidenceId: db.evidenceId ?? "",
    owner: db.owner ?? "",
    updatedAt: dateToStr(db.updatedAt),
  }
}

export function fromFindingRecord(record: ProjectFindingRecord): any {
  return {
    id: record.id,
    projectId: record.projectId,
    severity: record.severity,
    status: record.status,
    title: record.title,
    summary: record.summary,
    affectedSurface: record.affectedSurface,
    evidenceId: record.evidenceId,
    owner: record.owner,
  }
}

// ──────────────────────────────────────────────
// McpRun
// ──────────────────────────────────────────────

export function toMcpRunRecord(db: any): McpRunRecord {
  return {
    id: db.id,
    projectId: db.projectId,
    projectName: db.projectName,
    capability: db.capability,
    toolId: db.toolId ?? "",
    toolName: db.toolName,
    requestedAction: db.requestedAction,
    target: db.target,
    riskLevel: db.riskLevel,
    boundary: db.boundary,
    dispatchMode: db.dispatchMode,
    status: db.status,
    requestedBy: db.requestedBy ?? "",
    createdAt: dateToStr(db.createdAt),
    updatedAt: dateToStr(db.updatedAt),
    connectorMode: db.connectorMode ?? undefined,
    linkedApprovalId: db.linkedApprovalId ?? undefined,
    summaryLines: db.summaryLines ?? [],
  }
}

export function fromMcpRunRecord(record: McpRunRecord): any {
  return {
    id: record.id,
    projectId: record.projectId,
    projectName: record.projectName,
    capability: record.capability,
    toolId: record.toolId,
    toolName: record.toolName,
    requestedAction: record.requestedAction,
    target: record.target ?? "",
    riskLevel: record.riskLevel,
    boundary: record.boundary,
    dispatchMode: record.dispatchMode,
    status: record.status,
    requestedBy: record.requestedBy ?? "",
    connectorMode: record.connectorMode,
    linkedApprovalId: record.linkedApprovalId,
    summaryLines: record.summaryLines ?? [],
  }
}

// ──────────────────────────────────────────────
// SchedulerTask
// ──────────────────────────────────────────────

export function toSchedulerTaskRecord(db: any): McpSchedulerTaskRecord {
  return {
    id: db.id,
    runId: db.runId,
    projectId: db.projectId,
    projectName: db.projectName,
    capability: db.capability,
    target: db.target,
    toolName: db.toolName,
    connectorMode: db.connectorMode,
    status: db.status,
    attempts: db.attempts ?? 0,
    maxAttempts: db.maxAttempts ?? 3,
    queuedAt: dateToStr(db.queuedAt),
    availableAt: dateToStr(db.availableAt),
    updatedAt: dateToStr(db.updatedAt),
    lastError: db.lastError ?? undefined,
    linkedApprovalId: db.linkedApprovalId ?? undefined,
    workerId: db.workerId ?? undefined,
    leaseToken: db.leaseToken ?? undefined,
    leaseStartedAt: db.leaseStartedAt ?? undefined,
    leaseExpiresAt: db.leaseExpiresAt ?? undefined,
    heartbeatAt: db.heartbeatAt ?? undefined,
    recoveryCount: db.recoveryCount ?? undefined,
    lastRecoveredAt: db.lastRecoveredAt ?? undefined,
    summaryLines: db.summaryLines ?? [],
  }
}

export function fromSchedulerTaskRecord(record: McpSchedulerTaskRecord): any {
  return {
    id: record.id,
    runId: record.runId,
    projectId: record.projectId,
    projectName: record.projectName ?? "",
    capability: record.capability ?? "",
    target: record.target ?? "",
    toolName: record.toolName ?? "",
    connectorMode: record.connectorMode ?? "local",
    status: record.status,
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    queuedAt: toDbTimestamp(record.queuedAt),
    availableAt: toDbTimestamp(record.availableAt),
    lastError: record.lastError,
    linkedApprovalId: record.linkedApprovalId,
    workerId: record.workerId,
    leaseToken: record.leaseToken,
    leaseStartedAt: record.leaseStartedAt,
    leaseExpiresAt: record.leaseExpiresAt,
    heartbeatAt: record.heartbeatAt,
    recoveryCount: record.recoveryCount,
    lastRecoveredAt: record.lastRecoveredAt,
    summaryLines: record.summaryLines,
  }
}

// ──────────────────────────────────────────────
// LlmProfile
// ──────────────────────────────────────────────

export function toLlmProfileRecord(db: any): LlmProfileRecord {
  return {
    id: db.id,
    provider: db.provider ?? "openai-compatible",
    label: db.label ?? "",
    apiKey: db.apiKey ?? "",
    baseUrl: db.baseUrl ?? "",
    model: db.model ?? "",
    timeoutMs: db.timeoutMs ?? 15000,
    temperature: db.temperature ?? 0.2,
    enabled: db.enabled ?? false,
    contextWindowSize: db.contextWindowSize ?? 65536,
  }
}

export function fromLlmProfileRecord(record: LlmProfileRecord): any {
  return {
    id: record.id,
    provider: record.provider,
    label: record.label,
    apiKey: record.apiKey,
    baseUrl: record.baseUrl,
    model: record.model,
    timeoutMs: record.timeoutMs,
    temperature: record.temperature,
    enabled: record.enabled,
    contextWindowSize: record.contextWindowSize,
  }
}

// ──────────────────────────────────────────────
// McpTool
// ──────────────────────────────────────────────

export function toMcpToolRecord(db: any): McpToolRecord {
  return {
    id: db.id,
    capability: db.capability,
    toolName: db.toolName,
    version: db.version ?? "",
    riskLevel: db.riskLevel,
    status: db.status,
    category: db.category ?? "",
    description: db.description ?? "",
    inputMode: db.inputMode ?? "",
    outputMode: db.outputMode ?? "",
    boundary: db.boundary,
    requiresApproval: db.requiresApproval ?? false,
    endpoint: db.endpoint ?? "",
    owner: db.owner ?? "",
    defaultConcurrency: db.defaultConcurrency ?? "",
    rateLimit: db.rateLimit ?? "",
    timeout: db.timeout ?? "",
    retry: db.retry ?? "",
    lastCheck: db.lastCheck ?? "",
    notes: db.notes ?? "",
  }
}

export function fromMcpToolRecord(record: McpToolRecord): any {
  return {
    id: record.id,
    capability: record.capability,
    toolName: record.toolName,
    version: record.version,
    riskLevel: record.riskLevel,
    status: record.status,
    category: record.category,
    description: record.description,
    inputMode: record.inputMode,
    outputMode: record.outputMode,
    boundary: record.boundary,
    requiresApproval: record.requiresApproval,
    endpoint: record.endpoint,
    owner: record.owner,
    defaultConcurrency: record.defaultConcurrency,
    rateLimit: record.rateLimit,
    timeout: record.timeout,
    retry: record.retry,
    lastCheck: record.lastCheck,
    notes: record.notes,
  }
}

// ──────────────────────────────────────────────
// Logs (AuditLog & WorkLog share the same shape)
// ──────────────────────────────────────────────

export function toLogRecord(db: any): LogRecord {
  return {
    id: db.id,
    category: db.category,
    summary: db.summary,
    projectName: db.projectName ?? undefined,
    actor: db.actor,
    timestamp: dateToStr(db.timestamp),
    status: db.status,
  }
}

export function fromLogRecord(record: LogRecord): any {
  return {
    id: record.id,
    category: record.category,
    summary: record.summary,
    projectName: record.projectName,
    actor: record.actor,
    timestamp: toDbTimestamp(record.timestamp),
    status: record.status,
  }
}

// ──────────────────────────────────────────────
// LlmCallLog
// ──────────────────────────────────────────────

export function toLlmCallLogRecord(db: any): LlmCallLogRecord {
  return {
    id: db.id,
    projectId: db.projectId,
    role: db.role,
    phase: db.phase,
    prompt: db.prompt,
    response: db.response ?? "",
    status: db.status,
    model: db.model ?? "",
    provider: db.provider ?? "",
    tokenUsage: (db.tokenUsage as LlmCallLogRecord["tokenUsage"]) ?? null,
    durationMs: db.durationMs ?? null,
    error: db.error ?? null,
    createdAt: dateToStr(db.createdAt),
    completedAt: db.completedAt ? dateToStr(db.completedAt) : null,
    projectName: db.project?.name ?? db.projectName,
  }
}

export function fromLlmCallLogRecord(record: LlmCallLogRecord): any {
  return {
    projectId: record.projectId,
    role: record.role,
    phase: record.phase,
    prompt: record.prompt,
    response: record.response,
    status: record.status,
    model: record.model,
    provider: record.provider,
    tokenUsage: record.tokenUsage,
    durationMs: record.durationMs,
    error: record.error,
  }
}

// ──────────────────────────────────────────────
// OrchestratorPlan
// ──────────────────────────────────────────────

export function toOrchestratorPlanRecord(db: any): OrchestratorPlanRecord {
  return {
    generatedAt: dateToStr(db.generatedAt),
    provider: db.provider,
    summary: db.summary ?? "",
    items: (db.items ?? []) as OrchestratorPlanItem[],
  }
}

export function fromOrchestratorPlanRecord(record: OrchestratorPlanRecord, projectId: string): any {
  return {
    projectId,
    generatedAt: toDbTimestamp(record.generatedAt),
    provider: record.provider,
    summary: record.summary,
    items: record.items,
  }
}

// ──────────────────────────────────────────────
// OrchestratorRound
// ──────────────────────────────────────────────

export function toOrchestratorRoundRecord(db: any): OrchestratorRoundRecord {
  return {
    round: db.round,
    startedAt: db.startedAt ?? "",
    completedAt: db.completedAt ?? "",
    planItemCount: db.planItemCount ?? 0,
    executedCount: db.executedCount ?? 0,
    newAssetCount: db.newAssetCount ?? 0,
    newEvidenceCount: db.newEvidenceCount ?? 0,
    newFindingCount: db.newFindingCount ?? 0,
    failedActions: db.failedActions ?? [],
    blockedByApproval: db.blockedByApproval ?? [],
    summaryForNextRound: db.summaryForNextRound ?? "",
    reflection: (db.reflection as OrchestratorRoundRecord["reflection"]) ?? undefined,
  }
}

export function fromOrchestratorRoundRecord(
  record: OrchestratorRoundRecord,
  projectId: string,
): any {
  return {
    projectId,
    round: record.round,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    planItemCount: record.planItemCount,
    executedCount: record.executedCount,
    newAssetCount: record.newAssetCount,
    newEvidenceCount: record.newEvidenceCount,
    newFindingCount: record.newFindingCount,
    failedActions: record.failedActions,
    blockedByApproval: record.blockedByApproval,
    summaryForNextRound: record.summaryForNextRound,
    reflection: record.reflection ?? null,
  }
}

// ──────────────────────────────────────────────
// ApprovalControl (GlobalApprovalControl)
// ──────────────────────────────────────────────

export function toApprovalControlRecord(db: any): ApprovalControl {
  return {
    enabled: db.enabled ?? true,
    mode: db.mode ?? "",
    autoApproveLowRisk: db.autoApproveLowRisk ?? true,
    description: db.description ?? "",
    note: db.note ?? "",
  }
}

export function fromApprovalControlRecord(record: ApprovalControl): any {
  return {
    enabled: record.enabled,
    mode: record.mode,
    autoApproveLowRisk: record.autoApproveLowRisk,
    description: record.description,
    note: record.note,
  }
}

// ──────────────────────────────────────────────
// PolicyRecord (ApprovalPolicy & ScopeRule)
// ──────────────────────────────────────────────

export function toPolicyRecord(db: any): PolicyRecord {
  return {
    title: db.title,
    description: db.description ?? "",
    owner: db.owner ?? "",
    status: db.status ?? "",
  }
}

export function fromPolicyRecord(record: PolicyRecord): any {
  return {
    title: record.title,
    description: record.description,
    owner: record.owner,
    status: record.status,
  }
}

// ──────────────────────────────────────────────
// ProjectConclusion
// ──────────────────────────────────────────────

export function toProjectConclusionRecord(db: any): ProjectConclusionRecord {
  return {
    id: db.id,
    projectId: db.projectId,
    generatedAt: dateToStr(db.generatedAt),
    source: db.source,
    summary: db.summary,
    keyPoints: db.keyPoints ?? [],
    nextActions: db.nextActions ?? [],
    assetCount: db.assetCount ?? 0,
    evidenceCount: db.evidenceCount ?? 0,
    findingCount: db.findingCount ?? 0,
  }
}

export function fromProjectConclusionRecord(record: ProjectConclusionRecord): any {
  return {
    id: record.id,
    projectId: record.projectId,
    generatedAt: toDbTimestamp(record.generatedAt),
    source: record.source,
    summary: record.summary,
    keyPoints: record.keyPoints,
    nextActions: record.nextActions,
    assetCount: record.assetCount,
    evidenceCount: record.evidenceCount,
    findingCount: record.findingCount,
  }
}

// ──────────────────────────────────────────────
// ProjectFormPreset
// ──────────────────────────────────────────────

export function toProjectFormPresetRecord(db: any): ProjectFormPreset {
  return {
    name: db.name,
    targetInput: db.targetInput,
    description: db.description ?? "",
  }
}

export function fromProjectFormPresetRecord(record: ProjectFormPreset, projectId: string): any {
  return {
    projectId,
    name: record.name,
    targetInput: record.targetInput,
    description: record.description,
  }
}

// ──────────────────────────────────────────────
// ProjectSchedulerControl
// ──────────────────────────────────────────────

export function toProjectSchedulerControlRecord(db: any): ProjectSchedulerControl {
  return {
    lifecycle: db.lifecycle ?? "idle",
    paused: db.paused ?? false,
    autoReplan: db.autoReplan ?? true,
    maxRounds: db.maxRounds ?? 3,
    currentRound: db.currentRound ?? 0,
    note: db.note ?? "",
    updatedAt: dateToStr(db.updatedAt),
  }
}

export function fromProjectSchedulerControlRecord(
  record: ProjectSchedulerControl,
  projectId: string,
): any {
  return {
    projectId,
    lifecycle: record.lifecycle,
    paused: record.paused,
    autoReplan: record.autoReplan,
    maxRounds: record.maxRounds,
    currentRound: record.currentRound,
    note: record.note,
  }
}
