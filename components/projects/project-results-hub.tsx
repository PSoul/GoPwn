import Link from "next/link"
import { ArrowRight, Globe, Network, ShieldAlert } from "lucide-react"

import type { AssetRecord, ProjectDetailRecord, ProjectRecord } from "@/lib/prototype-types"

const resultSections = [
  {
    key: "domains" as const,
    title: "域名",
    icon: Globe,
    types: ["domain", "subdomain"],
  },
  {
    key: "sites" as const,
    title: "站点",
    icon: Globe,
    types: ["entry", "web", "api"],
  },
  {
    key: "network" as const,
    title: "端口",
    icon: Network,
    types: ["host", "ip", "port", "service"],
  },
  {
    key: "findings" as const,
    title: "漏洞",
    icon: ShieldAlert,
    types: null,
  },
]

const hrefMap: Record<string, string> = {
  domains: "domains",
  sites: "sites",
  network: "network",
  findings: "findings",
}

export function ProjectResultsHub({
  project,
  detail,
  assets,
}: {
  project: ProjectRecord
  detail: ProjectDetailRecord
  assets: AssetRecord[]
}) {
  const counts: Record<string, number> = {
    domains: assets.filter((a) => ["domain", "subdomain"].includes(a.type)).length,
    sites: assets.filter((a) => ["entry", "web", "api"].includes(a.type)).length,
    network: assets.filter((a) => ["host", "ip", "port", "service"].includes(a.type)).length,
    findings: detail.findings.length,
  }

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {resultSections.map((section) => {
        const count = counts[section.key]
        const Icon = section.icon
        return (
          <Link
            key={section.key}
            href={`/projects/${project.id}/results/${hrefMap[section.key]}`}
            className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-950 dark:text-white">{section.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {count > 0 ? `${count} 条记录` : "暂无数据"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )
      })}
    </div>
  )
}
