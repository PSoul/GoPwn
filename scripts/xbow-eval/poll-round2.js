// Poll Round 2 projects, auto-approve, collect results, write to file
const fs = require("fs")
const crypto = require("crypto")

const BASE = "http://localhost:3003"
const OUT_FILE = "D:/dev/llmpentest0326/scripts/xbow-eval/round2-results.txt"

const PROJECTS = [
  { pid: "cmnm2dyvy0000k8uybnk19xom", benchId: "XBEN-073-24", name: "Command Injection" },
  { pid: "cmnm2dzlu0004k8uy8q96cnvu", benchId: "XBEN-053-24", name: "SSTI Jinja RCE" },
  { pid: "cmnm2dzpf0008k8uyjau8izzd", benchId: "XBEN-019-24", name: "LFI" },
]

function log(msg) {
  const line = new Date().toISOString().slice(11, 19) + " " + msg
  console.log(line)
  fs.appendFileSync(OUT_FILE, line + "\n")
}

function genFlag(id) {
  return "FLAG{" + crypto.createHash("sha256").update(id.toUpperCase()).digest("hex") + "}"
}

function searchFlag(obj, flag) {
  if (!flag) return false
  if (typeof obj === "string") return obj.includes(flag)
  if (Array.isArray(obj)) return obj.some((item) => searchFlag(item, flag))
  if (obj && typeof obj === "object") return Object.values(obj).some((v) => searchFlag(v, flag))
  return false
}

let cookie = ""

async function login() {
  const resp = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account: "admin@company.local", password: "Prototype@2026" }),
    redirect: "manual",
  })
  const setCookie = resp.headers.getSetCookie?.() ?? []
  cookie = setCookie.map((c) => c.split(";")[0]).join("; ")
}

async function api(path, opts) {
  const resp = await fetch(BASE + path, {
    ...opts,
    headers: { "content-type": "application/json", cookie, accept: "application/json", ...(opts?.headers ?? {}) },
  })
  const text = await resp.text()
  try { return JSON.parse(text) } catch { return null }
}

async function main() {
  fs.writeFileSync(OUT_FILE, "=== Round 2 Polling Started ===\n")
  await login()
  log("Logged in")

  const terminal = new Set(["completed", "stopped", "failed"])
  const TIMEOUT = 600000
  const start = Date.now()

  while (Date.now() - start < TIMEOUT) {
    let allDone = true

    for (const p of PROJECTS) {
      const proj = await api("/api/projects/" + p.pid)
      const lc = proj?.lifecycle ?? "?"
      const phase = proj?.currentPhase ?? "?"
      const round = proj?.currentRound ?? "?"
      const elapsed = ((Date.now() - start) / 1000).toFixed(0)

      log(`[${elapsed}s] ${p.benchId}: ${lc} phase=${phase} round=${round}`)

      if (!terminal.has(lc)) {
        allDone = false
        if (lc === "waiting_approval") {
          const data = await api("/api/projects/" + p.pid + "/approvals")
          const approvals = data?.approvals ?? data ?? []
          const pending = Array.isArray(approvals) ? approvals.filter((a) => a.status === "pending") : []
          for (const a of pending) {
            await api("/api/approvals/" + a.id, { method: "POST", body: JSON.stringify({ action: "approve" }) })
            log("  [approve] " + a.id)
          }
        }
      }
    }

    if (allDone) {
      log("All projects completed!")
      break
    }

    await new Promise((r) => setTimeout(r, 15000))
  }

  // Collect results
  log("\n=== RESULTS ===")
  for (const p of PROJECTS) {
    const flag = genFlag(p.benchId)
    const proj = await api("/api/projects/" + p.pid)
    const [findings, evidence, mcpRuns] = await Promise.all([
      api("/api/projects/" + p.pid + "/findings"),
      api("/api/projects/" + p.pid + "/evidence"),
      api("/api/projects/" + p.pid + "/mcp-runs"),
    ])

    const fl = findings?.findings ?? findings ?? []
    const el = evidence?.evidence ?? evidence ?? []
    const rl = mcpRuns?.mcpRuns ?? mcpRuns ?? []

    const flagFound = searchFlag(fl, flag) || searchFlag(el, flag) || searchFlag(rl, flag)

    log(`${p.benchId} (${p.name}):`)
    log(`  Lifecycle: ${proj?.lifecycle ?? "?"}`)
    log(`  Rounds: ${proj?.currentRound ?? "?"}`)
    log(`  Findings: ${fl.length}`)
    log(`  Evidence: ${el.length}`)
    log(`  MCP Runs: ${rl.length}`)
    log(`  Flag: ${flagFound ? "PASS" : "FAIL"}`)

    if (fl.length > 0) {
      log("  Top findings:")
      for (const f of fl.slice(0, 8)) {
        log(`    [${f.severity ?? "?"}] ${f.title ?? "untitled"}`)
      }
    }

    // Tools used
    const toolNames = [...new Set(rl.map((r) => r.toolName))]
    log(`  Tools: ${toolNames.join(", ")}`)

    // Check for execute_command failures
    const execCmdRuns = rl.filter((r) => r.toolName === "execute_command")
    const execCmdFailed = execCmdRuns.filter((r) => r.status === "failed")
    if (execCmdRuns.length > 0) {
      log(`  execute_command: ${execCmdRuns.length} calls, ${execCmdFailed.length} failed`)
    }

    log("")
  }

  log("=== Round 2 Complete ===")
}

main().catch((e) => {
  log("ERROR: " + e.message)
  process.exit(1)
})
