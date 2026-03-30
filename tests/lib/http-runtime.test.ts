import { describe, expect, it, vi } from "vitest"

import { probeHttpTarget } from "../../scripts/mcp/http-runtime.mjs"

describe("http runtime", () => {
  it("falls back to docker exec when the host target is unavailable", async () => {
    const result = await probeHttpTarget({
      targetUrl: "http://127.0.0.1:18080/WebGoat/login",
      dockerContainerName: "llm-pentest-webgoat",
      internalTargetUrl: "http://127.0.0.1:8080/WebGoat/login",
      adapters: {
        fetch: vi.fn(async () => {
          throw new Error("connect ECONNREFUSED 127.0.0.1:18080")
        }) as typeof fetch,
        execFile: ((_file: string, args: string[], callback: (err: Error | null, result?: { stdout: string; stderr: string }) => void) => {
          expect(args).toContain("llm-pentest-webgoat")
          expect(args).toContain("wget")
          expect(args.join(" ")).toContain("http://127.0.0.1:8080/WebGoat/login")
          callback(null, {
            stdout: [
              "  HTTP/1.1 200 OK",
              "  Server: Apache-Coyote/1.1",
              "  Content-Type: text/html;charset=UTF-8",
              "  Location: http://127.0.0.1:8080/WebGoat/login",
              "",
              "<html><head><title>WebGoat</title></head><body>ok</body></html>",
            ].join("\n"),
            stderr: "",
          })
          return {} as never
        }) as never,
      },
    })

    expect(result.transport).toBe("docker")
    expect(result.webEntry.url).toBe("http://127.0.0.1:18080/WebGoat/login")
    expect(result.webEntry.finalUrl).toBe("http://127.0.0.1:8080/WebGoat/login")
    expect(result.webEntry.title).toBe("WebGoat")
    expect(result.webEntry.headers.some((header: string) => header.includes("Apache-Coyote"))).toBe(true)
  })
})
