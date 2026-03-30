import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { POST as login } from "@/app/api/auth/login/route"
import { POST as logout } from "@/app/api/auth/logout/route"
import { GET as getAuditLogs } from "@/app/api/settings/audit-logs/route"
import { generateCaptcha } from "@/lib/auth-repository"

describe("auth api routes", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-auth-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("logs in with the seeded researcher account and sets a session cookie", async () => {
    const { captchaId, code } = await generateCaptcha()

    const response = await login(
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
      { params: Promise.resolve({}) },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.user.displayName).toBe("研究员席位 A")
    expect(response.headers.get("set-cookie")).toContain("prototype_session=")
  })

  it("rejects invalid login credentials", async () => {
    const { captchaId, code } = await generateCaptcha()

    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: "researcher@company.local",
          password: "wrong-password",
          captcha: code,
          captchaId,
        }),
      }),
      { params: Promise.resolve({}) },
    )
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toContain("账号")
  })

  it("rejects invalid captcha", async () => {
    const { captchaId } = await generateCaptcha()

    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: "researcher@company.local",
          password: "Prototype@2026",
          captcha: "XXXX",
          captchaId,
        }),
      }),
      { params: Promise.resolve({}) },
    )
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toContain("验证码")
  })

  it("writes login and logout actions into the audit log", async () => {
    const { captchaId, code } = await generateCaptcha()

    const loginResponse = await login(
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
      { params: Promise.resolve({}) },
    )

    const sessionCookie = loginResponse.headers.get("set-cookie")

    expect(sessionCookie).toBeTruthy()

    const logoutResponse = await logout(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: sessionCookie ?? "",
        },
      }),
      { params: Promise.resolve({}) },
    )

    expect(logoutResponse.status).toBe(200)

    const auditResponse = await getAuditLogs(
      new Request("http://localhost/api/settings/audit-logs"),
      { params: Promise.resolve({}) },
    )
    const auditPayload = await auditResponse.json()

    expect(auditPayload.items.some((log: { summary: string }) => log.summary.includes("登录平台"))).toBe(true)
    expect(auditPayload.items.some((log: { summary: string }) => log.summary.includes("退出登录"))).toBe(true)
  })
})
