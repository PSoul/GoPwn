import { apiHandler, json } from "@/lib/infra/api-handler"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import * as mcpToolRepo from "@/lib/repositories/mcp-tool-repo"
import { callTool } from "@/lib/mcp/registry"
import { getProject } from "@/lib/services/project-service"
import type { RiskLevel } from "@/lib/generated/prisma"

export const GET = apiHandler(async (_req, ctx) => {
  const { projectId } = await ctx.params
  const runs = await mcpRunRepo.findByProject(projectId)
  return json(runs)
})

export const POST = apiHandler(async (req, ctx) => {
  const { projectId } = await ctx.params
  const body = await req.json() as {
    capability: string
    requestedAction: string
    target: string
    riskLevel: string
  }

  const project = await getProject(projectId)
  const tools = await mcpToolRepo.findByCapability(body.capability)
  const tool = tools[0]
  const toolName = tool?.toolName ?? body.capability

  const run = await mcpRunRepo.create({
    projectId,
    toolId: tool?.id,
    capability: body.capability,
    toolName,
    target: body.target,
    requestedAction: body.requestedAction,
    riskLevel: (body.riskLevel || "low") as RiskLevel,
    phase: project.currentPhase,
    round: project.currentRound || 1,
  })

  // Execute tool in background, update run status when done
  callTool(toolName, { target: body.target, action: body.requestedAction })
    .then(async (result) => {
      await mcpRunRepo.updateStatus(run.id, result.isError ? "failed" : "succeeded", {
        rawOutput: result.content,
      })
    })
    .catch(async () => {
      await mcpRunRepo.updateStatus(run.id, "failed", { rawOutput: "Tool execution error" })
    })

  return json({ run }, 201)
})
