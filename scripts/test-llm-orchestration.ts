/**
 * Test LLM orchestration: generate a plan using real LLM, then execute it against Docker targets
 */
import { discoverAndRegisterMcpServers } from "@/lib/mcp-auto-discovery"
import { resolveLlmProvider, getConfiguredLlmProviderStatus } from "@/lib/llm-provider/registry"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"
import { createStoredProject } from "@/lib/project-repository"
import { runProjectLifecycleKickoff } from "@/lib/orchestrator-service"
import { listStoredAssets } from "@/lib/asset-repository"
import { listStoredEvidence } from "@/lib/evidence-repository"
import { listStoredProjectFindings } from "@/lib/project-results-repository"

async function main() {
  console.log("=== Step 1: Setup ===")

  // Auto-discover MCP servers
  const discovery = await discoverAndRegisterMcpServers()
  console.log(`MCP servers: ${discovery.registered} registered`)

  // Check LLM provider
  const providerStatus = await getConfiguredLlmProviderStatus()
  console.log(`LLM provider: ${providerStatus.provider} / enabled=${providerStatus.enabled} / model=${providerStatus.orchestratorModel}`)

  const provider = await resolveLlmProvider()
  if (!provider) {
    console.log("WARNING: No LLM provider configured, will use fallback plan")
  } else {
    console.log("LLM provider resolved successfully")
  }

  console.log("\n=== Step 2: Create test project ===")
  const { project } = await createStoredProject({
    name: "DVWA 靶场渗透测试",
    targetInput: "http://localhost:8081",
    description: "对本地 DVWA 漏洞靶场进行自动化渗透测试",
  })
  console.log(`Project created: ${project.id} / ${project.name}`)

  // Enable autoReplan
  const store = readPrototypeStore()
  if (store.projectSchedulerControls[project.id]) {
    store.projectSchedulerControls[project.id].autoReplan = true
    store.projectSchedulerControls[project.id].maxRounds = 3
    writePrototypeStore(store)
  }

  // Disable global approval control for automated testing
  const store2 = readPrototypeStore()
  store2.globalApprovalControl = {
    ...store2.globalApprovalControl,
    enabled: false,
  }
  writePrototypeStore(store2)
  console.log("Global approval control disabled for automated testing")

  console.log("\n=== Step 3: Run lifecycle kickoff ===")
  console.log("Starting orchestration (this may take a while)...")

  const startTime = Date.now()
  const result = await runProjectLifecycleKickoff(project.id, {
    controlCommand: "start",
    note: "首次自动化渗透测试",
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nOrchestration completed in ${elapsed}s`)

  if (!result) {
    console.error("Orchestration returned null!")
    process.exit(1)
  }

  console.log(`Plan items: ${result.plan?.items?.length ?? 0}`)
  console.log(`Runs: ${result.runs?.length ?? 0}`)
  console.log(`Status: ${result.status}`)
  if (result.plan?.summary) {
    console.log(`Summary: ${result.plan.summary}`)
  }

  console.log("\n=== Step 4: Check results ===")
  const assets = await listStoredAssets(project.id)
  const evidence = await listStoredEvidence(project.id)
  const findings = await listStoredProjectFindings(project.id)

  console.log(`Assets: ${assets.length}`)
  for (const a of assets.slice(0, 10)) {
    console.log(`  - [${a.type}] ${a.label} / ${a.profile}`)
  }

  console.log(`Evidence: ${evidence.length}`)
  for (const e of evidence.slice(0, 5)) {
    console.log(`  - ${e.title} / ${e.conclusion}`)
  }

  console.log(`Findings: ${findings.length}`)
  for (const f of findings) {
    console.log(`  - [${f.severity}] ${f.title} / ${f.status}`)
  }

  // Check rounds
  const finalStore = readPrototypeStore()
  const rounds = finalStore.orchestratorRounds[project.id] ?? []
  console.log(`\nRounds completed: ${rounds.length}`)
  for (const r of rounds) {
    console.log(`  Round ${r.round}: ${r.executedCount} actions, +${r.newAssetCount} assets, +${r.newFindingCount} findings`)
  }

  // Check runs
  const runs = finalStore.mcpRuns.filter(r => r.projectId === project.id)
  console.log(`\nMCP Runs: ${runs.length}`)
  for (const r of runs) {
    console.log(`  - ${r.toolName}(${r.target}) → ${r.status} [${r.dispatchMode}]`)
    if (r.summaryLines.length > 0) {
      console.log(`    ${r.summaryLines[0]}`)
    }
  }

  console.log("\n=== Test complete ===")
}

main().catch(e => {
  console.error("Fatal:", e.message)
  console.error(e.stack)
  process.exit(1)
})
