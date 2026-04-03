import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getLocalLabById,
  resetLocalLabCatalogTestAdapters,
  setLocalLabCatalogTestAdapters,
} from "@/lib/infra/local-lab-catalog"

describe("local lab catalog", () => {
  const originalWebGoatHostPort = process.env.WEBGOAT_HOST_PORT

  beforeEach(() => {
    process.env.WEBGOAT_HOST_PORT = "18080"
  })

  afterEach(() => {
    resetLocalLabCatalogTestAdapters()

    if (originalWebGoatHostPort === undefined) {
      delete process.env.WEBGOAT_HOST_PORT
    } else {
      process.env.WEBGOAT_HOST_PORT = originalWebGoatHostPort
    }
  })

  it("uses WEBGOAT_HOST_PORT for the seeded WebGoat host urls", async () => {
    const webgoat = await getLocalLabById("webgoat")

    expect(webgoat?.baseUrl).toBe("http://127.0.0.1:18080/WebGoat")
    expect(webgoat?.healthUrl).toBe("http://127.0.0.1:18080/WebGoat/actuator/health")
    expect(webgoat?.effectiveHostPort).toBe(18080)
    expect(webgoat?.statusNote).toContain("18080")
  })

  it("marks WebGoat as online through container-only availability when the host probe fails", async () => {
    setLocalLabCatalogTestAdapters({
      fetch: vi.fn(async (input: string | URL | Request) => {
        const url = String(input)

        if (url.includes("127.0.0.1:3000")) {
          return new Response("", { status: 200 })
        }

        throw new Error(`connect ECONNREFUSED ${url}`)
      }) as typeof fetch,
      execFile: ((_file: string, args: string[], callback: (err: Error | null, result?: { stdout: string; stderr: string }) => void) => {
        const joinedArgs = args.join(" ")

        if (joinedArgs.includes("llm-pentest-webgoat") && joinedArgs.includes("/WebGoat/actuator/health")) {
          callback(null, { stdout: '{"status":"UP"}', stderr: "" })
          return {} as never
        }

        callback(new Error(`unexpected docker exec: ${joinedArgs}`))
        return {} as never
      }) as never,
    })

    const webgoat = await getLocalLabById("webgoat", { probe: true })

    expect(webgoat?.status).toBe("online")
    expect(webgoat?.availability).toBe("container")
    expect(webgoat?.statusNote).toContain("18080")
    expect(webgoat?.statusNote).toContain("容器内")
  })

  it("marks WebGoat as offline when both host and container probes fail", async () => {
    setLocalLabCatalogTestAdapters({
      fetch: vi.fn(async (input: string | URL | Request) => {
        const url = String(input)

        if (url.includes("127.0.0.1:3000")) {
          return new Response("", { status: 200 })
        }

        throw new Error(`connect ECONNREFUSED ${url}`)
      }) as typeof fetch,
      execFile: ((_file: string, _args: string[], callback: (err: Error | null) => void) => {
        callback(new Error("docker exec failed"))
        return {} as never
      }) as never,
    })

    const webgoat = await getLocalLabById("webgoat", { probe: true })

    expect(webgoat?.status).toBe("offline")
    expect(webgoat?.availability).toBe("none")
    expect(webgoat?.statusNote).toContain("18080")
  })
})
