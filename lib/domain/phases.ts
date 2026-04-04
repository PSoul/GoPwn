import type { PentestPhase } from "@/lib/generated/prisma"

export const PHASE_ORDER: PentestPhase[] = [
  "recon",
  "discovery",
  "assessment",
  "verification",
  "reporting",
]

export const PHASE_LABELS: Record<PentestPhase, string> = {
  recon: "信息收集",
  discovery: "攻击面发现",
  assessment: "漏洞评估",
  verification: "漏洞验证",
  reporting: "报告生成",
}

export function phaseIndex(phase: PentestPhase): number {
  return PHASE_ORDER.indexOf(phase)
}

export function isPhaseAfter(a: PentestPhase, b: PentestPhase): boolean {
  return phaseIndex(a) > phaseIndex(b)
}
