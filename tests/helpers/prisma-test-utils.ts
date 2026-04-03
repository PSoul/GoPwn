import { prisma } from "@/lib/infra/prisma"

const DEFAULT_LLM_PROFILES = [
  { id: "orchestrator", provider: "openai-compatible", label: "Default Orchestrator", apiKey: "", baseUrl: "", model: "", timeoutMs: 120000, temperature: 0.2, enabled: false },
  { id: "reviewer", provider: "openai-compatible", label: "Default Reviewer", apiKey: "", baseUrl: "", model: "", timeoutMs: 120000, temperature: 0.1, enabled: false },
  { id: "analyzer", provider: "openai-compatible", label: "Default Analyzer", apiKey: "", baseUrl: "", model: "", timeoutMs: 120000, temperature: 0, enabled: false },
] as const

/**
 * Truncate all tables with CASCADE. Retries on transient deadlocks that
 * can occur when a prior test's MCP heartbeat timer races against cleanup.
 */
export async function cleanDatabase() {
  // Delete rows in child-first order to respect FK constraints.
  // Individual DELETE statements avoid the ACCESS EXCLUSIVE table lock
  // that TRUNCATE takes, preventing deadlocks with in-flight Prisma queries.
  await prisma.llmCallLog.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.workLog.deleteMany()
  await prisma.orchestratorRound.deleteMany()
  await prisma.orchestratorPlan.deleteMany()
  await prisma.finding.deleteMany()
  await prisma.evidence.deleteMany()
  await prisma.asset.deleteMany()
  await prisma.approval.deleteMany()
  await prisma.mcpRun.deleteMany()
  await prisma.schedulerTask.deleteMany()
  await prisma.projectConclusion.deleteMany()
  await prisma.projectSchedulerControl.deleteMany()
  await prisma.projectFormPreset.deleteMany()
  await prisma.projectDetail.deleteMany()
  await prisma.project.deleteMany()
  await prisma.mcpToolContract.deleteMany()
  await prisma.mcpServerContract.deleteMany()
  await prisma.mcpTool.deleteMany()
  await prisma.llmProfile.deleteMany()
  await prisma.globalApprovalControl.deleteMany()
  await prisma.approvalPolicy.deleteMany()
  await prisma.scopeRule.deleteMany()
  await prisma.user.deleteMany()
}

/**
 * Seed the default test users (same as ensureSeedUsers but deterministic).
 */
export async function seedTestUsers() {
  const bcrypt = await import("bcryptjs")
  const defaultPassword = await bcrypt.hash("Prototype@2026", 10)

  await prisma.user.createMany({
    data: [
      {
        id: "user-seed-admin",
        account: "admin@company.local",
        displayName: "平台管理员",
        role: "admin",
        status: "active",
        password: defaultPassword,
      },
      {
        id: "user-seed-researcher",
        account: "researcher@company.local",
        displayName: "研究员席位 A",
        role: "researcher",
        status: "active",
        password: defaultPassword,
      },
      {
        id: "user-seed-approver",
        account: "approver@company.local",
        displayName: "审批席位 A",
        role: "approver",
        status: "active",
        password: defaultPassword,
      },
    ],
    skipDuplicates: true,
  })

  // Seed default LLM profiles so settings pages render correctly
  await prisma.llmProfile.createMany({
    data: DEFAULT_LLM_PROFILES.map((p) => ({
      id: p.id,
      provider: p.provider,
      label: p.label,
      apiKey: p.apiKey,
      baseUrl: p.baseUrl,
      model: p.model,
      timeoutMs: p.timeoutMs,
      temperature: p.temperature,
      enabled: p.enabled,
    })),
    skipDuplicates: true,
  })
}
