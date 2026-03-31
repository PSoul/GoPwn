import { buildProjectReviewerPrompt } from "@/lib/llm-brain-prompt"
import { resolveLlmProvider } from "@/lib/llm-provider/registry"
import { prisma } from "@/lib/prisma"
import {
  toProjectRecord,
  fromProjectConclusionRecord,
  toLogRecord,
} from "@/lib/prisma-transforms"
import { formatTimestamp } from "@/lib/prototype-record-utils"
import { upsertStoredWorkLogs } from "@/lib/work-log-repository"
import { getStoredProjectLatestConclusion, refreshStoredProjectResults } from "./project-results-core"
import { listStoredProjectReportExports } from "./project-report-repository"
import type {
  ProjectConclusionRecord,
} from "@/lib/prototype-types"

function normalizeConclusionSummary(summary: string, fallback: string) {
  const trimmed = summary.trim() || fallback.trim()

  if (!trimmed) {
    return "最终结论：当前项目已收束，但还没有足够结果可供展示。"
  }

  return trimmed.startsWith("最终结论：") ? trimmed : `最终结论：${trimmed}`
}

function buildFallbackConclusionRecord(input: {
  assetCount: number
  evidenceCount: number
  findingCount: number
  projectId: string
}): Omit<ProjectConclusionRecord, "generatedAt" | "id" | "source"> {
  const findingLead =
    input.findingCount > 0
      ? `当前累计 ${input.findingCount} 条漏洞/发现，后续重点应围绕这些结果做复核与修复追踪。`
      : "当前没有新增漏洞/发现，结论以资产面与证据面为主。"

  return {
    assetCount: input.assetCount,
    evidenceCount: input.evidenceCount,
    findingCount: input.findingCount,
    keyPoints: [
      `资产 ${input.assetCount} 条`,
      `证据 ${input.evidenceCount} 条`,
      `漏洞/发现 ${input.findingCount} 条`,
    ],
    nextActions:
      input.findingCount > 0
        ? ["复核高风险发现证据", "整理修复建议并回填报告", "视需要开启下一轮验证"]
        : ["复核当前资产与证据", "确认是否需要补充更深一轮验证", "导出并归档当前报告"],
    projectId: input.projectId,
    summary: normalizeConclusionSummary(
      `本轮项目已完成首轮收束，已沉淀 ${input.assetCount} 条资产、${input.evidenceCount} 条证据和 ${input.findingCount} 条漏洞/发现。 ${findingLead}`,
      "本轮项目已完成首轮收束。",
    ),
  }
}

function buildConclusionWorkLog(record: ProjectConclusionRecord, projectName: string) {
  return {
    id: `work-project-conclusion-${record.projectId}-${record.generatedAt.replace(/[^0-9]/g, "")}`,
    category: "项目结论",
    summary: record.summary,
    projectName,
    actor: record.source === "reviewer" ? "reviewer-provider" : "reviewer-fallback",
    timestamp: record.generatedAt,
    status: "已完成",
  }
}

export async function generateStoredProjectFinalConclusion(projectId: string) {
  const projectRow = await prisma.project.findUnique({ where: { id: projectId } })
  if (!projectRow) return null
  const project = toProjectRecord(projectRow)

  const [assetCount, evidenceCount, findingCount] = await Promise.all([
    prisma.asset.count({ where: { projectId } }),
    prisma.evidence.count({ where: { projectId } }),
    prisma.finding.count({ where: { projectId } }),
  ])
  const reportExport = (await listStoredProjectReportExports(projectId))[0] ?? null
  const existingConclusion = await getStoredProjectLatestConclusion(projectId)
  const timestamp = formatTimestamp()
  const fallback = buildFallbackConclusionRecord({ assetCount, evidenceCount, findingCount, projectId })
  const provider = await resolveLlmProvider()
  let nextRecord: ProjectConclusionRecord = {
    ...fallback,
    generatedAt: timestamp,
    id: existingConclusion?.id ?? `conclusion-${projectId}`,
    source: "fallback",
  }

  if (provider) {
    const workLogs = (await prisma.workLog.findMany({
      where: { projectName: project.name },
      orderBy: { timestamp: "desc" },
      take: 6,
    })).map(toLogRecord)

    try {
      const providerResult = await provider.generatePlan({
        prompt: buildProjectReviewerPrompt({
          assetCount,
          description: project.description,
          evidenceCount,
          findingCount,
          latestReportSummary: reportExport?.summary ?? "",
          projectName: project.name,
          recentContext: workLogs.map((log) => `${log.category} / ${log.summary}`),
          stage: project.stage,
          targets: project.targets,
        }),
        purpose: "reviewer",
        projectId,
      })
      const reviewerKeyPoints = providerResult.content.items
        .slice(0, 3)
        .map((item) => `${item.requestedAction} @ ${item.target}`)
        .filter(Boolean)
      const reviewerNextActions = providerResult.content.items
        .slice(0, 3)
        .map((item) => item.rationale || item.requestedAction)
        .filter(Boolean)
      nextRecord = {
        ...nextRecord,
        keyPoints: reviewerKeyPoints.length > 0 ? reviewerKeyPoints : nextRecord.keyPoints,
        nextActions: reviewerNextActions.length > 0 ? reviewerNextActions : nextRecord.nextActions,
        source: "reviewer",
        summary: normalizeConclusionSummary(providerResult.content.summary, fallback.summary),
      }
    } catch {
      nextRecord = { ...nextRecord, summary: fallback.summary, source: "fallback" }
    }
  }

  await prisma.projectConclusion.upsert({
    where: { projectId },
    create: fromProjectConclusionRecord(nextRecord),
    update: fromProjectConclusionRecord(nextRecord),
  })

  await upsertStoredWorkLogs([buildConclusionWorkLog(nextRecord, project.name)])
  await refreshStoredProjectResults(projectId)
  return nextRecord
}
