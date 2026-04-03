/**
 * DVWA Pipeline Test Script
 * Tests the artifact normalizer fix by running a full project lifecycle against DVWA.
 */
import http from "node:http"

const COOKIE = process.env.COOKIE
const CSRF = process.env.CSRF
const BASE = "http://localhost:3001"

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined
    const req = http.request(new URL(path, BASE), {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: COOKIE,
        "x-csrf-token": CSRF,
      },
    }, (res) => {
      let buf = ""
      res.on("data", (c) => (buf += c))
      res.on("end", () => {
        try { resolve(JSON.parse(buf)) } catch { resolve(buf) }
      })
    })
    req.on("error", reject)
    if (data) req.write(data)
    req.end()
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function approveAll(projectId) {
  const res = await api("GET", "/api/approvals")
  const pending = (res.items || res.approvals || []).filter(
    (a) => a.status === "待处理" && a.projectId === projectId,
  )
  console.log(`  Pending approvals for project: ${pending.length}`)
  for (const a of pending) {
    console.log(`  Approving: ${a.id} — ${(a.actionType || "").slice(0, 80)}`)
    await api("PATCH", `/api/approvals/${a.id}`, { decision: "已批准" })
  }
  return pending.length
}

async function checkStatus(projectId) {
  const ops = await api("GET", `/api/projects/${projectId}/operations`)
  const tasks = ops.schedulerTasks || []
  const byStatus = {}
  tasks.forEach((t) => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1
  })
  return {
    lifecycle: ops.schedulerControl?.lifecycle,
    round: ops.schedulerControl?.currentRound,
    note: ops.schedulerControl?.note,
    taskCounts: byStatus,
    totalTasks: tasks.length,
  }
}

async function getFindings(projectId) {
  const res = await api("GET", `/api/projects/${projectId}/results/findings`)
  return res.items || res.findings || []
}

async function getMcpRuns(projectId) {
  const res = await api("GET", `/api/projects/${projectId}/mcp-runs`)
  return res.items || res.runs || []
}

async function main() {
  console.log("=== DVWA Pipeline Test ===\n")

  // Create project
  console.log("1. Creating project...")
  const createRes = await api("POST", "/api/projects", {
    name: "DVWA Pipeline Fix v3",
    targetInput: "http://localhost:8081",
    description: "Test artifact normalizer pipeline fix for execute_code stdout extraction",
  })
  const projectId = createRes.project?.id
  console.log(`   Project ID: ${projectId}\n`)

  // Start project
  console.log("2. Starting project...")
  await api("PATCH", `/api/projects/${projectId}/scheduler-control`, { lifecycle: "running" })
  console.log("   Started!\n")

  // Wait and poll
  const maxWaitMinutes = 15
  const pollIntervalSec = 30
  const maxPolls = (maxWaitMinutes * 60) / pollIntervalSec

  for (let i = 0; i < maxPolls; i++) {
    await sleep(pollIntervalSec * 1000)

    const status = await checkStatus(projectId)
    console.log(`[${new Date().toLocaleTimeString()}] Round ${status.round} | ${status.lifecycle} | Tasks: ${JSON.stringify(status.taskCounts)}`)

    // Approve any pending
    const approved = await approveAll(projectId)
    if (approved > 0) {
      console.log(`  Approved ${approved} tasks`)
    }

    // Check if lifecycle is done
    if (status.lifecycle === "completed" || status.lifecycle === "idle") {
      console.log("\nProject lifecycle completed!")
      break
    }

    // If all tasks are completed and no pending approvals, check if there's a next round
    const allCompleted = Object.keys(status.taskCounts).every(
      (k) => k === "completed" || k === "cancelled" || k === "failed",
    )
    if (allCompleted && status.totalTasks > 0 && approved === 0) {
      console.log("  All tasks completed, waiting for next round...")
    }
  }

  // Final results
  console.log("\n=== Final Results ===\n")

  const findings = await getFindings(projectId)
  console.log(`Findings: ${findings.length}`)
  findings.forEach((f) => {
    console.log(`  [${f.severity}] ${f.title}`)
    console.log(`    Surface: ${f.affectedSurface}`)
    console.log(`    Summary: ${(f.summary || "").slice(0, 120)}`)
  })

  const runs = await getMcpRuns(projectId)
  const codeRuns = runs.filter((r) => r.toolName === "execute_code")
  console.log(`\nexecute_code runs: ${codeRuns.length}`)
  codeRuns.forEach((r) => {
    const ro = r.rawOutput || []
    console.log(`  ${r.status} | rawOutput lines: ${ro.length} | preview: ${(ro[0] || "(empty)").slice(0, 100)}`)
  })

  console.log(`\nAll MCP runs: ${runs.length}`)
  runs.forEach((r) => {
    console.log(`  ${r.status.padEnd(8)} | ${r.toolName.padEnd(20)} | ${r.target}`)
  })
}

main().catch(console.error)
