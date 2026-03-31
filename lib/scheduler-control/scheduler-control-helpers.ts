import { formatTimestamp } from "@/lib/prototype-record-utils"
import type { ProjectDetailRecord } from "@/lib/prototype-types"

export function createAuditLog(summary: string, status: string, projectName?: string) {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "调度控制",
    summary,
    projectName,
    actor: "研究员",
    timestamp: formatTimestamp(),
    status,
  }
}

export function pushProjectActivity(
  detail: ProjectDetailRecord,
  title: string,
  detailText: string,
  tone: "success" | "warning" | "danger" | "info",
) {
  return {
    ...detail,
    activity: [
      {
        title,
        detail: detailText,
        meta: "调度控制",
        tone,
      },
      ...detail.activity,
    ].slice(0, 8),
    currentStage: {
      ...detail.currentStage,
      updatedAt: formatTimestamp(),
    },
  }
}
