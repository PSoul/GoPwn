import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET, POST } from "@/app/api/users/route"
import { GET as getUser, PATCH } from "@/app/api/users/[userId]/route"
import { POST as login } from "@/app/api/auth/login/route"
import { generateCaptcha, ensureSeedUsers } from "@/lib/auth/auth-repository"
import { createSessionToken } from "@/lib/auth/auth-session"

function makeRequest(url: string, init?: RequestInit & { cookie?: string }) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.cookie ? { cookie: init.cookie } : {}),
  }
  return new Request(url, { ...init, headers })
}

async function getAdminCookie(): Promise<string> {
  const token = await createSessionToken({
    userId: "test-admin",
    account: "admin@test.local",
    displayName: "Test Admin",
    role: "admin",
  })
  return `prototype_session=${token}`
}

async function getResearcherCookie(): Promise<string> {
  const token = await createSessionToken({
    userId: "test-researcher",
    account: "researcher@test.local",
    displayName: "Test Researcher",
    role: "researcher",
  })
  return `prototype_session=${token}`
}

const ctx = { params: Promise.resolve({}) }

describe("users api routes", () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-users-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
    await ensureSeedUsers()
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("lists seed users after initialization", async () => {
    const cookie = await getAdminCookie()
    const res = await GET(makeRequest("http://localhost/api/users", { cookie }), ctx)
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.items.length).toBeGreaterThanOrEqual(1)
    const researcher = payload.items.find((u: { email: string }) => u.email === "researcher@company.local")
    expect(researcher).toBeDefined()
    // passwordHash should not be exposed
    expect(researcher.passwordHash).toBeUndefined()
  })

  it("admin can create a new user", async () => {
    const cookie = await getAdminCookie()
    const res = await POST(
      makeRequest("http://localhost/api/users", {
        method: "POST",
        cookie,
        body: JSON.stringify({
          email: "newuser@test.local",
          password: "Test@2026!",
          displayName: "New User",
          role: "researcher",
        }),
      }),
      ctx,
    )
    const payload = await res.json()

    expect(res.status).toBe(201)
    expect(payload.user.email).toBe("newuser@test.local")
    expect(payload.user.role).toBe("researcher")
  })

  it("rejects duplicate email on create", async () => {
    const cookie = await getAdminCookie()
    const res = await POST(
      makeRequest("http://localhost/api/users", {
        method: "POST",
        cookie,
        body: JSON.stringify({
          email: "researcher@company.local",
          password: "Test@2026!",
          displayName: "Duplicate",
          role: "researcher",
        }),
      }),
      ctx,
    )

    expect(res.status).toBe(409)
  })

  it("researcher cannot create users", async () => {
    const cookie = await getResearcherCookie()
    const res = await POST(
      makeRequest("http://localhost/api/users", {
        method: "POST",
        cookie,
        body: JSON.stringify({
          email: "hacker@test.local",
          password: "Test@2026!",
          displayName: "Hacker",
          role: "admin",
        }),
      }),
      ctx,
    )

    expect(res.status).toBe(403)
  })

  it("admin can disable and re-enable a user", async () => {
    const cookie = await getAdminCookie()

    // Get user list to find the researcher user id
    const listRes = await GET(makeRequest("http://localhost/api/users", { cookie }), ctx)
    const listPayload = await listRes.json()
    const userId = listPayload.items.find((u: { email: string }) => u.email === "researcher@company.local")?.id

    // Disable
    const disableRes = await PATCH(
      makeRequest(`http://localhost/api/users/${userId}`, {
        method: "PATCH",
        cookie,
        body: JSON.stringify({ status: "disabled" }),
      }),
      { params: Promise.resolve({ userId }) },
    )
    const disablePayload = await disableRes.json()
    expect(disablePayload.user.status).toBe("disabled")

    // Re-enable
    const enableRes = await PATCH(
      makeRequest(`http://localhost/api/users/${userId}`, {
        method: "PATCH",
        cookie,
        body: JSON.stringify({ status: "active" }),
      }),
      { params: Promise.resolve({ userId }) },
    )
    const enablePayload = await enableRes.json()
    expect(enablePayload.user.status).toBe("active")
  })

  it("disabled user cannot login", async () => {
    const adminCookie = await getAdminCookie()

    // Get researcher user
    const listRes = await GET(makeRequest("http://localhost/api/users", { cookie: adminCookie }), ctx)
    const listPayload = await listRes.json()
    const userId = listPayload.items.find((u: { email: string }) => u.email === "researcher@company.local")?.id

    // Disable user
    await PATCH(
      makeRequest(`http://localhost/api/users/${userId}`, {
        method: "PATCH",
        cookie: adminCookie,
        body: JSON.stringify({ status: "disabled" }),
      }),
      { params: Promise.resolve({ userId }) },
    )

    // Try to login as disabled user
    const { captchaId, code } = await generateCaptcha()
    const loginRes = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: "researcher@company.local",
          password: "Prototype@2026",
          captcha: code,
          captchaId,
        }),
      }),
      ctx,
    )

    expect(loginRes.status).toBe(401)
    const payload = await loginRes.json()
    expect(payload.error).toContain("禁用")
  })
})
