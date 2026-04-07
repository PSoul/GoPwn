import { describe, it, expect, vi, beforeEach } from "vitest"

// mock prisma.$executeRawUnsafe — 使用 vi.hoisted 避免变量提升问题
const mockPrisma = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/infra/prisma", () => ({ prisma: mockPrisma }))

import { publishEvent } from "@/lib/infra/event-bus"

describe("event-bus publishEvent", () => {
  beforeEach(() => {
    mockPrisma.$executeRawUnsafe.mockClear()
  })

  it("发布事件 → 调用 pg_notify", async () => {
    await publishEvent({
      type: "status_change",
      projectId: "p1",
      timestamp: new Date().toISOString(),
      data: {},
    })
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(1)
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("pg_notify"),
      expect.stringContaining("status_change"),
    )
  })

  it("超长 payload → 截断为 truncated 标记", async () => {
    const bigData: Record<string, unknown> = { blob: "x".repeat(8000) }
    await publishEvent({
      type: "big",
      projectId: "p1",
      timestamp: new Date().toISOString(),
      data: bigData,
    })
    const sentPayload = mockPrisma.$executeRawUnsafe.mock.calls[0][1] as string
    expect(sentPayload).toContain("truncated")
  })

  it("正常大小 payload → 不截断", async () => {
    await publishEvent({
      type: "small",
      projectId: "p1",
      timestamp: new Date().toISOString(),
      data: { ok: true },
    })
    const sentPayload = mockPrisma.$executeRawUnsafe.mock.calls[0][1] as string
    expect(sentPayload).not.toContain("truncated")
    expect(sentPayload).toContain('"ok":true')
  })
})
