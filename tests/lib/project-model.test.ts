import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { buildProjectClosureStatus } from "@/lib/project-closure-status"
import { projectMutationSchema } from "@/lib/project-write-schema"
import { createStoredProject } from "@/lib/project-repository"
import { getDefaultProjectFormPreset, readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"

describe("simplified project model", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-project-model-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("accepts the minimal create payload and exposes only the simplified form preset", async () => {
    expect(() =>
      projectMutationSchema.parse({
        name: "内网暴露面核查",
        targetInput: "example.com\n192.168.1.10\n192.168.1.0/24",
        description: "对授权目标做统一编排与结果沉淀。",
      }),
    ).not.toThrow()

    expect(getDefaultProjectFormPreset()).toEqual({
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

    const store = readPrototypeStore()
    expect(store.projectSchedulerControls[payload.project.id]).toMatchObject({
      lifecycle: "idle",
      paused: false,
    })
  })

  it("migrates legacy project records into the simplified model during store normalization", async () => {
    const store = readPrototypeStore()

    writePrototypeStore({
      ...store,
      version: 1,
      projects: [
        {
          id: "proj-legacy-model",
          code: "PRJ-20260327-001",
          name: "旧项目",
          seed: "legacy.example.com\n10.10.10.10",
          targetType: "mixed",
          targetSummary: "旧字段说明",
          owner: "旧研究员",
          priority: "中",
          stage: "持续信息收集",
          status: "运行中",
          pendingApprovals: 0,
          openTasks: 1,
          assetCount: 0,
          evidenceCount: 0,
          createdAt: "2026-03-27 09:00",
          lastUpdated: "2026-03-27 09:05",
          lastActor: "迁移前",
          riskSummary: "旧风险摘要",
          summary: "旧项目摘要",
          authorizationSummary: "旧授权",
          scopeSummary: "旧范围",
          forbiddenActions: "旧禁止",
          defaultConcurrency: "1",
          rateLimit: "10 req/min",
          timeout: "30s",
          approvalMode: "高风险审批",
          tags: ["legacy"],
        } as never,
      ],
      projectDetails: [
        {
          projectId: "proj-legacy-model",
          target: "legacy.example.com\n10.10.10.10",
          blockingReason: "旧阻塞",
          nextStep: "旧下一步",
          reflowNotice: "旧回流",
          currentFocus: "旧焦点",
          timeline: [],
          tasks: [],
          discoveredInfo: [],
          serviceSurface: [],
          fingerprints: [],
          entries: [],
          scheduler: [],
          activity: [],
          resultMetrics: [],
          assetGroups: [],
          findings: [],
          currentStage: {
            title: "持续信息收集",
            summary: "旧阶段",
            blocker: "旧阻塞",
            owner: "旧研究员",
            updatedAt: "2026-03-27 09:05",
          },
          approvalControl: {
            enabled: true,
            mode: "高风险审批",
            autoApproveLowRisk: false,
            description: "旧审批",
            note: "旧备注",
          },
          closureStatus: buildProjectClosureStatus({
            finalConclusionGenerated: false,
            lifecycle: "running",
            pendingApprovals: 0,
            projectStatus: "运行中",
            queuedTaskCount: 0,
            reportExported: false,
            runningTaskCount: 0,
            waitingApprovalTaskCount: 0,
          }),
          finalConclusion: null,
        },
      ],
      projectFormPresets: {
        "proj-legacy-model": {
          name: "旧项目",
          seed: "legacy.example.com\n10.10.10.10",
          targetType: "mixed",
          owner: "旧研究员",
          priority: "中",
          targetSummary: "旧字段说明",
          authorizationSummary: "旧授权",
          scopeSummary: "旧范围",
          forbiddenActions: "旧禁止",
          defaultConcurrency: "1",
          rateLimit: "10 req/min",
          timeout: "30s",
          approvalMode: "高风险审批",
          tags: "legacy",
          deliveryNotes: "旧交付说明",
        } as never,
      },
    })

    const migrated = readPrototypeStore()
    const project = migrated.projects[0] as Record<string, unknown>
    const preset = migrated.projectFormPresets[String(project.id)] as Record<string, unknown>

    expect(project.targetInput).toBe("legacy.example.com\n10.10.10.10")
    expect(project.targets).toEqual(["legacy.example.com", "10.10.10.10"])
    expect(project.description).toBe("旧字段说明")
    expect(project.seed).toBeUndefined()

    expect(preset).toEqual({
      name: "旧项目",
      targetInput: "legacy.example.com\n10.10.10.10",
      description: "旧字段说明",
    })
  })
})
