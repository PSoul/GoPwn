import { prisma } from "@/lib/prisma"
import {
  toProjectDetailRecord,
  toProjectFormPresetRecord,
  toProjectRecord,
  toLogRecord,
} from "@/lib/prisma-transforms"

export async function listStoredProjects() {
  const rows = await prisma.project.findMany({ orderBy: { lastUpdated: "desc" } })
  return rows.map(toProjectRecord)
}

export async function getStoredProjectById(projectId: string) {
  const row = await prisma.project.findUnique({ where: { id: projectId } })
  return row ? toProjectRecord(row) : null
}

export async function getStoredProjectDetailById(projectId: string) {
  const row = await prisma.projectDetail.findUnique({ where: { projectId } })
  return row ? toProjectDetailRecord(row) : null
}

export async function getStoredProjectFormPreset(projectId?: string) {
  if (!projectId) {
    const firstProject = await prisma.project.findFirst({ orderBy: { lastUpdated: "desc" } })
    if (!firstProject) return null
    projectId = firstProject.id
  }
  const row = await prisma.projectFormPreset.findUnique({ where: { projectId } })
  return row ? toProjectFormPresetRecord(row) : null
}

export async function listStoredAuditLogs() {
  const rows = await prisma.auditLog.findMany({ orderBy: { timestamp: "desc" } })
  return rows.map(toLogRecord)
}
