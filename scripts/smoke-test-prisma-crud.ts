/**
 * Prisma CRUD smoke test — verifies read AND write paths through repository functions.
 * Run: DATA_LAYER=prisma npx tsx scripts/smoke-test-prisma-crud.ts
 */
import "dotenv/config"

// Force Prisma mode
process.env.DATA_LAYER = "prisma"

import { listStoredProjects, getStoredProjectById, createStoredProject, updateStoredProject, archiveStoredProject } from "../lib/project/project-repository"
import { listStoredAssets, upsertStoredAssets } from "../lib/data/asset-repository"
import { listStoredEvidence, upsertStoredEvidence } from "../lib/data/evidence-repository"
import { getStoredLlmProfile, listStoredLlmProfiles } from "../lib/llm/llm-settings-repository"
import { listStoredMcpTools } from "../lib/mcp/mcp-repository"
import { listStoredAuditLogs } from "../lib/project/project-repository"
import { getStoredProjectSchedulerControl } from "../lib/project/project-scheduler-control-repository"
import { listStoredWorkLogs } from "../lib/data/work-log-repository"

const passed: string[] = []
const failed: string[] = []

async function assert(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed.push(name)
    console.log(`  ✓ ${name}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    failed.push(`${name}: ${msg}`)
    console.log(`  ✗ ${name}: ${msg}`)
  }
}

async function main() {
  console.log("=== Prisma CRUD Smoke Test ===\n")
  console.log(`DATA_LAYER=${process.env.DATA_LAYER}`)
  console.log(`DATABASE_URL=${process.env.DATABASE_URL?.replace(/:[^@]+@/, ":***@")}\n`)

  // ── READ tests ──
  console.log("── Read Operations ──")

  await assert("listStoredProjects returns array", async () => {
    const projects = await listStoredProjects()
    if (!Array.isArray(projects)) throw new Error("not array")
    if (projects.length === 0) throw new Error("empty — expected seeded data")
  })

  await assert("getStoredProjectById returns project", async () => {
    const projects = await listStoredProjects()
    const p = await getStoredProjectById(projects[0].id)
    if (!p) throw new Error("null")
    if (!p.name) throw new Error("missing name")
  })

  await assert("listStoredAssets returns array", async () => {
    const assets = await listStoredAssets()
    if (!Array.isArray(assets)) throw new Error("not array")
  })

  await assert("listStoredEvidence returns array", async () => {
    const evidence = await listStoredEvidence()
    if (!Array.isArray(evidence)) throw new Error("not array")
  })

  await assert("listStoredLlmProfiles returns profiles", async () => {
    const profiles = await listStoredLlmProfiles()
    if (!Array.isArray(profiles)) throw new Error("not array")
  })

  await assert("listStoredMcpTools returns tools", async () => {
    const tools = await listStoredMcpTools()
    if (!Array.isArray(tools)) throw new Error("not array")
    if (tools.length === 0) throw new Error("empty")
  })

  await assert("listStoredAuditLogs returns logs", async () => {
    const logs = await listStoredAuditLogs()
    if (!Array.isArray(logs)) throw new Error("not array")
  })

  await assert("listStoredWorkLogs returns logs", async () => {
    const logs = await listStoredWorkLogs()
    if (!Array.isArray(logs)) throw new Error("not array")
  })

  await assert("getStoredProjectSchedulerControl", async () => {
    const projects = await listStoredProjects()
    const ctrl = await getStoredProjectSchedulerControl(projects[0].id)
    if (!ctrl) throw new Error("null — expected seeded scheduler control")
  })

  // ── WRITE tests ──
  console.log("\n── Write Operations ──")

  const testProjectId = `smoke-test-${Date.now()}`

  await assert("createStoredProject creates a new project", async () => {
    const result = await createStoredProject({
      name: "烟雾测试项目",
      targetInput: "192.168.1.0/24",
      description: "Prisma 写入路径验证",
    })
    if (!result || !result.project) throw new Error(`no result returned: ${JSON.stringify(result)}`)
    if (!result.project.id) throw new Error("no project id")
    ;(globalThis as any).__smokeProjectId = result.project.id
  })

  await assert("getStoredProjectById reads newly created project", async () => {
    const id = (globalThis as any).__smokeProjectId
    if (!id) throw new Error("no project id from create step")
    const p = await getStoredProjectById(id)
    if (!p) throw new Error("newly created project not found")
    if (p.name !== "烟雾测试项目") throw new Error(`wrong name: ${p.name}`)
  })

  await assert("updateStoredProject patches a field", async () => {
    const id = (globalThis as any).__smokeProjectId
    if (!id) throw new Error("no project id")
    await updateStoredProject(id, { description: "已更新描述 — Prisma写入验证" })
    const p = await getStoredProjectById(id)
    if (p?.description !== "已更新描述 — Prisma写入验证") throw new Error(`description not updated: ${p?.description}`)
  })

  await assert("upsertStoredAssets creates an asset", async () => {
    const id = (globalThis as any).__smokeProjectId
    if (!id) throw new Error("no project id")
    await upsertStoredAssets([{
      id: `asset-smoke-${Date.now()}`,
      projectId: id,
      projectName: "烟雾测试项目",
      type: "域名",
      label: "smoke.example.com",
      profile: "",
      scopeStatus: "已确认",
      lastSeen: "",
      host: "smoke.example.com",
      ownership: "",
      confidence: "高",
      exposure: "",
      linkedEvidenceId: "",
      linkedTaskTitle: "",
      issueLead: "",
      relations: [],
    }])
    const assets = await listStoredAssets(id)
    if (assets.length === 0) throw new Error("asset not found after upsert")
  })

  await assert("upsertStoredEvidence creates evidence", async () => {
    const id = (globalThis as any).__smokeProjectId
    if (!id) throw new Error("no project id")
    await upsertStoredEvidence([{
      id: `evidence-smoke-${Date.now()}`,
      projectId: id,
      projectName: "烟雾测试项目",
      title: "烟雾测试证据",
      source: "smoke-test",
      confidence: "高",
      conclusion: "测试通过",
      linkedApprovalId: "",
      rawOutput: [],
      screenshotNote: "",
      structuredSummary: [],
      linkedTaskTitle: "",
      linkedAssetLabel: "",
      timeline: [],
      verdict: "confirmed",
    }])
    const evidence = await listStoredEvidence(id)
    if (evidence.length === 0) throw new Error("evidence not found after upsert")
  })

  await assert("archiveStoredProject archives the project", async () => {
    const id = (globalThis as any).__smokeProjectId
    await archiveStoredProject(id)
    const p = await getStoredProjectById(id)
    if (p?.status !== "已完成") throw new Error(`status not archived: ${p?.status}`)
  })

  // ── Cleanup ──
  console.log("\n── Cleanup ──")
  // Leave smoke test data in DB for inspection, it won't affect anything

  // ── Summary ──
  console.log(`\n=== Results: ${passed.length} passed, ${failed.length} failed ===`)
  if (failed.length > 0) {
    console.log("\nFailed tests:")
    failed.forEach(f => console.log(`  ✗ ${f}`))
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("FATAL:", e)
  process.exit(1)
})
