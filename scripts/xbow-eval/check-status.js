const BASE = "http://localhost:3003"

async function run() {
  const loginResp = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account: "admin@company.local", password: "Prototype@2026" }),
    redirect: "manual",
  })
  const setCookie = loginResp.headers.getSetCookie?.() ?? []
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ")
  if (!cookie) {
    console.log("Login failed")
    process.exit(1)
  }

  async function api(path, opts) {
    const resp = await fetch(BASE + path, {
      ...opts,
      headers: { "content-type": "application/json", cookie, accept: "application/json", ...(opts?.headers ?? {}) },
    })
    const text = await resp.text()
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  const ids = process.argv.slice(2)
  if (ids.length === 0) {
    console.log("Usage: node check-status.js <projectId1> <projectId2> ...")
    process.exit(1)
  }

  for (const id of ids) {
    const p = await api("/api/projects/" + id)
    console.log(id + ": lifecycle=" + (p?.lifecycle ?? "?") + " phase=" + (p?.currentPhase ?? "?") + " round=" + (p?.currentRound ?? "?"))

    // Auto-approve
    if (p?.lifecycle === "waiting_approval") {
      const data = await api("/api/projects/" + id + "/approvals")
      const approvals = data?.approvals ?? data ?? []
      const pending = Array.isArray(approvals) ? approvals.filter((a) => a.status === "pending") : []
      for (const a of pending) {
        await api("/api/approvals/" + a.id, { method: "POST", body: JSON.stringify({ action: "approve" }) })
        console.log("  [approve] " + a.id)
      }
    }
  }
}

run().catch((e) => console.error(e.message))
