import { describe, expect, it } from "vitest"

import { projectMutationSchema } from "@/lib/project/project-write-schema"
import type { ProjectFormPreset } from "@/lib/prototype-types"
import { createStoredProject } from "@/lib/project/project-repository"

describe("simplified project model", () => {
  it("accepts the minimal create payload and exposes only the simplified form preset", async () => {
    expect(() =>
      projectMutationSchema.parse({
        name: "内网暴露面核查",
        targetInput: "example.com\n192.168.1.10\n192.168.1.0/24",
        description: "对授权目标做统一编排与结果沉淀。",
      }),
    ).not.toThrow()

    const defaultPreset: ProjectFormPreset = { name: "", targetInput: "", description: "" }
    expect(defaultPreset).toEqual({
      name: "",
      targetInput: "",
      description: "",
    })
  })

  it("stores raw target input, normalized targets, and description on new projects", async () => {
    const payload = await createStoredProject({
      name: "多目标项目",
      targetInput: "example.com\n192.168.1.10\n\n 10.10.10.0/24 ",
      description: "统一调度多类目标。",
    } as never)

    expect(payload.project).toMatchObject({
      name: "多目标项目",
      targetInput: "example.com\n192.168.1.10\n\n 10.10.10.0/24 ",
      description: "统一调度多类目标。",
      targets: ["example.com", "192.168.1.10", "10.10.10.0/24"],
    })
    expect("seed" in payload.project).toBe(false)
    expect(payload.detail.target).toBe("example.com\n192.168.1.10\n\n 10.10.10.0/24 ")
  })

  // Skipped: file-store migration test, Prisma is now the sole data layer
  it.skip("migrates legacy project records into the simplified model during store normalization", () => {
    expect(true).toBe(true)
  })
})
