import { afterEach, describe, expect, it } from "vitest"

import {
  abortActiveExecution,
  registerActiveExecution,
  resetActiveExecutionRegistry,
  unregisterActiveExecution,
} from "@/lib/mcp/mcp-execution-runtime"

describe("MCP execution runtime registry", () => {
  afterEach(() => {
    resetActiveExecutionRegistry()
  })

  it("registers and aborts active executions by run id", () => {
    const controller = new AbortController()

    registerActiveExecution("run-1", controller)

    expect(abortActiveExecution("run-1", "研究员请求停止当前运行中的任务。")).toBe(true)
    expect(controller.signal.aborted).toBe(true)
    expect(unregisterActiveExecution("run-1")).toBe(true)
  })

  it("replaces older controllers when the same run id is registered again", () => {
    const first = new AbortController()
    const second = new AbortController()

    registerActiveExecution("run-2", first)
    registerActiveExecution("run-2", second)

    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)
    expect(abortActiveExecution("run-2", "停止")).toBe(true)
    expect(second.signal.aborted).toBe(true)
  })
})
