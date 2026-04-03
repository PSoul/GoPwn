import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET as getArtifact } from "@/app/api/artifacts/[...artifactPath]/route"
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth/auth-session"

const buildArtifactContext = (artifactPath: string[]) => ({
  params: Promise.resolve({ artifactPath } as any),
})

describe("artifact api route", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-artifact-api-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("streams runtime artifacts for authenticated sessions", async () => {
    const relativePath = ["proj-test", "run-test", "page.html"]
    const artifactPath = path.join(tempDir, "artifacts", ...relativePath)

    mkdirSync(path.dirname(artifactPath), { recursive: true })
    writeFileSync(artifactPath, "<html><body>fixture</body></html>", "utf8")

    const session = await createSessionToken({
      userId: "researcher-1",
      account: "researcher@company.local",
      displayName: "研究员席位",
      role: "researcher",
    })
    const response = await getArtifact(
      new Request(`http://localhost/api/artifacts/${relativePath.join("/")}`, {
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${session}`,
        },
      }),
      buildArtifactContext(relativePath),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(await response.text()).toContain("fixture")
  })

  it("rejects unauthenticated artifact access", async () => {
    const response = await getArtifact(
      new Request("http://localhost/api/artifacts/proj-test/run-test/page.png"),
      buildArtifactContext(["proj-test", "run-test", "page.png"]),
    )
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toContain("Unauthorized")
  })
})
