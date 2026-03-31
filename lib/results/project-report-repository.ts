import { prisma } from "@/lib/prisma"
import {
  toProjectRecord,
  toProjectConclusionRecord,
  toMcpRunRecord,
  toLogRecord,
} from "@/lib/prisma-transforms"
import { getStoredProjectLatestConclusion } from "./project-results-core"
import type {
  McpRunRecord,
  ProjectConclusionRecord,
  ProjectReportExportPayload,
  ProjectReportExportRecord,
} from "@/lib/prototype-types"

function parseReportDigestFromLog(summary: string) {
  const marker = "项目报告摘要已导出："
  const digest = summary.includes(marker) ? summary.slice(summary.indexOf(marker) + marker.length).trim() : ""

  if (!digest) {
    return []
  }

  return digest
    .split("；")
    .map((line) => line.trim())
    .filter(Boolean)
}

function toStoredProjectReportExportRecord(
  run: McpRunRecord,
  reportLogSummary: string | undefined,
  assetCount: number,
  evidenceCount: number,
  findingCount: number,
  conclusion: ProjectConclusionRecord | null,
): ProjectReportExportRecord {
  const digestLines = parseReportDigestFromLog(reportLogSummary ?? "")

  return {
    id: `report-${run.id}`,
    projectId: run.projectId,
    runId: run.id,
    exportedAt: run.updatedAt,
    summary:
      reportLogSummary ??
      run.summaryLines.at(-1) ??
      `${run.requestedAction} 已执行完成，报告导出记录已回流。`,
    digestLines: digestLines.length > 0 ? digestLines : run.summaryLines.slice(-3),
    assetCount,
    evidenceCount,
    findingCount,
    conclusionGeneratedAt: conclusion?.generatedAt ?? null,
    conclusionSource: conclusion?.source ?? null,
    conclusionSummary: conclusion?.summary ?? null,
  }
}

export async function listStoredProjectReportExports(projectId: string): Promise<ProjectReportExportRecord[]> {
  const projectRow = await prisma.project.findUnique({ where: { id: projectId } })
  if (!projectRow) return []
  const project = toProjectRecord(projectRow)

  const [projectRunRows, projectLogRows, assetCount, evidenceCount, findingCount, conclusionRow] =
    await Promise.all([
      prisma.mcpRun.findMany({
        where: { projectId, toolName: "report-exporter", status: "已执行" },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.workLog.findMany({
        where: { projectName: project.name, category: "报告导出" },
      }),
      prisma.asset.count({ where: { projectId } }),
      prisma.evidence.count({ where: { projectId } }),
      prisma.finding.count({ where: { projectId } }),
      prisma.projectConclusion.findUnique({ where: { projectId } }),
    ])

  const projectRuns = projectRunRows.map(toMcpRunRecord)
  const projectLogs = projectLogRows.map(toLogRecord)
  const logByRunId = new Map(
    projectLogs
      .filter((log) => log.id.startsWith("work-run-"))
      .map((log) => [log.id.replace(/^work-/, ""), log.summary]),
  )
  const conclusion = conclusionRow ? toProjectConclusionRecord(conclusionRow) : null

  return projectRuns.map((run) =>
    toStoredProjectReportExportRecord(run, logByRunId.get(run.id), assetCount, evidenceCount, findingCount, conclusion),
  )
}

export async function getStoredProjectReportExportPayload(projectId: string): Promise<ProjectReportExportPayload> {
  const records = await listStoredProjectReportExports(projectId)
  const finalConclusion = await getStoredProjectLatestConclusion(projectId)

  return {
    finalConclusion,
    latest: records[0] ?? null,
    totalExports: records.length,
  }
}
