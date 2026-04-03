/**
 * Prisma seed script — imports existing JSON prototype-store data into PostgreSQL.
 *
 * Usage:
 *   1. Start PostgreSQL: docker compose up db -d
 *   2. Apply schema: npx prisma db push
 *   3. Run seed: npx tsx prisma/seed.ts
 *
 * This script is idempotent — it uses upsert for all records.
 */

import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../lib/generated/prisma/client"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" })
const prisma = new PrismaClient({ adapter })

const STORE_PATH = join(process.cwd(), ".prototype-store", "prototype-store.json")

async function main() {
  if (!existsSync(STORE_PATH)) {
    console.log("No prototype-store.json found, skipping seed.")
    return
  }

  const store = JSON.parse(readFileSync(STORE_PATH, "utf-8"))
  console.log("Importing prototype-store data into PostgreSQL...")

  // Seed default user
  await prisma.user.upsert({
    where: { account: "researcher@company.local" },
    update: {},
    create: {
      id: "user-researcher-a",
      account: "researcher@company.local",
      password: "$2a$10$placeholder", // will be set by auth-repository bcrypt
      displayName: "研究员席位 A",
      role: "研究员",
    },
  })
  console.log("  ✓ User seeded")

  // Projects
  for (const p of store.projects ?? []) {
    await prisma.project.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        code: p.code ?? "",
        name: p.name,
        targetInput: p.targetInput ?? "",
        targets: p.targets ?? [],
        description: p.description ?? "",
        stage: p.stage ?? "授权与范围定义",
        status: p.status ?? "待启动",
        pendingApprovals: p.pendingApprovals ?? 0,
        openTasks: p.openTasks ?? 0,
        assetCount: p.assetCount ?? 0,
        evidenceCount: p.evidenceCount ?? 0,
        riskSummary: p.riskSummary ?? "",
        summary: p.summary ?? "",
        lastActor: p.lastActor ?? "",
      },
    })
  }
  console.log(`  ✓ ${(store.projects ?? []).length} projects`)

  // Project Details
  for (const d of store.projectDetails ?? []) {
    await prisma.projectDetail.upsert({
      where: { projectId: d.projectId },
      update: {},
      create: {
        projectId: d.projectId,
        target: d.target ?? "",
        blockingReason: d.blockingReason ?? "",
        nextStep: d.nextStep ?? "",
        reflowNotice: d.reflowNotice ?? "",
        currentFocus: d.currentFocus ?? "",
        timeline: d.timeline ?? [],
        tasks: d.tasks ?? [],
        discoveredInfo: d.discoveredInfo ?? [],
        serviceSurface: d.serviceSurface ?? [],
        fingerprints: d.fingerprints ?? [],
        entries: d.entries ?? [],
        scheduler: d.scheduler ?? [],
        activity: d.activity ?? [],
        resultMetrics: d.resultMetrics ?? [],
        assetGroups: d.assetGroups ?? [],
        currentStage: d.currentStage ?? {},
        approvalControl: d.approvalControl ?? {},
        closureStatus: d.closureStatus ?? {},
        finalConclusion: d.finalConclusion ?? undefined,
      },
    })
  }
  console.log(`  ✓ ${(store.projectDetails ?? []).length} project details`)

  // Approvals
  for (const a of store.approvals ?? []) {
    await prisma.approval.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        projectId: a.projectId,
        projectName: a.projectName ?? "",
        target: a.target ?? "",
        actionType: a.actionType ?? "",
        riskLevel: a.riskLevel ?? "中",
        rationale: a.rationale ?? "",
        impact: a.impact ?? "",
        mcpCapability: a.mcpCapability ?? "",
        tool: a.tool ?? "",
        status: a.status ?? "待处理",
        parameterSummary: a.parameterSummary ?? "",
        prerequisites: a.prerequisites ?? [],
        stopCondition: a.stopCondition ?? "",
        blockingImpact: a.blockingImpact ?? "",
        queuePosition: a.queuePosition ?? 0,
      },
    })
  }
  console.log(`  ✓ ${(store.approvals ?? []).length} approvals`)

  // Assets
  for (const a of store.assets ?? []) {
    await prisma.asset.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        projectId: a.projectId,
        projectName: a.projectName ?? "",
        type: a.type ?? "",
        label: a.label ?? "",
        profile: a.profile ?? "",
        scopeStatus: a.scopeStatus ?? "待验证",
        lastSeen: a.lastSeen ?? "",
        host: a.host ?? "",
        ownership: a.ownership ?? "",
        confidence: a.confidence ?? "",
        exposure: a.exposure ?? "",
        linkedEvidenceId: a.linkedEvidenceId ?? "",
        linkedTaskTitle: a.linkedTaskTitle ?? "",
        issueLead: a.issueLead ?? "",
        relations: a.relations ?? [],
      },
    })
  }
  console.log(`  ✓ ${(store.assets ?? []).length} assets`)

  // Evidence
  for (const e of store.evidenceRecords ?? []) {
    await prisma.evidence.upsert({
      where: { id: e.id },
      update: {},
      create: {
        id: e.id,
        projectId: e.projectId,
        projectName: e.projectName ?? "",
        title: e.title ?? "",
        source: e.source ?? "",
        confidence: e.confidence ?? "",
        conclusion: e.conclusion ?? "",
        linkedApprovalId: e.linkedApprovalId ?? "",
        rawOutput: e.rawOutput ?? [],
        screenshotNote: e.screenshotNote ?? "",
        structuredSummary: e.structuredSummary ?? [],
        linkedTaskTitle: e.linkedTaskTitle ?? "",
        linkedAssetLabel: e.linkedAssetLabel ?? "",
        timeline: e.timeline ?? [],
        verdict: e.verdict ?? "",
        capturedUrl: e.capturedUrl,
        screenshotArtifactPath: e.screenshotArtifactPath,
        htmlArtifactPath: e.htmlArtifactPath,
      },
    })
  }
  console.log(`  ✓ ${(store.evidenceRecords ?? []).length} evidence records`)

  // Findings
  for (const f of store.projectFindings ?? []) {
    await prisma.finding.upsert({
      where: { id: f.id },
      update: {},
      create: {
        id: f.id,
        projectId: f.projectId,
        severity: f.severity ?? "信息",
        status: f.status ?? "待验证",
        title: f.title ?? "",
        summary: f.summary ?? "",
        affectedSurface: f.affectedSurface ?? "",
        evidenceId: f.evidenceId ?? "",
        owner: f.owner ?? "",
      },
    })
  }
  console.log(`  ✓ ${(store.projectFindings ?? []).length} findings`)

  // MCP Runs
  for (const r of store.mcpRuns ?? []) {
    await prisma.mcpRun.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        projectId: r.projectId,
        projectName: r.projectName ?? "",
        capability: r.capability ?? "",
        toolId: r.toolId ?? "",
        toolName: r.toolName ?? "",
        requestedAction: r.requestedAction ?? "",
        target: r.target ?? "",
        riskLevel: r.riskLevel ?? "中",
        boundary: r.boundary ?? "平台内部处理",
        dispatchMode: r.dispatchMode ?? "自动执行",
        status: r.status ?? "待审批",
        requestedBy: r.requestedBy ?? "",
        connectorMode: r.connectorMode,
        linkedApprovalId: r.linkedApprovalId,
        summaryLines: r.summaryLines ?? [],
      },
    })
  }
  console.log(`  ✓ ${(store.mcpRuns ?? []).length} MCP runs`)

  // LLM Profiles — migrate old "extractor" to "analyzer"
  await prisma.llmProfile.deleteMany({ where: { id: "extractor" } })
  for (const p of store.llmProfiles ?? []) {
    await prisma.llmProfile.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        provider: p.provider ?? "openai-compatible",
        label: p.label ?? "",
        apiKey: p.apiKey ?? "",
        baseUrl: p.baseUrl ?? "",
        model: p.model ?? "",
        timeoutMs: p.timeoutMs ?? 120000,
        temperature: p.temperature ?? 0.2,
        enabled: p.enabled ?? false,
      },
    })
  }
  console.log(`  ✓ ${(store.llmProfiles ?? []).length} LLM profiles`)

  // MCP Tools
  for (const t of store.mcpTools ?? []) {
    await prisma.mcpTool.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        capability: t.capability ?? "",
        toolName: t.toolName ?? "",
        version: t.version ?? "",
        riskLevel: t.riskLevel ?? "中",
        status: t.status ?? "启用",
        category: t.category ?? "",
        description: t.description ?? "",
        inputMode: t.inputMode ?? "",
        outputMode: t.outputMode ?? "",
        boundary: t.boundary ?? "平台内部处理",
        requiresApproval: t.requiresApproval ?? false,
        endpoint: t.endpoint ?? "",
        owner: t.owner ?? "",
        defaultConcurrency: t.defaultConcurrency ?? "",
        rateLimit: t.rateLimit ?? "",
        timeout: t.timeout ?? "",
        retry: t.retry ?? "",
        lastCheck: t.lastCheck ?? "",
        notes: t.notes ?? "",
      },
    })
  }
  console.log(`  ✓ ${(store.mcpTools ?? []).length} MCP tools`)

  // Scheduler Tasks
  for (const t of store.schedulerTasks ?? []) {
    await prisma.schedulerTask.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        projectId: t.projectId,
        projectName: t.projectName ?? "",
        runId: t.runId ?? "",
        capability: t.capability ?? t.actionType ?? "",
        target: t.target ?? "",
        toolName: t.toolName ?? "",
        connectorMode: t.connectorMode ?? "local",
        status: t.status ?? "ready",
        attempts: t.retryCount ?? t.attempts ?? 0,
        maxAttempts: t.maxRetries ?? t.maxAttempts ?? 3,
        summaryLines: t.summaryLines ?? [],
        lastError: t.errorMessage ?? t.lastError ?? null,
        linkedApprovalId: t.linkedApprovalId ?? null,
        workerId: t.claimedBy ?? t.workerId ?? null,
        leaseToken: t.leaseToken ?? null,
        leaseStartedAt: t.leaseStartedAt ?? null,
        leaseExpiresAt: t.leaseExpiresAt ?? null,
        heartbeatAt: t.heartbeatAt ?? null,
        recoveryCount: t.recoveryCount ?? null,
        lastRecoveredAt: t.lastRecoveredAt ?? null,
      },
    })
  }
  console.log(`  ✓ ${(store.schedulerTasks ?? []).length} scheduler tasks`)

  // Audit Logs (schema: id, category, summary, projectName?, actor, timestamp, status)
  for (const l of store.auditLogs ?? []) {
    await prisma.auditLog.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        category: l.category ?? l.action ?? "",
        summary: l.summary ?? l.detail ?? "",
        projectName: l.projectName ?? null,
        actor: l.actor ?? "",
        status: l.status ?? "",
      },
    })
  }
  console.log(`  ✓ ${(store.auditLogs ?? []).length} audit logs`)

  // Work Logs (schema: id, category, summary, projectName?, actor, timestamp, status)
  for (const w of store.workLogs ?? []) {
    await prisma.workLog.upsert({
      where: { id: w.id },
      update: {},
      create: {
        id: w.id,
        category: w.category ?? w.action ?? "",
        summary: w.summary ?? w.detail ?? "",
        projectName: w.projectName ?? null,
        actor: w.actor ?? "",
        status: w.status ?? "",
      },
    })
  }
  console.log(`  ✓ ${(store.workLogs ?? []).length} work logs`)

  // Orchestrator Plans (keyed by projectId in JSON store)
  const plansObj = store.orchestratorPlans ?? {}
  for (const [projectId, p] of Object.entries(plansObj)) {
    const plan = p as Record<string, unknown>
    await prisma.orchestratorPlan.upsert({
      where: { projectId },
      update: {},
      create: {
        projectId,
        provider: (plan.provider as string) ?? "",
        summary: (plan.summary as string) ?? (plan.strategy as string) ?? "",
        items: plan.items ?? plan.phases ?? [],
      },
    })
  }
  console.log(`  ✓ ${Object.keys(plansObj).length} orchestrator plans`)

  // Orchestrator Rounds (keyed by projectId in JSON store, each value is an array of rounds)
  const roundsObj = store.orchestratorRounds ?? {}
  let roundCount = 0
  for (const [projectId, rounds] of Object.entries(roundsObj)) {
    const roundArr = Array.isArray(rounds) ? rounds : [rounds]
    for (const r of roundArr) {
      const rr = r as Record<string, unknown>
      const roundNum = (rr.round ?? rr.roundNumber ?? 0) as number
      const id = (rr.id as string) ?? `round-${projectId}-${roundNum}`
      await prisma.orchestratorRound.upsert({
        where: { id },
        update: {},
        create: {
          id,
          projectId,
          round: roundNum,
          startedAt: (rr.startedAt as string) ?? "",
          completedAt: (rr.completedAt as string) ?? "",
          planItemCount: (rr.planItemCount as number) ?? 0,
          executedCount: (rr.executedCount as number) ?? 0,
          newAssetCount: (rr.newAssetCount as number) ?? 0,
          newEvidenceCount: (rr.newEvidenceCount as number) ?? 0,
          newFindingCount: (rr.newFindingCount as number) ?? 0,
          failedActions: (rr.failedActions as string[]) ?? [],
          blockedByApproval: (rr.blockedByApproval as string[]) ?? [],
          summaryForNextRound: (rr.summaryForNextRound as string) ?? "",
          reflection: rr.reflection as unknown ?? undefined,
        },
      })
      roundCount++
    }
  }
  console.log(`  ✓ ${roundCount} orchestrator rounds`)

  // Project Conclusions (schema: id, projectId, generatedAt, source, summary, keyPoints[], nextActions[], assetCount, evidenceCount, findingCount)
  for (const c of store.projectConclusions ?? []) {
    await prisma.projectConclusion.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        projectId: c.projectId,
        source: c.source ?? "reviewer",
        summary: c.summary ?? c.executiveSummary ?? "",
        keyPoints: c.keyPoints ?? c.keyFindings ?? [],
        nextActions: c.nextActions ?? c.recommendations ?? [],
        assetCount: c.assetCount ?? 0,
        evidenceCount: c.evidenceCount ?? 0,
        findingCount: c.findingCount ?? 0,
      },
    })
  }
  console.log(`  ✓ ${(store.projectConclusions ?? []).length} project conclusions`)

  // Project Form Presets (keyed by projectId in JSON store)
  const presetsObj = store.projectFormPresets ?? {}
  for (const [projectId, f] of Object.entries(presetsObj)) {
    const fp = f as Record<string, unknown>
    await prisma.projectFormPreset.upsert({
      where: { projectId },
      update: {},
      create: {
        projectId,
        name: (fp.name as string) ?? "",
        targetInput: (fp.targetInput as string) ?? "",
        description: (fp.description as string) ?? "",
      },
    })
  }
  console.log(`  ✓ ${Object.keys(presetsObj).length} project form presets`)

  // Project Scheduler Controls (schema: id, projectId, lifecycle, paused, autoReplan, maxRounds, currentRound, note)
  for (const [projectId, ctrl] of Object.entries(store.projectSchedulerControls ?? {})) {
    const c = ctrl as Record<string, unknown>
    await prisma.projectSchedulerControl.upsert({
      where: { projectId },
      update: {},
      create: {
        projectId,
        lifecycle: (c.lifecycle as string) ?? "idle",
        paused: (c.paused as boolean) ?? false,
        autoReplan: (c.autoReplan as boolean) ?? true,
        maxRounds: (c.maxRounds as number) ?? 3,
        currentRound: (c.currentRound as number) ?? 0,
        note: (c.note as string) ?? "",
      },
    })
  }
  console.log(`  ✓ ${Object.keys(store.projectSchedulerControls ?? {}).length} project scheduler controls`)

  // Global Approval Control
  const gac = store.globalApprovalControl
  if (gac && typeof gac === "object") {
    await prisma.globalApprovalControl.upsert({
      where: { id: "global" },
      update: {},
      create: {
        id: "global",
        enabled: gac.enabled ?? true,
        mode: gac.mode ?? "高风险需审批",
        autoApproveLowRisk: gac.autoApproveLowRisk ?? true,
        description: gac.description ?? "",
        note: gac.note ?? "",
      },
    })
    console.log(`  ✓ Global approval control`)
  }

  // MCP Server Contracts — no stable unique key from JSON, use createMany with skipDuplicates
  await prisma.mcpServerContract.deleteMany({})
  for (const s of store.mcpServerContracts ?? []) {
    await prisma.mcpServerContract.create({
      data: {
        serverId: s.serverId ?? "",
        serverName: s.serverName ?? "",
        version: s.version ?? "",
        transport: s.transport ?? "stdio",
        enabled: s.enabled ?? true,
        toolNames: s.toolNames ?? [],
        command: s.command ?? null,
        endpoint: s.endpoint ?? "",
        projectId: s.projectId ?? null,
      },
    })
  }
  console.log(`  ✓ ${(store.mcpServerContracts ?? []).length} MCP server contracts`)

  // MCP Tool Contracts — no stable unique key from JSON, recreate
  await prisma.mcpToolContract.deleteMany({})
  for (const t of store.mcpToolContracts ?? []) {
    await prisma.mcpToolContract.create({
      data: {
        serverId: t.serverId ?? "",
        serverName: t.serverName ?? "",
        toolName: t.toolName ?? "",
        title: t.title ?? "",
        capability: t.capability ?? "",
        boundary: t.boundary ?? "平台内部处理",
        riskLevel: t.riskLevel ?? "中",
        requiresApproval: t.requiresApproval ?? false,
        resultMappings: t.resultMappings ?? [],
        projectId: t.projectId ?? null,
      },
    })
  }
  console.log(`  ✓ ${(store.mcpToolContracts ?? []).length} MCP tool contracts`)

  // LLM Call Logs (schema: id, projectId, role, phase, prompt, response, status, model, provider, tokenUsage, durationMs, error)
  for (const l of store.llmCallLogs ?? []) {
    await prisma.llmCallLog.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        projectId: l.projectId ?? "",
        role: l.role ?? l.caller ?? "",
        phase: l.phase ?? "",
        prompt: l.prompt ?? "",
        response: l.response ?? "",
        status: l.status ?? "completed",
        model: l.model ?? "",
        provider: l.provider ?? "",
        tokenUsage: l.tokenUsage ?? null,
        durationMs: l.durationMs ?? null,
        error: l.error ?? l.errorMessage ?? null,
      },
    })
  }
  console.log(`  ✓ ${(store.llmCallLogs ?? []).length} LLM call logs`)

  console.log("\nSeed complete!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
