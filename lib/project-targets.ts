import type { ProjectRecord } from "@/lib/prototype-types"

export const SINGLE_USER_LABEL = "研究员席位"

export function normalizeProjectTargets(targetInput: string) {
  return targetInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function getProjectPrimaryTarget(project: Pick<ProjectRecord, "targetInput" | "targets">) {
  return project.targets[0] ?? normalizeProjectTargets(project.targetInput)[0] ?? ""
}

export function getProjectDisplayDescription(project: Pick<ProjectRecord, "description" | "summary">) {
  return project.description || project.summary
}
