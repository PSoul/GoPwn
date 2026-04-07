/**
 * 集成测试：projects CRUD 路由
 *
 * 覆盖：GET/POST /api/projects, GET/DELETE /api/projects/[projectId]
 * 策略：mock service 层，不涉及数据库
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { NextRequest } from "next/server"
import { mockProject } from "../../helpers/factories"
import { routeCtx } from "../../helpers/route-test-utils"
import { NotFoundError } from "@/lib/domain/errors"

// ─── Mock service 层 ────────────────────────────────────

vi.mock("@/lib/services/project-service", () => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
}))

import {
  listProjects,
  getProject,
  createProject,
  deleteProject,
} from "@/lib/services/project-service"

// ─── Import route handlers ─────────────────────────────

import { GET as listHandler, POST as createHandler } from "@/app/api/projects/route"
import {
  GET as getHandler,
  DELETE as deleteHandler,
} from "@/app/api/projects/[projectId]/route"

// ─── Reset ─────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Helpers ────────────────────────────────────────────

function jsonReq(url: string, body: Record<string, unknown>) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

function getReq(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"))
}

function deleteReq(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"), { method: "DELETE" })
}

// ─── Tests: GET /api/projects ───────────────────────────

describe("GET /api/projects", () => {
  it("返回项目列表", async () => {
    const projects = [mockProject(), mockProject({ id: "proj-2", name: "Second" })]
    ;(listProjects as Mock).mockResolvedValueOnce(projects)

    const res = await listHandler(getReq("/api/projects"), routeCtx({}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].name).toBe("Test Project")
  })

  it("空列表 -> 200 + []", async () => {
    ;(listProjects as Mock).mockResolvedValueOnce([])

    const res = await listHandler(getReq("/api/projects"), routeCtx({}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})

// ─── Tests: POST /api/projects ──────────────────────────

describe("POST /api/projects", () => {
  it("有效参数 -> 201 + project 对象", async () => {
    const created = mockProject({ name: "New Project" })
    ;(createProject as Mock).mockResolvedValueOnce(created)

    const res = await createHandler(
      jsonReq("/api/projects", {
        name: "New Project",
        targetInput: "http://127.0.0.1:8080",
      }),
      routeCtx({}),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.project.name).toBe("New Project")
    expect(createProject).toHaveBeenCalledWith({
      name: "New Project",
      targetInput: "http://127.0.0.1:8080",
    })
  })

  it("service 层抛异常 -> 500", async () => {
    ;(createProject as Mock).mockRejectedValueOnce(new Error("DB error"))

    const res = await createHandler(
      jsonReq("/api/projects", {
        name: "Fail",
        targetInput: "http://target",
      }),
      routeCtx({}),
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internal server error")
  })
})

// ─── Tests: GET /api/projects/[projectId] ───────────────

describe("GET /api/projects/[projectId]", () => {
  it("存在的项目 -> 200", async () => {
    const project = mockProject()
    ;(getProject as Mock).mockResolvedValueOnce(project)

    const res = await getHandler(
      getReq("/api/projects/proj-test-001"),
      routeCtx({ projectId: "proj-test-001" }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("Test Project")
  })

  it("不存在的项目 -> 404", async () => {
    ;(getProject as Mock).mockRejectedValueOnce(
      new NotFoundError("Project", "non-existent"),
    )

    const res = await getHandler(
      getReq("/api/projects/non-existent"),
      routeCtx({ projectId: "non-existent" }),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe("NOT_FOUND")
  })
})

// ─── Tests: DELETE /api/projects/[projectId] ────────────

describe("DELETE /api/projects/[projectId]", () => {
  it("正常删除 -> 200", async () => {
    ;(deleteProject as Mock).mockResolvedValueOnce(undefined)

    const res = await deleteHandler(
      deleteReq("/api/projects/proj-test-001"),
      routeCtx({ projectId: "proj-test-001" }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(deleteProject).toHaveBeenCalledWith("proj-test-001")
  })

  it("不存在的项目 -> 404", async () => {
    ;(deleteProject as Mock).mockRejectedValueOnce(
      new NotFoundError("Project", "missing"),
    )

    const res = await deleteHandler(
      deleteReq("/api/projects/missing"),
      routeCtx({ projectId: "missing" }),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe("NOT_FOUND")
  })
})
