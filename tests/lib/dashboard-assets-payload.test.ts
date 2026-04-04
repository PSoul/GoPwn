import { describe, expect, it } from "vitest"

import { getDashboardPayload, buildAssetViews } from "@/lib/infra/api-compositions"
import { listStoredAssets, upsertStoredAssets } from "@/lib/data/asset-repository"
import { createStoredProject } from "@/lib/project/project-repository"
import { upsertStoredEvidence } from "@/lib/data/evidence-repository"
import { upsertStoredProjectFindings } from "@/lib/project/project-results-repository"
import { prisma } from "@/lib/infra/prisma"

describe("dashboard and asset payload regrouping", () => {
  it("exposes four KPI cards, recent result updates, and typed asset previews on the dashboard", async () => {
    const created = await createStoredProject({
      name: "Dashboard 项目",
      targetInput: "demo.example.com",
      description: "仪表盘聚合测试",
    } as never)

    // Update project counters directly via Prisma
    await prisma.project.update({
      where: { id: created.project.id },
      data: {
        status: "运行中",
        pendingApprovals: 1,
        assetCount: 4,
        evidenceCount: 2,
      },
    })

    await upsertStoredAssets([
      {
        id: "asset-domain-1",
        projectId: created.project.id,
        projectName: created.project.name,
        type: "entry",
        label: "http://demo.example.com/login",
        profile: "Login Page · 200",
        scopeStatus: "已确认",
        lastSeen: "2026-03-27 10:01",
        host: "demo.example.com",
        ownership: "项目目标",
        confidence: "高",
        exposure: "公开入口",
        linkedEvidenceId: "evidence-1",
        linkedTaskTitle: "识别入口",
        issueLead: "首页登录框",
        relations: [],
      },
      {
        id: "asset-ip-1",
        projectId: created.project.id,
        projectName: created.project.name,
        type: "ip",
        label: "10.10.10.10",
        profile: "主机",
        scopeStatus: "已确认",
        lastSeen: "2026-03-27 10:02",
        host: "10.10.10.10",
        ownership: "项目目标",
        confidence: "高",
        exposure: "公网",
        linkedEvidenceId: "evidence-2",
        linkedTaskTitle: "主机识别",
        issueLead: "开放主机",
        relations: [],
      },
      {
        id: "asset-port-1",
        projectId: created.project.id,
        projectName: created.project.name,
        type: "port",
        label: "10.10.10.10:443",
        profile: "https / nginx",
        scopeStatus: "已确认",
        lastSeen: "2026-03-27 10:03",
        host: "10.10.10.10",
        ownership: "项目目标",
        confidence: "高",
        exposure: "443/tcp",
        linkedEvidenceId: "evidence-2",
        linkedTaskTitle: "端口识别",
        issueLead: "TLS 入口",
        relations: [],
      },
      {
        id: "asset-fingerprint-1",
        projectId: created.project.id,
        projectName: created.project.name,
        type: "service",
        label: "nginx 1.25",
        profile: "fingerprint",
        scopeStatus: "需人工判断",
        lastSeen: "2026-03-27 10:04",
        host: "10.10.10.10:443",
        ownership: "指纹候选",
        confidence: "中",
        exposure: "Server header",
        linkedEvidenceId: "evidence-2",
        linkedTaskTitle: "指纹复核",
        issueLead: "headers",
        relations: [],
      },
    ])

    await upsertStoredEvidence([
      {
        id: "evidence-1",
        projectId: created.project.id,
        projectName: created.project.name,
        title: "识别到 Web 入口",
        source: "web-surface-map",
        confidence: "高",
        conclusion: "结果已归档",
        linkedApprovalId: "",
        rawOutput: ["200 OK"],
        screenshotNote: "login",
        structuredSummary: ["发现登录页"],
        linkedTaskTitle: "识别入口",
        linkedAssetLabel: "demo.example.com",
        timeline: ["2026-03-27 10:01"],
        verdict: "入口已确认",
      },
      {
        id: "evidence-2",
        projectId: created.project.id,
        projectName: created.project.name,
        title: "Actuator 端点暴露",
        source: "http-validation",
        confidence: "高",
        conclusion: "已确认暴露",
        linkedApprovalId: "",
        rawOutput: ["200 OK /actuator"],
        screenshotNote: "",
        structuredSummary: ["Actuator 端点可访问"],
        linkedTaskTitle: "指纹复核",
        linkedAssetLabel: "",
        timeline: ["2026-03-27 10:04"],
        verdict: "已确认",
      },
    ])

    await upsertStoredProjectFindings([
      {
        id: "finding-1",
        projectId: created.project.id,
        severity: "中危",
        status: "已确认",
        title: "Spring Actuator 暴露",
        summary: "存在未授权访问风险。",
        affectedSurface: "/actuator",
        evidenceId: "evidence-2",
        owner: "研究员席位",
        createdAt: "2026-03-27 10:00",
        updatedAt: "2026-03-27 10:05",
        rawOutput: [],
      },
    ])

    await prisma.approval.create({
      data: {
        id: "approval-1",
        projectId: created.project.id,
        projectName: created.project.name,
        target: "/actuator",
        actionType: "高风险验证",
        riskLevel: "高",
        rationale: "发现敏感入口",
        impact: "可能触发额外交互",
        mcpCapability: "受控验证类",
        tool: "auth-guard-check",
        status: "待处理",
        parameterSummary: "GET /actuator",
        prerequisites: [],
        stopCondition: "失败即停",
        blockingImpact: "阻塞漏洞确认",
        queuePosition: 1,
      },
    })

    const payload = await getDashboardPayload() as unknown as Record<string, unknown>

    expect((payload.metrics as Array<{ label: string }>).map((item) => item.label)).toEqual([
      "项目总数",
      "已发现资产",
      "已发现漏洞",
      "待审批动作",
    ])
    expect(payload).toHaveProperty("recentResults")
    expect(payload).toHaveProperty("assetViews")
    expect((payload.assetViews as Array<{ key: string }>).map((item) => item.key)).toEqual([
      "domains-web",
      "hosts-ip",
      "ports-services",
      "fingerprints",
    ])
    expect((payload.assetViews as Array<{ key: string; count: number }>)[0]?.count).toBe(1)
  })

  it("returns typed asset-center views instead of a single undifferentiated list", async () => {
    const created = await createStoredProject({
      name: "资产视图项目",
      targetInput: "demo.example.com",
      description: "资产中心视图测试",
    } as never)

    await upsertStoredAssets([
      {
        id: "asset-domain-1",
        projectId: created.project.id,
        projectName: created.project.name,
        type: "entry",
        label: "http://demo.example.com/login",
        profile: "Login Page · 200",
        scopeStatus: "已确认",
        lastSeen: "2026-03-27 10:01",
        host: "demo.example.com",
        ownership: "项目目标",
        confidence: "高",
        exposure: "公开入口",
        linkedEvidenceId: "evidence-1",
        linkedTaskTitle: "识别入口",
        issueLead: "首页登录框",
        relations: [],
      },
      {
        id: "asset-port-1",
        projectId: created.project.id,
        projectName: created.project.name,
        type: "port",
        label: "10.10.10.10:443",
        profile: "https / nginx",
        scopeStatus: "需人工判断",
        lastSeen: "2026-03-27 10:03",
        host: "10.10.10.10",
        ownership: "项目目标",
        confidence: "高",
        exposure: "443/tcp",
        linkedEvidenceId: "evidence-2",
        linkedTaskTitle: "端口识别",
        issueLead: "TLS 入口",
        relations: [],
      },
    ])

    const items = await listStoredAssets()
    const payload = { items, total: items.length, views: buildAssetViews(items) } as unknown as Record<string, unknown>

    expect(payload).toHaveProperty("views")
    expect((payload.views as Array<{ key: string }>).map((view) => view.key)).toEqual([
      "domains-web",
      "hosts-ip",
      "ports-services",
      "fingerprints",
      "pending-review",
    ])
    expect((payload.views as Array<{ key: string; count: number }>)[0]?.count).toBe(1)
  })

  it("deduplicates visually identical recent result records before rendering the dashboard timeline", async () => {
    const created = await createStoredProject({
      name: "Recent 去重项目",
      targetInput: "demo.example.com",
      description: "最近结果更新去重测试",
    } as never)

    await upsertStoredEvidence([
      {
        id: "evidence-1",
        projectId: created.project.id,
        projectName: created.project.name,
        title: "Web 入口与响应特征识别",
        source: "web-surface-map",
        confidence: "高",
        conclusion: "结果已归档",
        linkedApprovalId: "",
        rawOutput: ["200 OK"],
        screenshotNote: "page",
        structuredSummary: ["发现入口"],
        linkedTaskTitle: "识别入口",
        linkedAssetLabel: "demo.example.com",
        timeline: ["2026-03-27 10:01"],
        verdict: "入口已确认",
      },
      {
        id: "evidence-2",
        projectId: created.project.id,
        projectName: created.project.name,
        title: "Web 入口与响应特征识别",
        source: "web-surface-map",
        confidence: "高",
        conclusion: "结果已归档",
        linkedApprovalId: "",
        rawOutput: ["200 OK"],
        screenshotNote: "page",
        structuredSummary: ["发现入口"],
        linkedTaskTitle: "识别入口",
        linkedAssetLabel: "demo.example.com",
        timeline: ["2026-03-27 10:01"],
        verdict: "入口已确认",
      },
    ])

    const payload = await getDashboardPayload()

    expect(payload.recentResults.filter((item) => item.title === "Web 入口与响应特征识别")).toHaveLength(1)
  })
})
