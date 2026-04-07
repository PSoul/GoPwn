/**
 * 集成测试：projects lifecycle 路由 (start / stop)
 *
 * 覆盖：POST /api/projects/[projectId]/start, POST /api/projects/[projectId]/stop
 * 策略：mock service 层，由 mock 决定 resolve 或 throw DomainError
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { NextRequest } from "next/server"
import { routeCtx } from "../../helpers/route-test-utils"
import { NotFoundError, InvalidTransitionError } from "@/lib/domain/errors"

// ─── Mock service 层 ────────────────────────────────────

vi.mock("@/lib/services/project-service", () => ({
  startProject: vi.fn(),
  stopProject: vi.fn(),
}))

import { startProject, stopProject } from "@/lib/services/project-service"

// ─── Import route handlers ─────────────────────────────

import { POST as startHandler } from "@/app/api/projects/[projectId]/start/route"
import { POST as stopHandler } from "@/app/api/projects/[projectId]/stop/route"

// ─── Reset ─────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Helpers ────────────────────────────────────────────

function postReq(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"), { method: "POST" })
}

// ─── Tests: POST /api/projects/[projectId]/start ────────

describe("POST /api/projects/[projectId]/start", () => {
  it("planning 状态启动 -> 202 + lifecycle 变更", async () => {
    ;(startProject as Mock).mockResolvedValueOnce({ lifecycle: "react_running" })

    const res = await startHandler(
      postReq("/api/projects/p1/start"),
      routeCtx({ projectId: "p1" }),
    )
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.lifecycle).toBe("react_running")
    expect(startProject).toHaveBeenCalledWith("p1")
  })

  it("failed 状态重试启动 -> 202", async () => {
    ;(startProject as Mock).mockResolvedValueOnce({ lifecycle: "react_running" })

    const res = await startHandler(
      postReq("/api/projects/p2/start"),
      routeCtx({ projectId: "p2" }),
    )
    expect(res.status).toBe(202)
  })

  it("running 状态重复启动 -> 409", async () => {
    ;(startProject as Mock).mockRejectedValueOnce(
      new InvalidTransitionError("react_running", "START_REACT"),
    )

    const res = await startHandler(
      postReq("/api/projects/p1/start"),
      routeCtx({ projectId: "p1" }),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("INVALID_TRANSITION")
  })

  it("项目不存在 -> 404", async () => {
    ;(startProject as Mock).mockRejectedValueOnce(
      new NotFoundError("Project", "missing"),
    )

    const res = await startHandler(
      postReq("/api/projects/missing/start"),
      routeCtx({ projectId: "missing" }),
    )
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe("NOT_FOUND")
  })

  it("service 内部异常 -> 500", async () => {
    ;(startProject as Mock).mockRejectedValueOnce(new Error("unexpected"))

    const res = await startHandler(
      postReq("/api/projects/p1/start"),
      routeCtx({ projectId: "p1" }),
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe("INTERNAL")
  })
})

// ─── Tests: POST /api/projects/[projectId]/stop ─────────

describe("POST /api/projects/[projectId]/stop", () => {
  it("running 状态正常停止 -> 202", async () => {
    ;(stopProject as Mock).mockResolvedValueOnce({ lifecycle: "stopping" })

    const res = await stopHandler(
      postReq("/api/projects/p1/stop"),
      routeCtx({ projectId: "p1" }),
    )
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.lifecycle).toBe("stopping")
    expect(stopProject).toHaveBeenCalledWith("p1")
  })

  it("waiting_approval 状态下 stop -> 202", async () => {
    ;(stopProject as Mock).mockResolvedValueOnce({ lifecycle: "stopping" })

    const res = await stopHandler(
      postReq("/api/projects/p1/stop"),
      routeCtx({ projectId: "p1" }),
    )
    expect(res.status).toBe(202)
  })

  it("已 stopped 再 stop -> 409", async () => {
    ;(stopProject as Mock).mockRejectedValueOnce(
      new InvalidTransitionError("stopped", "STOP"),
    )

    const res = await stopHandler(
      postReq("/api/projects/p1/stop"),
      routeCtx({ projectId: "p1" }),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("INVALID_TRANSITION")
  })

  it("项目不存在 -> 404", async () => {
    ;(stopProject as Mock).mockRejectedValueOnce(
      new NotFoundError("Project", "ghost"),
    )

    const res = await stopHandler(
      postReq("/api/projects/ghost/stop"),
      routeCtx({ projectId: "ghost" }),
    )
    expect(res.status).toBe(404)
  })

  it("service 内部异常 -> 500", async () => {
    ;(stopProject as Mock).mockRejectedValueOnce(new Error("boom"))

    const res = await stopHandler(
      postReq("/api/projects/p1/stop"),
      routeCtx({ projectId: "p1" }),
    )
    expect(res.status).toBe(500)
  })
})
