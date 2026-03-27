import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { listAssetsPayload, getDashboardPayload } from "@/lib/prototype-api"
import { createStoredProject } from "@/lib/project-repository"
import { readPrototypeStore, writePrototypeStore } from "@/lib/prototype-store"

describe("dashboard and asset payload regrouping", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "llm-pentest-dashboard-"))
    process.env.PROTOTYPE_DATA_DIR = tempDir
  })

  afterEach(() => {
    delete process.env.PROTOTYPE_DATA_DIR
    rmSync(tempDir, { force: true, recursive: true })
  })

  it("exposes four KPI cards, recent result updates, and typed asset previews on the dashboard", () => {
    const created = createStoredProject({
      name: "Dashboard 项目",
      targetInput: "demo.example.com",
      description: "仪表盘聚合测试",
    } as never)
    const store = readPrototypeStore()

    store.projects[0] = {
      ...store.projects[0],
      status: "运行中",
      pendingApprovals: 1,
      assetCount: 4,
      evidenceCount: 2,
    }
    store.assets = [
      {
        id: "asset-domain-1",
        projectId: created.project.id,
        projectName: created.project.name,
        type: "entry",
        label: "http://demo.example.com/login",
        profile: "Login Page · 200",
        scopeStatus: "已纳入",
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
        scopeStatus: "已纳入",
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
        scopeStatus: "已纳入",
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
        scopeStatus: "待复核",
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
    ]
    store.projectFindings = [
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
        updatedAt: "2026-03-27 10:05",
      },
    ]
    store.evidenceRecords = [
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
    ]
    store.approvals = [
      {
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
        submittedAt: "2026-03-27 10:05",
      },
    ]
    writePrototypeStore(store)

    const payload = getDashboardPayload() as Record<string, unknown>

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

  it("returns typed asset-center views instead of a single undifferentiated list", () => {
    const created = createStoredProject({
      name: "资产视图项目",
      targetInput: "demo.example.com",
      description: "资产中心视图测试",
    } as never)
    const store = readPrototypeStore()

    store.assets = [
      {
        id: "asset-domain-1",
        projectId: created.project.id,
        projectName: created.project.name,
        type: "entry",
        label: "http://demo.example.com/login",
        profile: "Login Page · 200",
        scopeStatus: "已纳入",
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
        scopeStatus: "待复核",
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
    ]
    writePrototypeStore(store)

    const payload = listAssetsPayload() as Record<string, unknown>

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

  it("deduplicates visually identical recent result records before rendering the dashboard timeline", () => {
    const created = createStoredProject({
      name: "Recent 去重项目",
      targetInput: "demo.example.com",
      description: "最近结果更新去重测试",
    } as never)
    const store = readPrototypeStore()

    store.evidenceRecords = [
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
    ]
    writePrototypeStore(store)

    const payload = getDashboardPayload()

    expect(payload.recentResults.filter((item) => item.title === "Web 入口与响应特征识别")).toHaveLength(1)
  })
})
