import * as projectRepo from "@/lib/repositories/project-repo"
import * as auditRepo from "@/lib/repositories/audit-repo"
import { transition } from "@/lib/domain/lifecycle"
import { NotFoundError } from "@/lib/domain/errors"
import { publishEvent } from "@/lib/infra/event-bus"
import { createPgBossJobQueue } from "@/lib/infra/job-queue"

function generateCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const rand = Math.random().toString(36).slice(2, 10)
  return `proj-${date}-${rand}`
}

function normalizeTarget(input: string): { value: string; type: string; normalized: string } {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed)
    return { value: trimmed, type: "url", normalized: url.origin + url.pathname.replace(/\/+$/, "") }
  }
  if (/^\d{1,3}(\.\d{1,3}){3}(\/\d+)?$/.test(trimmed)) {
    return { value: trimmed, type: trimmed.includes("/") ? "cidr" : "ip", normalized: trimmed }
  }
  return { value: trimmed, type: "domain", normalized: trimmed.toLowerCase() }
}

export async function listProjects() {
  return projectRepo.findAll()
}

export async function getProject(id: string) {
  const project = await projectRepo.findById(id)
  if (!project) throw new NotFoundError("Project", id)
  return project
}

export async function createProject(data: { name: string; targetInput: string; description?: string }) {
  const targets = data.targetInput
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeTarget)

  const project = await projectRepo.create({
    code: generateCode(),
    name: data.name,
    description: data.description,
    targets,
  })

  await auditRepo.create({
    projectId: project.id,
    category: "project",
    action: "created",
    actor: "user",
    detail: `Created project "${data.name}" with ${targets.length} target(s)`,
  })

  return project
}

export async function startProject(projectId: string) {
  const project = await getProject(projectId)
  const event = project.lifecycle === "failed" ? "RETRY" as const : "START" as const
  const nextLifecycle = transition(project.lifecycle, event)

  await projectRepo.updateLifecycle(projectId, nextLifecycle)

  const queue = createPgBossJobQueue()
  await queue.publish("plan_round", {
    projectId,
    round: project.currentRound + 1,
  })

  await publishEvent({
    type: "lifecycle_changed",
    projectId,
    timestamp: new Date().toISOString(),
    data: { lifecycle: nextLifecycle },
  })

  await auditRepo.create({
    projectId,
    category: "project",
    action: "started",
    actor: "user",
  })

  return { lifecycle: nextLifecycle }
}

export async function stopProject(projectId: string) {
  const project = await getProject(projectId)
  const stoppingState = transition(project.lifecycle, "STOP")

  await projectRepo.updateLifecycle(projectId, stoppingState)

  // Cancel all pending/scheduled MCP runs for this project
  const { cancelPendingByProject } = await import("@/lib/repositories/mcp-run-repo")
  await cancelPendingByProject(projectId)

  // Now transition to fully stopped
  const stoppedState = transition(stoppingState, "STOPPED")
  await projectRepo.updateLifecycle(projectId, stoppedState)

  await publishEvent({
    type: "lifecycle_changed",
    projectId,
    timestamp: new Date().toISOString(),
    data: { lifecycle: stoppedState },
  })

  await auditRepo.create({
    projectId,
    category: "project",
    action: "stopped",
    actor: "user",
  })

  return { lifecycle: stoppedState }
}

export async function deleteProject(projectId: string) {
  await getProject(projectId) // throws if not found
  await projectRepo.deleteById(projectId)
}
