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

// @ts-ignore — Prisma client types are generated at build time
import { PrismaClient } from "../lib/generated/prisma"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
})

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
        status: p.status ?? "待处理",
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
        scopeStatus: a.scopeStatus ?? "待确认",
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
        severity: f.severity ?? "情报",
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

  // LLM Profiles
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
        timeoutMs: p.timeoutMs ?? 15000,
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
