/**
 * Integration test: verify execute_code stdout extraction pipeline
 * Tests that LLM-generated POC script results flow through to findings/evidence.
 */
import http from "node:http"

const BASE = "http://localhost:3001"

function request(method, path, body, cookie, csrf) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined
    const url = new URL(path, BASE)
    const req = http.request(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { "x-csrf-token": csrf } : {}),
      },
    }, (res) => {
      const setCookies = res.headers["set-cookie"] ?? []
      let buf = ""
      res.on("data", (c) => (buf += c))
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf), cookies: setCookies }) }
        catch { resolve({ status: res.statusCode, body: buf, cookies: setCookies }) }
      })
    })
    req.on("error", reject)
    if (data) req.write(data)
    req.end()
  })
}

async function main() {
  console.log("=== Pipeline Fix Integration Test ===\n")

  // Step 1: Login
  console.log("[1] Logging in...")
  const loginRes = await request("POST", "/api/auth/login", {
    account: "admin@company.local",
    password: "Prototype@2026",
  })
  if (loginRes.status !== 200) {
    console.error("Login failed:", loginRes.status, loginRes.body)
    process.exit(1)
  }
  const cookie = loginRes.cookies.map(c => c.split(";")[0]).join("; ")
  // Extract CSRF from cookies (not body)
  const csrfCookie = loginRes.cookies.find(c => c.startsWith("csrf_token="))
  const csrf = csrfCookie ? csrfCookie.split(";")[0].split("=")[1] : loginRes.body.csrfToken
  console.log("  Login OK, csrf:", csrf?.slice(0, 10) + "...")

  // Step 2: Create project targeting DVWA
  console.log("\n[2] Creating test project...")
  const projRes = await request("POST", "/api/projects", {
    name: "Pipeline-Fix-Test-" + Date.now(),
    targetInput: "http://localhost:8081",
    description: "Integration test for execute_code pipeline fix",
  }, cookie, csrf)
  const projectId = projRes.body?.project?.id ?? projRes.body?.detail?.projectId ?? projRes.body?.id
  if (!projectId) {
    console.error("Failed to create project:", JSON.stringify(projRes.body).slice(0, 200))
    process.exit(1)
  }
  console.log("  Project created:", projectId)

  // Step 3: Start the project
  console.log("\n[3] Starting project...")
  const startRes = await request("PATCH", `/api/projects/${projectId}/scheduler-control`, {
    lifecycle: "running",
  }, cookie, csrf)
  console.log("  Start result:", startRes.body?.lifecycle ?? startRes.body)

  // Step 4: Wait and poll, auto-approve approvals
  console.log("\n[4] Waiting for execution (polling every 15s, max 5min)...")
  const maxWait = 5 * 60 * 1000
  const interval = 15000
  let elapsed = 0

  while (elapsed < maxWait) {
    await new Promise(r => setTimeout(r, interval))
    elapsed += interval
    const mins = (elapsed / 1000 / 60).toFixed(1)

    // Check for pending approvals
    const appRes = await request("GET", `/api/approvals?projectId=${projectId}`, null, cookie, csrf)
    if (Array.isArray(appRes.body)) {
      const pending = appRes.body.filter(a => a.status === "待审批")
      for (const approval of pending) {
        console.log(`  [${mins}m] Auto-approving: ${approval.action}`)
        await request("PATCH", `/api/approvals/${approval.id}`, {
          decision: "已批准",
        }, cookie, csrf)
      }
    }

    // Check operations status
    const opsRes = await request("GET", `/api/projects/${projectId}/mcp-runs`, null, cookie, csrf)
    const runs = Array.isArray(opsRes.body) ? opsRes.body : []
    const completed = runs.filter(r => r.status === "已执行" || r.status === "失败")
    const running = runs.filter(r => r.status === "执行中")
    console.log(`  [${mins}m] Runs: ${runs.length} total, ${completed.length} done, ${running.length} running`)

    // Check execute_code runs specifically
    const executeCodeRuns = runs.filter(r => r.toolName === "execute_code" || r.toolName === "execute_command")
    if (executeCodeRuns.length > 0) {
      console.log(`  [${mins}m] execute_code/command runs: ${executeCodeRuns.length}`)
      for (const r of executeCodeRuns) {
        console.log(`    - ${r.id.slice(0, 8)}: ${r.status} | ${r.requestedAction?.slice(0, 60)}`)
      }
    }

    // Check findings
    const findRes = await request("GET", `/api/projects/${projectId}/results/findings`, null, cookie, csrf)
    const findings = Array.isArray(findRes.body) ? findRes.body : []
    if (findings.length > 0) {
      console.log(`  [${mins}m] Findings: ${findings.length}`)
      for (const f of findings) {
        console.log(`    - [${f.severity}] ${f.title} (owner: ${f.owner})`)
      }
    }

    // Check evidence
    const evRes = await request("GET", `/api/evidence?projectId=${projectId}`, null, cookie, csrf)
    const evidence = Array.isArray(evRes.body) ? evRes.body : []
    const scriptEvidence = evidence.filter(e => e.source?.includes("execute") || e.title?.includes("execute"))
    if (scriptEvidence.length > 0) {
      console.log(`  [${mins}m] execute_code Evidence: ${scriptEvidence.length}`)
      for (const e of scriptEvidence) {
        console.log(`    - ${e.title} | rawOutput: ${e.rawOutput?.length ?? 0} lines`)
      }
    }

    // Stop after all runs completed and no running
    if (completed.length > 0 && running.length === 0 && elapsed > 60000) {
      console.log(`  [${mins}m] All runs completed, stopping poll.`)
      break
    }
  }

  // Step 5: Final report
  console.log("\n\n=== FINAL REPORT ===\n")

  const opsRes = await request("GET", `/api/projects/${projectId}/mcp-runs`, null, cookie, csrf)
  const runs = Array.isArray(opsRes.body) ? opsRes.body : []
  console.log(`Total operations: ${runs.length}`)
  for (const r of runs) {
    console.log(`  [${r.status}] ${r.toolName} → ${r.requestedAction?.slice(0, 80)}`)
  }

  const findRes = await request("GET", `/api/projects/${projectId}/results/findings`, null, cookie, csrf)
  const findings = Array.isArray(findRes.body) ? findRes.body : []
  console.log(`\nTotal findings: ${findings.length}`)
  for (const f of findings) {
    console.log(`  [${f.severity}] ${f.title}`)
    console.log(`    Owner: ${f.owner} | Surface: ${f.affectedSurface}`)
  }

  const evRes = await request("GET", `/api/evidence?projectId=${projectId}`, null, cookie, csrf)
  const evidence = Array.isArray(evRes.body) ? evRes.body : []
  console.log(`\nTotal evidence: ${evidence.length}`)
  for (const e of evidence) {
    console.log(`  - ${e.title} (source: ${e.source})`)
    if (e.rawOutput?.length > 0) {
      console.log(`    rawOutput[0]: ${JSON.stringify(e.rawOutput[0]).slice(0, 120)}...`)
    }
  }

  // Check for execute_code evidence specifically
  const executeEvidence = evidence.filter(e =>
    e.title?.includes("execute_code") || e.title?.includes("execute_command") ||
    e.source?.includes("execute")
  )
  console.log(`\nexecute_code evidence count: ${executeEvidence.length}`)

  if (executeEvidence.length > 0) {
    console.log("\n✅ PIPELINE FIX VERIFIED: execute_code results are flowing into evidence")
  } else if (runs.some(r => r.toolName === "execute_code" && r.status === "已执行")) {
    console.log("\n❌ PIPELINE STILL BROKEN: execute_code ran but produced no evidence")
  } else {
    console.log("\n⚠️  No execute_code runs observed (LLM may not have generated scripts)")
  }

  // Cleanup: stop project
  await request("PATCH", `/api/projects/${projectId}/scheduler-control`, {
    lifecycle: "stopped",
  }, cookie, csrf)
  console.log("\nProject stopped.")
}

main().catch(console.error)
