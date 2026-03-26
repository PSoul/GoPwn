import { dispatchStoredMcpRun } from "@/lib/mcp-gateway-repository"
import { drainStoredSchedulerTasks } from "@/lib/mcp-scheduler-service"
import { getStoredProjectById } from "@/lib/project-repository"
import type {
  McpDispatchInput,
  McpRunRecord,
  McpWorkflowSmokePayload,
} from "@/lib/prototype-types"

function buildWorkflowId() {
  return `workflow-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

export async function runProjectSmokeWorkflow(
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

  async function executeStep(input: McpDispatchInput) {
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

    const drained = await drainStoredSchedulerTasks({
      priorOutputs: outputs,
      runId: payload.run.id,
    })
    const updatedRun = drained.runs.at(-1) ?? payload.run
    Object.assign(outputs, drained.outputs)

    runs.push(updatedRun)

    return {
      status: drained.status === "completed" ? ("completed" as const) : ("blocked" as const),
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
    const result = await executeStep(step)

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
    const result = await executeStep({
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

  const reportResult = await executeStep({
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
