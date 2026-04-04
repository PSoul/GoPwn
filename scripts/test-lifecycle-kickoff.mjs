#!/usr/bin/env node
// Test script: calls the scheduler-control API to trigger lifecycle kickoff
// and polls for results, logging everything.

const BASE = process.env.BASE_URL || "http://127.0.0.1:3001"

async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" }
  if (globalThis._csrf) headers["x-csrf-token"] = globalThis._csrf
  if (globalThis._cookie) headers["Cookie"] = globalThis._cookie

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  // Extract set-cookie
  const setCookie = res.headers.get("set-cookie")
  if (setCookie) {
    const parts = setCookie.split(",").map(s => s.trim())
    for (const part of parts) {
      if (part.startsWith("csrf_token=")) {
        globalThis._csrf = part.split("=")[1].split(";")[0]
      }
      if (part.startsWith("prototype_session=")) {
        globalThis._cookie = (globalThis._cookie || "") + "; " + part.split(";")[0]
      }
    }
    // Also store full cookie line
    if (!globalThis._cookie) {
      globalThis._cookie = parts.map(p => p.split(";")[0]).join("; ")
    }
  }

  const text = await res.text()
  try { return JSON.parse(text) } catch { return { _raw: text.slice(0, 500), _status: res.status } }
}

async function main() {
  console.log("1. Login...")
  const login = await api("POST", "/api/auth/login", {
    account: "admin@company.local",
    password: "Prototype@2026",
  })
  console.log("Login:", login.user?.account || login.error || login._raw)

  console.log("\n2. Create project...")
  const create = await api("POST", "/api/projects", {
    name: "Kickoff Debug Test",
    targetInput: "http://127.0.0.1:8081",
    description: "Testing lifecycle kickoff directly",
  })
  const projectId = create.project?.id
  console.log("ProjectID:", projectId)

  if (!projectId) {
    console.error("Failed to create project:", JSON.stringify(create).slice(0, 500))
    process.exit(1)
  }

  console.log("\n3. Start lifecycle...")
  const start = await api("PATCH", `/api/projects/${projectId}/scheduler-control`, {
    lifecycle: "running",
  })
  console.log("Transition:", start.transition)

  console.log("\n4. Polling every 10s for 3 minutes...")
  const startTime = Date.now()
  while (Date.now() - startTime < 180_000) {
    await new Promise(r => setTimeout(r, 10_000))
    const elapsed = Math.round((Date.now() - startTime) / 1000)

    const proj = await api("GET", `/api/projects/${projectId}`)
    const p = proj.project || {}
    console.log(`[${elapsed}s] Status=${p.status} Stage=${p.stage} Assets=${p.assetCount} Evidence=${p.evidenceCount} Actor=${p.lastActor}`)

    // Check LLM logs
    const llm = await api("GET", `/api/projects/${projectId}/llm-logs`)
    const logs = llm.logs || []
    if (logs.length > 0) {
      console.log(`  LLM logs: ${logs.length}`)
      logs.forEach(l => console.log(`    ${l.purpose} [${l.status}] ${l.model} ${l.durationMs}ms err=${l.error || 'none'}`))
    }

    // Check MCP runs
    const runs = await api("GET", `/api/projects/${projectId}/mcp-runs`)
    const mcpRuns = runs.runs || []
    if (mcpRuns.length > 0) {
      console.log(`  MCP runs: ${mcpRuns.length}`)
      mcpRuns.forEach(r => console.log(`    ${r.toolName} [${r.status}] -> ${r.target}`))
    }

    // Check approvals
    const approvals = await api("GET", "/api/approvals")
    const pending = (approvals.items || []).filter(a => a.status === "待处理" && a.projectId === projectId)
    if (pending.length > 0) {
      console.log(`  Pending approvals: ${pending.length}`)
      for (const a of pending) {
        console.log(`    Auto-approving ${a.id}: ${a.actionType}`)
        await api("PATCH", `/api/approvals/${a.id}`, {
          decision: "已批准",
          reviewer: "auto-test",
          comment: "Auto-approved by test script",
        })
      }
    }

    // Stop if completed
    if (p.status === "已完成" || p.status === "已停止") {
      console.log("\nProject finished!")
      break
    }
  }

  // Final summary
  const final = await api("GET", `/api/projects/${projectId}`)
  const fp = final.project || {}
  console.log("\n=== FINAL RESULTS ===")
  console.log("Status:", fp.status)
  console.log("Stage:", fp.stage)
  console.log("Assets:", fp.assetCount)
  console.log("Evidence:", fp.evidenceCount)
  console.log("Summary:", fp.summary)

  // Check findings
  const results = await api("GET", `/api/projects/${projectId}/results/findings`)
  const findings = results.findings || results.items || []
  console.log("Findings:", findings.length)
  findings.forEach(f => console.log(`  [${f.severity}] ${f.title}`))
}

main().catch(err => {
  console.error("Fatal:", err)
  process.exit(1)
})
