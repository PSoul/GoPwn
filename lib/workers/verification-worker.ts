/**
 * Verification worker — handles "verify_finding" jobs.
 * Generates PoC code via LLM, executes it via MCP, and updates finding status.
 */

import * as findingRepo from "@/lib/repositories/finding-repo"
import * as mcpRunRepo from "@/lib/repositories/mcp-run-repo"
import * as auditRepo from "@/lib/repositories/audit-repo"
import { publishEvent } from "@/lib/infra/event-bus"
import { registerAbort, unregisterAbort } from "@/lib/infra/abort-registry"
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
import { isTerminalOrSettling } from "@/lib/domain/lifecycle"
import { callTool } from "@/lib/mcp"
import { prisma } from "@/lib/infra/prisma"
import {
  getLlmProvider,
  buildVerifierPrompt,
  parseLlmJson,
  type LlmPocCode,
  type VerifierContext,
} from "@/lib/llm"

const POC_TIMEOUT_MS = 120_000 // 2 min per PoC execution

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`PoC execution timeout after ${ms}ms: ${label}`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

export async function handleVerifyFinding(data: { projectId: string; findingId: string }) {
  const { projectId, findingId } = data
  const log = createPipelineLogger(projectId, "verify_finding")
  log.info("started", `验证发现 ${findingId}`)

  const finding = await findingRepo.findById(findingId)
  if (!finding) {
    log.error("failed", `Finding ${findingId} 不存在`)
    return
  }

  // Only verify suspected or interrupted-verifying findings
  if (finding.status !== "suspected" && finding.status !== "verifying") {
    log.info("skipped", `Finding ${findingId} 状态为 ${finding.status}，跳过验证`)
    return
  }

  // Check project is still active
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, lifecycle: true, currentPhase: true, currentRound: true },
  })

  if (!project || isTerminalOrSettling(project.lifecycle)) {
    log.warn("skipped", `项目已 ${project?.lifecycle ?? "deleted"}，跳过验证`)
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

    const timer = log.startTimer()
    log.info("llm_call", `调用 verifier LLM 生成 PoC: ${finding.title}`)

    const llm = await getLlmProvider(projectId, "analyzer") // Use analyzer profile for PoC generation
    const messages = await buildVerifierPrompt(verifierCtx)
    const response = await llm.chat(messages, { jsonMode: true, signal: abortController.signal })
    unregisterAbort(projectId, abortController)

    const pocSpec = parseLlmJson<LlmPocCode>(response.content)

    log.info("llm_response", `PoC 代码已生成 (${pocSpec.language})`, null, timer.elapsed())

    // Find a code execution tool — not hardcoded to "execute_code"
    const { findByCapability } = await import("@/lib/repositories/mcp-tool-repo")
    const codeTools = await findByCapability("code_execution")
    if (codeTools.length === 0) {
      log.warn("no_code_tool", "未找到 code_execution 类型的工具，使用 fallback 名称 execute_code")
    }
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

    const pocTimer = log.startTimer()
    log.info("mcp_call", `执行 PoC: ${codeToolName}(${finding.affectedTarget})`)

    // Execute the PoC via MCP (with timeout to prevent indefinite hangs)
    const result = await withTimeout(
      callTool(codeToolName, {
        code: pocSpec.code,
        language: pocSpec.language,
        target: finding.affectedTarget,
      }),
      POC_TIMEOUT_MS,
      `${codeToolName}(${finding.affectedTarget})`,
    )

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

    log.info("mcp_response", `PoC 结果: ${verified ? "已验证" : "误报"}`, { verified }, pocTimer.elapsed())

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
    }).catch(() => {})

    await auditRepo.create({
      projectId,
      category: "verification",
      action: verified ? "finding_verified" : "finding_false_positive",
      actor: "system",
      detail: `${finding.title} (${finding.severity}): ${verified ? "已验证" : "误报"}`,
    })

    log.info("completed", `"${finding.title}": ${verified ? "VERIFIED" : "FALSE POSITIVE"}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error("failed", `验证失败: ${message}`, { error: message })

    // Revert to suspected on failure (don't mark as false positive on error)
    await findingRepo.updateStatus(findingId, "suspected").catch(() => {})

    await publishEvent({
      type: "verification_failed",
      projectId,
      timestamp: new Date().toISOString(),
      data: { findingId, error: message.slice(0, 500) },
    }).catch(() => {})

    throw err // pg-boss will retry
  }
}
