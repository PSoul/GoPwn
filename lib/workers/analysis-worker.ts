/**
 * Analysis worker — handles "analyze_result" jobs.
 * Calls the LLM analyzer to extract assets, findings, and evidence from tool output.
 */

import * as assetRepo from "@/lib/repositories/asset-repo"
import * as evidenceRepo from "@/lib/repositories/evidence-repo"
import * as findingRepo from "@/lib/repositories/finding-repo"
import * as auditRepo from "@/lib/repositories/audit-repo"
import { publishEvent } from "@/lib/infra/event-bus"
import { createPgBossJobQueue } from "@/lib/infra/job-queue"
import { registerAbort, unregisterAbort } from "@/lib/infra/abort-registry"
import { createPipelineLogger } from "@/lib/infra/pipeline-logger"
import { prisma } from "@/lib/infra/prisma"
import {
  getLlmProvider,
  buildAnalyzerPrompt,
  parseLlmJson,
  type LlmAnalysisResult,
  type AnalyzerContext,
} from "@/lib/llm"
import type { AssetKind, Severity } from "@/lib/generated/prisma"

export async function handleAnalyzeResult(data: {
  projectId: string
  mcpRunId: string
  rawOutput: string
  toolName: string
  target: string
}) {
  const { projectId, mcpRunId, rawOutput, toolName, target } = data
  const log = createPipelineLogger(projectId, "analyze_result")
  log.info("started", `分析 ${toolName} → ${target} 的输出`)

  // Get project info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, lifecycle: true },
  })

  if (!project || project.lifecycle === "stopped" || project.lifecycle === "stopping") {
    log.warn("skipped", `项目已 ${project?.lifecycle ?? "deleted"}，跳过分析`)
    return
  }

  try {
    // Get existing assets and findings to avoid duplicates
    const existingAssets = await assetRepo.findByProject(projectId)
    const existingFindings = await findingRepo.findByProject(projectId)

    const analyzerCtx: AnalyzerContext = {
      projectName: project.name,
      toolName,
      target,
      rawOutput,
      existingAssets: existingAssets.map((a) => ({ kind: a.kind, value: a.value })),
      existingFindings: existingFindings.map((f) => ({
        title: f.title,
        severity: f.severity,
        affectedTarget: f.affectedTarget,
      })),
    }

    // Call LLM analyzer (with abort support)
    const abortController = new AbortController()
    registerAbort(projectId, abortController)

    const timer = log.startTimer()
    log.info("llm_call", "调用 analyzer LLM")

    const llm = await getLlmProvider(projectId, "analyzer")
    const messages = await buildAnalyzerPrompt(analyzerCtx)
    const response = await llm.chat(messages, { jsonMode: true, signal: abortController.signal })
    unregisterAbort(projectId, abortController)

    const analysis = parseLlmJson<LlmAnalysisResult>(response.content)

    log.info("llm_response", `提取 ${analysis.assets?.length ?? 0} 资产, ${analysis.findings?.length ?? 0} 发现`, null, timer.elapsed())

    let newAssetCount = 0
    let newFindingCount = 0

    // Create/update assets
    const assetValueToId = new Map<string, string>()
    for (const asset of analysis.assets ?? []) {
      try {
        const kind = asset.kind as AssetKind
        // Resolve parent ID if specified
        let parentId: string | undefined
        if (asset.parentValue) {
          const parentAsset = existingAssets.find(
            (ea: { value: string }) => ea.value === asset.parentValue,
          )
          parentId = parentAsset?.id ?? assetValueToId.get(asset.parentValue)
        }

        const created = await assetRepo.upsert({
          projectId,
          kind,
          value: asset.value,
          label: asset.label || asset.value,
          parentId,
        })

        assetValueToId.set(asset.value, created.id)

        // Add fingerprints
        if (asset.fingerprints) {
          for (const fp of asset.fingerprints) {
            await assetRepo.addFingerprint(created.id, {
              category: fp.category,
              value: fp.value,
              source: toolName,
            })
          }
        }

        newAssetCount++
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        log.warn("parse_result", `创建资产 ${asset.value} 失败`, { error: errMsg })
      }
    }

    // Create evidence record
    const evidence = await evidenceRepo.create({
      projectId,
      mcpRunId,
      title: `${toolName} → ${target}`,
      toolName,
      rawOutput: rawOutput.slice(0, 100_000), // cap storage
      summary: analysis.evidenceSummary ?? "",
      capturedUrl: target.startsWith("http") ? target : undefined,
    })

    // Create findings
    const queue = createPgBossJobQueue()
    for (const finding of analysis.findings ?? []) {
      try {
        const severity = finding.severity as Severity
        const created = await findingRepo.create({
          projectId,
          evidenceId: evidence.id,
          severity,
          title: finding.title,
          summary: finding.summary,
          affectedTarget: finding.affectedTarget,
          recommendation: finding.recommendation,
        })

        newFindingCount++

        // Queue verification for non-info findings
        if (severity !== "info") {
          await queue.publish("verify_finding", {
            projectId,
            findingId: created.id,
          })
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        log.warn("parse_result", `创建发现 "${finding.title}" 失败`, { error: errMsg })
      }
    }

    // Update round statistics
    const mcpRun = await prisma.mcpRun.findUnique({
      where: { id: mcpRunId },
      select: { round: true },
    })
    if (mcpRun) {
      await prisma.orchestratorRound.update({
        where: { projectId_round: { projectId, round: mcpRun.round } },
        data: {
          newAssetCount: { increment: newAssetCount },
          newFindingCount: { increment: newFindingCount },
          executedCount: { increment: 1 },
        },
      }).catch((e) => { log.warn("stats_update", `更新 round 统计失败: ${e instanceof Error ? e.message : e}`) })
    }

    await publishEvent({
      type: "analysis_completed",
      projectId,
      timestamp: new Date().toISOString(),
      data: {
        mcpRunId,
        toolName,
        newAssets: newAssetCount,
        newFindings: newFindingCount,
        evidenceId: evidence.id,
      },
    }).catch(() => {})

    await auditRepo.create({
      projectId,
      category: "analysis",
      action: "result_analyzed",
      actor: "system",
      detail: `${toolName}: +${newAssetCount} assets, +${newFindingCount} findings`,
    })

    log.info("completed", `+${newAssetCount} 资产, +${newFindingCount} 发现`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error("failed", `分析失败: ${message}`, { error: message })

    // Still save raw evidence even if analysis fails
    await evidenceRepo.create({
      projectId,
      mcpRunId,
      title: `${toolName} → ${target} (analysis failed)`,
      toolName,
      rawOutput: rawOutput.slice(0, 100_000),
      summary: `Analysis failed: ${message.slice(0, 200)}`,
    }).catch((e) => { log.warn("fallback_evidence", `保存 fallback evidence 也失败: ${e instanceof Error ? e.message : e}`) })

    throw err // pg-boss will retry
  }
}
