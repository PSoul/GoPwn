import { listStoredProjectApprovals, updateStoredApprovalDecision } from "@/lib/data/approval-repository"
import { listStoredAssets } from "@/lib/data/asset-repository"
import { listStoredEvidence } from "@/lib/data/evidence-repository"
import { dispatchStoredMcpRun, listStoredMcpRuns } from "@/lib/mcp/mcp-gateway-repository"
import { drainStoredSchedulerTasks, syncStoredSchedulerTaskAfterApprovalDecision } from "@/lib/mcp/mcp-scheduler-service"
import { createStoredProject, getStoredProjectById, getStoredProjectDetailById } from "@/lib/project/project-repository"
import { listStoredProjectFindings } from "@/lib/project/project-results-repository"
import { prisma } from "@/lib/infra/prisma"
import { fromMcpToolRecord } from "@/lib/infra/prisma-transforms"
import { runProjectSmokeWorkflow } from "@/lib/mcp/mcp-workflow-service"
import type {
  ApprovalRecord,
  AssetRecord,
  EvidenceRecord,
  McpDispatchInput,
  McpRunRecord,
  McpToolRecord,
  ProjectDetailRecord,
  ProjectFindingRecord,
  ProjectMutationInput,
  ProjectRecord,
} from "@/lib/prototype-types"

export const baseProjectInput: ProjectMutationInput = {
  name: "测试项目",
  targetInput: "http://127.0.0.1:3000",
  description: "仅用于自动化测试。",
}

export function buildProjectInput(overrides: Partial<ProjectMutationInput> = {}): ProjectMutationInput {
  return {
    ...baseProjectInput,
    ...overrides,
  }
}

export const workflowReadyMcpToolFixtures: McpToolRecord[] = [
  {
    id: "tool-seed-normalizer",
    capability: "目标解析类",
    toolName: "seed-normalizer",
    version: "1.0.0",
    riskLevel: "低",
    status: "启用",
    category: "基础编排",
    description: "标准化项目种子目标。",
    inputMode: "json",
    outputMode: "json",
    boundary: "平台内部处理",
    requiresApproval: false,
    endpoint: "mcp://seed-normalizer",
    owner: "测试夹具",
    defaultConcurrency: "1",
    rateLimit: "n/a",
    timeout: "5s",
    retry: "0",
    lastCheck: "2026-03-27 10:00",
    notes: "测试用最小目标解析工具。",
  },
  {
    id: "tool-dns-census",
    capability: "DNS / 子域 / 证书情报类",
    toolName: "dns-census",
    version: "1.0.0",
    riskLevel: "低",
    status: "启用",
    category: "情报采集",
    description: "执行被动 DNS / TLS 情报采集。",
    inputMode: "json",
    outputMode: "json",
    boundary: "外部目标交互",
    requiresApproval: false,
    endpoint: "mcp://dns-census",
    owner: "测试夹具",
    defaultConcurrency: "1",
    rateLimit: "20 req/min",
    timeout: "10s",
    retry: "1 次",
    lastCheck: "2026-03-27 10:00",
    notes: "测试用最小 DNS 能力工具。",
  },
  {
    id: "tool-web-surface-map",
    capability: "Web 页面探测类",
    toolName: "web-surface-map",
    version: "1.0.0",
    riskLevel: "低",
    status: "启用",
    category: "入口识别",
    description: "采集页面入口与响应特征。",
    inputMode: "json",
    outputMode: "json",
    boundary: "外部目标交互",
    requiresApproval: false,
    endpoint: "mcp://web-surface-map",
    owner: "测试夹具",
    defaultConcurrency: "1",
    rateLimit: "10 req/min",
    timeout: "10s",
    retry: "1 次",
    lastCheck: "2026-03-27 10:00",
    notes: "测试用最小 Web 入口能力工具。",
  },
  {
    id: "tool-auth-guard-check",
    capability: "受控验证类",
    toolName: "auth-guard-check",
    version: "1.0.0",
    riskLevel: "高",
    status: "启用",
    category: "受控验证",
    description: "执行需要审批的高风险受控验证。",
    inputMode: "json",
    outputMode: "json",
    boundary: "外部目标交互",
    requiresApproval: true,
    endpoint: "mcp://auth-guard-check",
    owner: "测试夹具",
    defaultConcurrency: "1",
    rateLimit: "2 req/min",
    timeout: "15s",
    retry: "0",
    lastCheck: "2026-03-27 10:00",
    notes: "测试用审批链路工具。",
  },
  {
    id: "tool-report-exporter",
    capability: "报告导出类",
    toolName: "report-exporter",
    version: "1.0.0",
    riskLevel: "低",
    status: "启用",
    category: "结果导出",
    description: "导出流程测试报告摘要。",
    inputMode: "json",
    outputMode: "json",
    boundary: "平台内部处理",
    requiresApproval: false,
    endpoint: "mcp://report-exporter",
    owner: "测试夹具",
    defaultConcurrency: "1",
    rateLimit: "n/a",
    timeout: "5s",
    retry: "0",
    lastCheck: "2026-03-27 10:00",
    notes: "测试用报告导出工具。",
  },
]

export type WorkflowFixture = {
  project: ProjectRecord
  detail: ProjectDetailRecord
  approvals: ApprovalRecord[]
  assets: AssetRecord[]
  evidence: EvidenceRecord[]
  findings: ProjectFindingRecord[]
  runs: McpRunRecord[]
}

async function readWorkflowFixture(projectId: string): Promise<WorkflowFixture> {
  const project = await getStoredProjectById(projectId)
  const detail = await getStoredProjectDetailById(projectId)

  if (!project || !detail) {
    throw new Error(`fixture project not found: ${projectId}`)
  }

  return {
    project,
    detail,
    approvals: await listStoredProjectApprovals(projectId),
    assets: await listStoredAssets(projectId),
    evidence: await listStoredEvidence(projectId),
    findings: await listStoredProjectFindings(projectId),
    runs: await listStoredMcpRuns(projectId),
  }
}

export async function seedWorkflowReadyMcpTools(overrides: McpToolRecord[] = workflowReadyMcpToolFixtures) {
  for (const tool of overrides) {
    const data = fromMcpToolRecord(tool)
    await prisma.mcpTool.upsert({
      where: { id: tool.id },
      create: data,
      update: data,
    })
  }

  return overrides
}

export async function createStoredProjectFixture(overrides: Partial<ProjectMutationInput> = {}) {
  const payload = await createStoredProject(
    buildProjectInput({
      targetInput: "localhost\nhttps://localhost/login\napi.localhost",
      description: "测试夹具创建项目后，将通过最小 MCP 流程同步资产、证据和发现。",
      ...overrides,
    }),
  )

  return payload
}

export async function createWorkflowFixture(
  options: {
    projectOverrides?: Partial<ProjectMutationInput>
    workflow?: "baseline" | "with-approval"
    approveHighRisk?: boolean
    exportReportAfterApproval?: boolean
  } = {},
) {
  await seedWorkflowReadyMcpTools()

  const payload = await createStoredProjectFixture(options.projectOverrides)
  const workflow = options.workflow ?? (options.approveHighRisk ? "with-approval" : "baseline")
  const result = await runProjectSmokeWorkflow(payload.project.id, workflow)

  if (!result) {
    throw new Error(`workflow fixture failed to start for ${payload.project.id}`)
  }

  if (options.approveHighRisk) {
    if (!result.approval) {
      throw new Error(`workflow fixture expected approval for ${payload.project.id}`)
    }

    const approval = await updateStoredApprovalDecision(result.approval.id, { decision: "已批准" })

    if (!approval) {
      throw new Error(`failed to approve workflow fixture for ${payload.project.id}`)
    }

    const resumedTask = await syncStoredSchedulerTaskAfterApprovalDecision(approval)

    if (resumedTask) {
      await drainStoredSchedulerTasks({ runId: result.blockedRun?.id ?? result.runs.at(-1)?.id })
    }

    if (options.exportReportAfterApproval) {
      const project = await getStoredProjectById(payload.project.id)

      if (!project) {
        throw new Error(`fixture project disappeared before report export: ${payload.project.id}`)
      }

      const reportPayload = await dispatchStoredMcpRun(payload.project.id, {
        capability: "报告导出类",
        requestedAction: "导出基础流程测试报告",
        target: project.code,
        riskLevel: "低",
      })

      if (reportPayload?.run.status === "执行中") {
        await drainStoredSchedulerTasks({ runId: reportPayload.run.id })
      }
    }
  }

  return readWorkflowFixture(payload.project.id)
}

export async function createApprovedWorkflowFixture(projectOverrides: Partial<ProjectMutationInput> = {}) {
  return createWorkflowFixture({
    projectOverrides,
    workflow: "with-approval",
    approveHighRisk: true,
    exportReportAfterApproval: true,
  })
}

export async function dispatchFixtureRun(projectId: string, input: McpDispatchInput) {
  const payload = await dispatchStoredMcpRun(projectId, input)

  if (!payload) {
    throw new Error(`failed to dispatch fixture MCP run for ${projectId}`)
  }

  return payload
}
