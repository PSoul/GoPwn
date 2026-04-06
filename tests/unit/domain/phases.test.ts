import { describe, it, expect } from "vitest"
import { PHASE_ORDER, PHASE_LABELS, phaseIndex, isPhaseAfter } from "@/lib/domain/phases"

describe("phases: PHASE_ORDER", () => {
  it("包含 5 个阶段且顺序正确", () => {
    expect(PHASE_ORDER).toEqual([
      "recon",
      "discovery",
      "assessment",
      "verification",
      "reporting",
    ])
  })
})

describe("phases: PHASE_LABELS", () => {
  it("每个阶段都有中文标签", () => {
    expect(PHASE_LABELS.recon).toBe("信息收集")
    expect(PHASE_LABELS.discovery).toBe("攻击面发现")
    expect(PHASE_LABELS.assessment).toBe("漏洞评估")
    expect(PHASE_LABELS.verification).toBe("漏洞验证")
    expect(PHASE_LABELS.reporting).toBe("报告生成")
  })

  it("标签数量与阶段数量一致", () => {
    expect(Object.keys(PHASE_LABELS)).toHaveLength(PHASE_ORDER.length)
  })
})

describe("phases: phaseIndex()", () => {
  it("recon 索引为 0", () => {
    expect(phaseIndex("recon")).toBe(0)
  })

  it("reporting 索引为 4", () => {
    expect(phaseIndex("reporting")).toBe(4)
  })

  it("每个阶段索引与 PHASE_ORDER 一致", () => {
    for (let i = 0; i < PHASE_ORDER.length; i++) {
      expect(phaseIndex(PHASE_ORDER[i])).toBe(i)
    }
  })
})

describe("phases: isPhaseAfter()", () => {
  it("discovery 在 recon 之后", () => {
    expect(isPhaseAfter("discovery", "recon")).toBe(true)
  })

  it("recon 不在 discovery 之后", () => {
    expect(isPhaseAfter("recon", "discovery")).toBe(false)
  })

  it("相同阶段不算 after", () => {
    expect(isPhaseAfter("recon", "recon")).toBe(false)
  })

  it("reporting 在 recon 之后", () => {
    expect(isPhaseAfter("reporting", "recon")).toBe(true)
  })

  it("recon 不在 reporting 之后", () => {
    expect(isPhaseAfter("recon", "reporting")).toBe(false)
  })
})
