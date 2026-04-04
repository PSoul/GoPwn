/**
 * Verification worker — handles "verify_finding" jobs.
 * Generates PoC code via LLM, executes it via MCP, and updates finding status.
 */

import * as findingRepo from "@/lib/repositories/finding-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import * as auditRepo from "@/lib/repositories/audit-repo"
import { publishEvent } from "@/lib/infra/event-bus"
import { registerAbort, unregisterAbort } from "@/lib/infra/abort-registry"
import { callTool } from "@/lib/mcp"
import { prisma } from "@/lib/infra/prisma"
import {
  getLlmProvider,
  buildVerifierPrompt,
  parseLlmJson,
  type LlmPocCode,
  type VerifierContext,
} from "@/lib/llm"

export async function handleVerifyFinding(data: { projectId: string; findingId: string }) {
  const { projectId, findingId } = data
  console.log(`[verification] Verifying finding ${findingId}`)

  const finding = await findingRepo.findById(findingId)
  if (!finding) {
    console.error(`[verification] Finding ${findingId} not found`)
    return
  }

  // Only verify suspected findings
  if (finding.status !== "suspected") {
    console.warn(`[verification] Finding ${findingId} is ${finding.status}, skipping`)
    return
  }

  // Check project is still active
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, lifecycle: true, currentPhase: true, currentRound: true },
  })

  if (!project || project.lifecycle === "stopped" || project.lifecycle === "stopping") {
    console.warn(`[verification] Project ${projectId} is ${project?.lifecycle}, skipping`)
    return
  }

  try {
    // Mark as verifying
    await findingRepo.updateStatus(findingId, "verifying")

    // Build context for verifier
    const evidence = finding.evidence
    const verifierCtx: VerifierContext = {
      projectName: project.name,
      finding: {
        title: finding.title,
        summary: finding.summary,
        severity: finding.severity,
        affectedTarget: finding.affectedTarget,
      },
      evidence: evidence
        ? { rawOutput: evidence.rawOutput.slice(0, 5000), toolName: evidence.toolName }
        : undefined,
    }

    // Ask LLM to generate PoC code (with abort support)
    const abortController = new AbortController()
    registerAbort(projectId, abortController)

    const llm = await getLlmProvider(projectId, "analyzer") // Use analyzer profile for PoC generation
    const messages = await buildVerifierPrompt(verifierCtx)
    const response = await llm.chat(messages, { jsonMode: true, signal: abortController.signal })
    unregisterAbort(projectId, abortController)

    const pocSpec = parseLlmJson<LlmPocCode>(response.content)

    // Find a code execution tool — not hardcoded to "execute_code"
    const { findByCapability } = await import("@/lib/repositories/mcp-tool-repo")
    const codeTools = await findByCapability("code_execution")
    const codeToolName = codeTools[0]?.toolName ?? "execute_code"

    // Create MCP run for the PoC execution
    const mcpRun = await mcpRunRepo.create({
      projectId,
      toolId: codeTools[0]?.id,
      capability: "code_execution",
      toolName: codeToolName,
      target: finding.affectedTarget,
      requestedAction: `PoC verification: ${finding.title}`,
      riskLevel: "medium",
      phase: project.currentPhase,
      round: project.currentRound,
    })

    await mcpRunRepo.updateStatus(mcpRun.id, "running", { startedAt: new Date() })

    // Execute the PoC via MCP
    const result = await callTool(codeToolName, {
      code: pocSpec.code,
      language: pocSpec.language,
      target: finding.affectedTarget,
    })

    await mcpRunRepo.updateStatus(mcpRun.id, result.isError ? "failed" : "succeeded", {
      rawOutput: result.content,
      completedAt: new Date(),
      error: result.isError ? result.content.slice(0, 1000) : undefined,
    })

    // Parse PoC result to determine if verified
    let verified = false
    try {
      const pocResult = JSON.parse(result.content)
      verified = pocResult.verified === true
    } catch {
      // If we can't parse, check for common success indicators
      verified = result.content.includes('"verified":true') || result.content.includes('"verified": true')
    }

    // Save PoC record
    await findingRepo.createPoc({
      findingId,
      mcpRunId: mcpRun.id,
      code: pocSpec.code,
      language: pocSpec.language,
      executionOutput: result.content.slice(0, 50_000),
      succeeded: verified,
      executedAt: new Date(),
    })

    // Update finding status
    const newStatus = verified ? "verified" : "false_positive"
    await findingRepo.updateStatus(findingId, newStatus)

    await publishEvent({
      type: "finding_verified",
      projectId,
      timestamp: new Date().toISOString(),
      data: {
        findingId,
        title: finding.title,
        severity: finding.severity,
        verified,
        newStatus,
      },
    })

    await auditRepo.create({
      projectId,
      category: "verification",
      action: verified ? "finding_verified" : "finding_false_positive",
      actor: "system",
      detail: `${finding.title} (${finding.severity}): ${verified ? "已验证" : "误报"}`,
    })

    console.log(`[verification] Finding "${finding.title}": ${verified ? "VERIFIED" : "FALSE POSITIVE"}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[verification] Failed to verify finding ${findingId}:`, message)

    // Revert to suspected on failure (don't mark as false positive on error)
    await findingRepo.updateStatus(findingId, "suspected").catch(() => {})

    await publishEvent({
      type: "verification_failed",
      projectId,
      timestamp: new Date().toISOString(),
      data: { findingId, error: message.slice(0, 500) },
    })

    throw err // pg-boss will retry
  }
}
