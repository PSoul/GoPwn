import path from "node:path"

import { describe, expect, it, vi } from "vitest"

import {
  buildLiveValidationServerEnv,
  buildLiveValidationProjectInput,
  ensureLiveValidationProject,
  ensureWebSurfaceMcpRegistration,
  resolveLiveValidationPrototypeDataDir,
} from "../../scripts/lib/live-validation-runner.mjs"

const labFixture = {
  id: "juice-shop",
  name: "OWASP Juice Shop",
  description: "现代前后端一体化漏洞靶场",
  baseUrl: "http://127.0.0.1:3000",
  healthUrl: "http://127.0.0.1:3000",
  image: "bkimminich/juice-shop",
  ports: ["127.0.0.1:3000->3000"],
  status: "online" as const,
}

describe("live validation runner helpers", () => {
  it("builds a real project payload from the selected local lab", () => {
    const payload = buildLiveValidationProjectInput({
      lab: labFixture,
      startedAt: "2026-03-27T08:00:00.000Z",
    })

    expect(payload.name).toContain("OWASP Juice Shop")
    expect(payload.seed).toBe("http://127.0.0.1:3000")
    expect(payload.targetType).toBe("url")
    expect(payload.scopeSummary).toContain("127.0.0.1:3000->3000")
    expect(payload.deliveryNotes).toContain("2026-03-27T08:00:00.000Z")
  })

  it("uses the workspace store when workspace mode is requested", () => {
    const dataDir = resolveLiveValidationPrototypeDataDir({
      cwd: "D:\\dev\\llmpentest0326",
      runDirectoryName: "2026-03-27T08-00-00-000Z-juice-shop",
      stateMode: "workspace",
    })

    expect(dataDir).toBeNull()
  })

  it("creates an isolated validation store by default", () => {
    const dataDir = resolveLiveValidationPrototypeDataDir({
      cwd: "D:\\dev\\llmpentest0326",
      runDirectoryName: "2026-03-27T08-00-00-000Z-juice-shop",
      stateMode: "isolated",
    })

    expect(dataDir).toBe(
      path.join(
        "D:\\dev\\llmpentest0326",
        "output",
        "live-validation-state",
        "2026-03-27T08-00-00-000Z-juice-shop",
      ),
    )
  })

  it("applies a safer default LLM timeout when live validation boots the Next runtime", () => {
    const env = buildLiveValidationServerEnv({
      baseEnv: {
        LLM_API_KEY: "test-key",
      },
      prototypeDataDir: "D:\\dev\\llmpentest0326\\.prototype-store-live",
    })

    expect(env.NEXT_TELEMETRY_DISABLED).toBe("1")
    expect(env.LLM_TIMEOUT_MS).toBe("300000")
    expect(env.PROTOTYPE_DATA_DIR).toBe("D:\\dev\\llmpentest0326\\.prototype-store-live")
  })

  it("reuses an existing requested project when it is already present", async () => {
    const requestJson = vi.fn(async (url: string) => {
      if (url.endsWith("/api/projects")) {
        return {
          payload: {
            items: [{ id: "proj-existing", name: "Existing Project" }],
          },
        }
      }

      throw new Error(`unexpected request: ${url}`)
    })

    const result = await ensureLiveValidationProject({
      baseUrl: "http://127.0.0.1:3301",
      cookie: "prototype_session=test",
      lab: labFixture,
      requestedProjectId: "proj-existing",
      requestJson,
      startedAt: "2026-03-27T08:00:00.000Z",
    })

    expect(result).toEqual({
      created: false,
      projectId: "proj-existing",
      projectName: "Existing Project",
    })
    expect(requestJson).toHaveBeenCalledTimes(1)
  })

  it("creates a new project when the requested project is missing", async () => {
    const requestJson = vi.fn(async (url: string, options?: { method?: string; body?: unknown }) => {
      if (url.endsWith("/api/projects") && (!options?.method || options.method === "GET")) {
        return {
          payload: {
            items: [],
          },
        }
      }

      if (url.endsWith("/api/projects") && options?.method === "POST") {
        return {
          payload: {
            project: {
              id: "proj-20260327-deadbeef",
              name: "OWASP Juice Shop 本地靶场闭环验证 20260327-080000",
            },
          },
        }
      }

      throw new Error(`unexpected request: ${url}`)
    })

    const result = await ensureLiveValidationProject({
      baseUrl: "http://127.0.0.1:3301",
      cookie: "prototype_session=test",
      lab: labFixture,
      requestedProjectId: "proj-missing",
      requestJson,
      startedAt: "2026-03-27T08:00:00.000Z",
    })

    expect(result).toEqual({
      created: true,
      projectId: "proj-20260327-deadbeef",
      projectName: "OWASP Juice Shop 本地靶场闭环验证 20260327-080000",
    })
    expect(requestJson).toHaveBeenCalledTimes(2)
    expect(requestJson.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
    })
  })

  it("registers the real web-surface MCP server when the store is still empty", async () => {
    const requestJson = vi.fn(async (url: string, options?: { method?: string; body?: unknown }) => {
      if (url.endsWith("/api/settings/mcp-tools")) {
        return {
          payload: {
            servers: [],
            toolContracts: [],
          },
        }
      }

      if (url.endsWith("/api/settings/mcp-servers/register") && options?.method === "POST") {
        const body = options.body as { serverName?: string } | undefined
        return {
          payload: {
            server: {
              id: `mcp-server-${body?.serverName ?? "unknown"}`,
              serverName: body?.serverName ?? "unknown",
            },
          },
        }
      }

      throw new Error(`unexpected request: ${url}`)
    })

    const result = await ensureWebSurfaceMcpRegistration({
      baseUrl: "http://127.0.0.1:3301",
      cookie: "prototype_session=test",
      cwd: "D:\\dev\\llmpentest0326",
      requestJson,
    })

    expect(result).toMatchObject({
      registered: true,
      serverName: "web-surface-stdio",
      serverNames: expect.arrayContaining([
        "web-surface-stdio",
        "http-structure-stdio",
        "http-validation-stdio",
      ]),
    })
    expect(requestJson).toHaveBeenCalledTimes(4)
    expect(requestJson.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: expect.objectContaining({
        serverName: "web-surface-stdio",
        command: "node",
        tools: [expect.objectContaining({ toolName: "web-surface-map" })],
      }),
    })
    expect(requestJson.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
      body: expect.objectContaining({
        serverName: "http-structure-stdio",
      }),
    })
    expect(requestJson.mock.calls[3]?.[1]).toMatchObject({
      method: "POST",
      body: expect.objectContaining({
        serverName: "http-validation-stdio",
        tools: [expect.objectContaining({ toolName: "auth-guard-check" })],
      }),
    })
  })
})
