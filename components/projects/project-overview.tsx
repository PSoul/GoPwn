"use client"

import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { StatusBadge } from "@/components/shared/status-badge"
import { ProjectSummary } from "@/components/projects/project-summary"
import type { Project, Finding, Asset, Severity, AssetKind } from "@/lib/generated/prisma"
import { SEVERITY_LABELS, ASSET_KIND_LABELS } from "@/lib/types/labels"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "neutral",
}

type Props = {
  project: Project
  initialFindings: Finding[]
  initialAssets: Asset[]
}

export function ProjectOverview({ project, initialFindings, initialAssets }: Props) {
  // Group findings by severity
  const findingsBySeverity = new Map<Severity, number>()
  for (const f of initialFindings) {
    findingsBySeverity.set(f.severity, (findingsBySeverity.get(f.severity) ?? 0) + 1)
  }

  // Group assets by kind
  const assetsByKind = new Map<AssetKind, number>()
  for (const a of initialAssets) {
    assetsByKind.set(a.kind, (assetsByKind.get(a.kind) ?? 0) + 1)
  }

  // Map asset kinds to sub-tab query params
  const kindToTab: Partial<Record<AssetKind, string>> = {
    domain: "domains",
    subdomain: "domains",
    ip: "hosts",
    port: "hosts",
    service: "hosts",
    webapp: "web",
    api_endpoint: "web",
  }

  return (
    <div className="space-y-6 p-4">
      <ProjectSummary project={project} />

      {/* Security Findings Summary */}
      <section>
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">安全发现</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {(["critical", "high", "medium", "low", "info"] as Severity[]).map((sev) => {
            const count = findingsBySeverity.get(sev) ?? 0
            return (
              <Link
                key={sev}
                href={`/projects/${project.id}/findings`}
                className="rounded-xl border border-slate-200/80 bg-white p-3 hover:border-slate-300 transition-colors dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <StatusBadge tone={severityTone[sev]}>{SEVERITY_LABELS[sev]}</StatusBadge>
                </div>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">{count}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Asset Discovery Summary */}
      <section>
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">资产发现</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {(["domain", "subdomain", "ip", "port", "service", "webapp", "api_endpoint"] as AssetKind[]).map((kind) => {
            const count = assetsByKind.get(kind) ?? 0
            if (count === 0) return null
            const tab = kindToTab[kind] ?? "domains"
            return (
              <Link
                key={kind}
                href={`/projects/${project.id}/assets?tab=${tab}`}
                className="rounded-xl border border-slate-200/80 bg-white p-3 hover:border-slate-300 transition-colors dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{ASSET_KIND_LABELS[kind]}</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">{count}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">最近活动</h3>
        <div className="space-y-2">
          {initialFindings.slice(0, 5).map((f) => (
            <Link
              key={f.id}
              href={`/projects/${project.id}/vuln/${f.id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 hover:border-slate-300 transition-colors dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"
            >
              <ShieldAlert className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{f.title}</span>
              <StatusBadge tone={severityTone[f.severity]}>{SEVERITY_LABELS[f.severity]}</StatusBadge>
              <span className="text-xs text-slate-500 dark:text-slate-500">{new Date(f.createdAt).toLocaleDateString("zh-CN")}</span>
            </Link>
          ))}
          {initialFindings.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">暂无安全发现</p>
          )}
        </div>
      </section>
    </div>
  )
}
