import { describe, it, expect, vi, beforeEach } from "vitest"
import { EventEmitter } from "events"

// mock pg.Client
class MockPgClient extends EventEmitter {
  connect = vi.fn().mockResolvedValue(undefined)
  query = vi.fn().mockResolvedValue(undefined)
  end = vi.fn().mockResolvedValue(undefined)
}

let mockClient: MockPgClient

vi.mock("pg", () => {
  return {
    default: {
      Client: class {
        constructor() {
          return mockClient
        }
      },
    },
  }
})

import { createPgListener } from "@/lib/infra/pg-listener"

describe("pg-listener", () => {
  beforeEach(() => {
    mockClient = new MockPgClient()
  })

  it("创建 listener → 执行 LISTEN 命令", async () => {
    const cb = vi.fn()
    await createPgListener("project_events", cb)
    expect(mockClient.connect).toHaveBeenCalledTimes(1)
    expect(mockClient.query).toHaveBeenCalledWith('LISTEN "project_events"')
  })

  it("收到 notification → 调用 callback", async () => {
    const cb = vi.fn()
    await createPgListener("project_events", cb)
    mockClient.emit("notification", {
      channel: "project_events",
      payload: '{"type":"test"}',
    })
    expect(cb).toHaveBeenCalledWith('{"type":"test"}')
  })

  it("不匹配 channel 的 notification → 不调用 callback", async () => {
    const cb = vi.fn()
    await createPgListener("project_events", cb)
    mockClient.emit("notification", {
      channel: "other_channel",
      payload: '{"type":"other"}',
    })
    expect(cb).not.toHaveBeenCalled()
  })

  it("非法 channel 名 → throw", async () => {
    await expect(
      createPgListener("bad;channel", vi.fn()),
    ).rejects.toThrow("Invalid channel")
  })

  it("close → 执行 UNLISTEN + end", async () => {
    const cb = vi.fn()
    const listener = await createPgListener("project_events", cb)
    await listener.close()
    expect(mockClient.query).toHaveBeenCalledWith(
      'UNLISTEN "project_events"',
    )
    expect(mockClient.end).toHaveBeenCalled()
  })
})
