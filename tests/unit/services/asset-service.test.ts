/**
 * 单元测试：asset-service
 * Mock asset-repo 验证服务层委托和错误处理
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFindByProject = vi.hoisted(() => vi.fn())
const mockFindTreeRoots = vi.hoisted(() => vi.fn())
const mockFindById = vi.hoisted(() => vi.fn())

vi.mock("@/lib/repositories/asset-repo", () => ({
  findByProject: mockFindByProject,
  findTreeRoots: mockFindTreeRoots,
  findById: mockFindById,
}))

import { listByProject, getAssetTree, getAsset } from "@/lib/services/asset-service"
import { NotFoundError } from "@/lib/domain/errors"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("asset-service", () => {
  describe("listByProject", () => {
    it("委托 repo 并返回结果", async () => {
      mockFindByProject.mockResolvedValue([{ id: "a1", kind: "host" }])
      const result = await listByProject("p1")
      expect(result).toEqual([{ id: "a1", kind: "host" }])
      expect(mockFindByProject).toHaveBeenCalledWith("p1")
    })

    it("空结果 → 返回空数组", async () => {
      mockFindByProject.mockResolvedValue([])
      const result = await listByProject("p1")
      expect(result).toEqual([])
    })
  })

  describe("getAssetTree", () => {
    it("委托 findTreeRoots", async () => {
      mockFindTreeRoots.mockResolvedValue([{ id: "root1", children: [] }])
      const result = await getAssetTree("p1")
      expect(result).toHaveLength(1)
      expect(mockFindTreeRoots).toHaveBeenCalledWith("p1")
    })
  })

  describe("getAsset", () => {
    it("存在 → 返回 asset", async () => {
      mockFindById.mockResolvedValue({ id: "a1", kind: "host" })
      const result = await getAsset("a1")
      expect(result.id).toBe("a1")
      expect(mockFindById).toHaveBeenCalledWith("a1")
    })

    it("不存在 → throw NotFoundError", async () => {
      mockFindById.mockResolvedValue(null)
      await expect(getAsset("nope")).rejects.toThrow(NotFoundError)
    })
  })
})
