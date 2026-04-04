#!/usr/bin/env node
// Auto-approve and monitor a project until completion

const BASE = "http://127.0.0.1:3001"
const PROJECT_ID = process.argv[2] || "proj-20260403-af8b6aa2"

let csrf = ""
let cookie = ""

async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" }
  if (csrf) headers["x-csrf-token"] = csrf
  if (cookie) headers["Cookie"] = cookie

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const sc = res.headers.getSetCookie?.() || []
  for (const c of sc) {
    if (c.startsWith("csrf_token=")) csrf = c.split("=")[1].split(";")[0]
    if (c.startsWith("prototype_session=")) cookie = c.split(";")[0]
  }

  try { return await res.json() } catch { return {} }
}

async function main() {
  // Login
  await api("POST", "/api/auth/login", {
    account: "admin@company.local",
    password: "Prototype@2026",
  })
  console.log("Logged in. Monitoring", PROJECT_ID)

  let lastRunCount = 0
  for (let i = 0; i < 60; i++) { // 30 minutes max
    await new Promise(r => setTimeout(r, 30000))
    const elapsed = (i + 1) * 30

    // Project status
    const proj = await api("GET", `/api/projects/${PROJECT_ID}`)
    const p = proj.project || {}
    console.log(`\n[${elapsed}s] Status=${p.status} Stage=${p.stage} Assets=${p.assetCount} Evidence=${p.evidenceCount}`)
    console.log(`  Actor: ${p.lastActor?.slice(0, 80)}`)

    // MCP runs
    const runs = await api("GET", `/api/projects/${PROJECT_ID}/mcp-runs`)
    const mcpRuns = runs.runs || []
    if (mcpRuns.length !== lastRunCount) {
      console.log(`  Runs: ${mcpRuns.length}`)
      mcpRuns.forEach(r => console.log(`    ${r.toolName} [${r.status}] -> ${r.target?.slice(0, 40)}`))
      lastRunCount = mcpRuns.length
    }

    // Auto-approve
    const approvals = await api("GET", "/api/approvals")
    const pending = (approvals.items || []).filter(a => a.status === "待处理" && a.projectId === PROJECT_ID)
    for (const a of pending) {
      console.log(`  AUTO-APPROVE: ${a.id} - ${a.actionType?.slice(0, 80)}`)
      await api("PATCH", `/api/approvals/${a.id}`, { decision: "已批准" })
    }

    // Check findings
    const findings = await api("GET", `/api/projects/${PROJECT_ID}/results/findings`)
    const fItems = findings.findings || findings.items || []
    if (fItems.length > 0) {
      console.log(`  FINDINGS: ${fItems.length}`)
      fItems.forEach(f => console.log(`    [${f.severity}] ${f.title}`))
    }

    if (p.status === "已完成" || p.status === "已停止") {
      console.log("\n=== PROJECT FINISHED ===")
      console.log("Status:", p.status)
      console.log("Assets:", p.assetCount)
      console.log("Evidence:", p.evidenceCount)
      console.log("Summary:", p.summary)
      console.log("Findings:", fItems.length)
      fItems.forEach(f => console.log(`  [${f.severity}] ${f.title}: ${f.description?.slice(0, 100)}`))
      break
    }
  }
}

main().catch(console.error)
