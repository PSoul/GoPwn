import {
  dispatchStoredMcpRun,
  updateStoredMcpRunResult,
} from "@/lib/mcp-gateway-repository"
import { getStoredProjectById } from "@/lib/project-repository"
import type {
  McpDispatchInput,
  McpRunRecord,
  McpWorkflowSmokePayload,
} from "@/lib/prototype-types"

function buildWorkflowId() {
  return `workflow-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

function normalizeSeed(seed: string) {
  const cleaned = seed.trim().toLowerCase().replace(/^https?:\/\//, "")
  const [hostWithMaybePath] = cleaned.split("?")
  const [host] = hostWithMaybePath.split("/")

  return {
    host,
    normalizedTargets: Array.from(new Set([cleaned, host].filter(Boolean))),
  }
}

function getRootDomain(host: string) {
  const parts = host.split(".").filter(Boolean)

  if (parts.length >= 2) {
    return parts.slice(-2).join(".")
  }

  return host
}

function runLocalTool(toolName: string, context: {
  seed: string
  outputs: McpWorkflowSmokePayload["outputs"]
}) {
  if (toolName === "seed-normalizer") {
    const normalized = normalizeSeed(context.seed).normalizedTargets

    return {
      outputs: {
        normalizedTargets: normalized,
      },
      summaryLines: [
        `标准化得到 ${normalized.length} 个种子目标。`,
        normalized.join(" / "),
      ],
    }
  }

  if (toolName === "dns-census") {
    const host = normalizeSeed(context.seed).host
    const root = getRootDomain(host)
    const discoveredSubdomains = Array.from(new Set([`admin.${root}`, `assets.${root}`]))

    return {
      outputs: {
        discoveredSubdomains,
      },
      summaryLines: [
        `被动发现 ${discoveredSubdomains.length} 个候选子域。`,
        discoveredSubdomains.join(" / "),
      ],
    }
  }

  if (toolName === "web-surface-map") {
    const targets = context.outputs.discoveredSubdomains ?? [normalizeSeed(context.seed).host]
    const webEntries = targets.map((target, index) =>
      index === 0 ? `https://${target}/login` : `https://${target}/dashboard`,
    )

    return {
      outputs: {
        webEntries,
      },
      summaryLines: [
        `识别到 ${webEntries.length} 个 Web 入口。`,
        webEntries.join(" / "),
      ],
    }
  }

  if (toolName === "report-exporter") {
    const reportDigest = [
      `种子目标 ${context.outputs.normalizedTargets?.length ?? 0} 个`,
      `发现子域 ${context.outputs.discoveredSubdomains?.length ?? 0} 个`,
      `入口 ${context.outputs.webEntries?.length ?? 0} 个`,
    ]

    return {
      outputs: {
        reportDigest,
      },
      summaryLines: [
        "已生成基础流程测试报告摘要。",
        reportDigest.join("；"),
      ],
    }
  }

  return {
    outputs: {},
    summaryLines: [`${toolName} 已执行，但当前没有定义额外的本地结果展开逻辑。`],
  }
}

export function runProjectSmokeWorkflow(
  projectId: string,
  scenario: "baseline" | "with-approval",
): McpWorkflowSmokePayload | null {
  const project = getStoredProjectById(projectId)

  if (!project) {
    return null
  }

  const workflowId = buildWorkflowId()
  const outputs: McpWorkflowSmokePayload["outputs"] = {}
  const runs: McpRunRecord[] = []

  function executeStep(input: McpDispatchInput) {
    const payload = dispatchStoredMcpRun(projectId, input)

    if (!payload) {
      return {
        status: "blocked" as const,
      }
    }

    if (payload.approval || payload.run.status === "待审批") {
      runs.push(payload.run)

      return {
        status: "waiting_approval" as const,
        run: payload.run,
        approval: payload.approval,
      }
    }

    if (payload.run.status === "已阻塞") {
      runs.push(payload.run)

      return {
        status: "blocked" as const,
        run: payload.run,
      }
    }

    const toolOutput = runLocalTool(payload.run.toolName, {
      seed: project.seed,
      outputs,
    })
    Object.assign(outputs, toolOutput.outputs)

    const updatedRun =
      updateStoredMcpRunResult(payload.run.id, toolOutput.summaryLines) ?? payload.run
    runs.push(updatedRun)

    return {
      status: "completed" as const,
      run: updatedRun,
    }
  }

  const baselineSteps: McpDispatchInput[] = [
    {
      capability: "目标解析类",
      requestedAction: "标准化种子目标",
      target: project.seed,
      riskLevel: "低",
    },
    {
      capability: "DNS / 子域 / 证书情报类",
      requestedAction: "补采证书与子域情报",
      target: project.seed,
      riskLevel: "低",
    },
    {
      capability: "Web 页面探测类",
      requestedAction: "补采页面入口与响应特征",
      target: project.seed,
      riskLevel: "低",
    },
  ]

  for (const step of baselineSteps) {
    const result = executeStep(step)

    if (result.status === "waiting_approval") {
      return {
        workflowId,
        status: "waiting_approval",
        runs,
        blockedRun: result.run,
        approval: result.approval,
        outputs,
      }
    }

    if (result.status === "blocked") {
      return {
        workflowId,
        status: "blocked",
        runs,
        blockedRun: result.run,
        outputs,
      }
    }
  }

  if (scenario === "with-approval") {
    const approvalTarget = outputs.webEntries?.[0] ?? project.seed
    const result = executeStep({
      capability: "受控验证类",
      requestedAction: "受控登录绕过验证",
      target: approvalTarget,
      riskLevel: "高",
    })

    if (result.status === "waiting_approval") {
      return {
        workflowId,
        status: "waiting_approval",
        runs,
        blockedRun: result.run,
        approval: result.approval,
        outputs,
      }
    }

    if (result.status === "blocked") {
      return {
        workflowId,
        status: "blocked",
        runs,
        blockedRun: result.run,
        outputs,
      }
    }
  }

  const reportResult = executeStep({
    capability: "报告导出类",
    requestedAction: "导出基础流程测试报告",
    target: project.code,
    riskLevel: "低",
  })

  if (reportResult.status === "waiting_approval") {
    return {
      workflowId,
      status: "waiting_approval",
      runs,
      blockedRun: reportResult.run,
      approval: reportResult.approval,
      outputs,
    }
  }

  if (reportResult.status === "blocked") {
    return {
      workflowId,
      status: "blocked",
      runs,
      blockedRun: reportResult.run,
      outputs,
    }
  }

  return {
    workflowId,
    status: "completed",
    runs,
    outputs,
  }
}
