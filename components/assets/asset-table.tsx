import Link from "next/link"
import { Search } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AssetRecord } from "@/lib/prototype-types"

function getScopeTone(scopeStatus: AssetRecord["scopeStatus"]) {
  if (scopeStatus === "已纳入") {
    return "success" as const
  }

  if (scopeStatus === "待确认") {
    return "warning" as const
  }

  return "info" as const
}

export function AssetTable({ records }: { records: AssetRecord[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="搜索资产标签、主机、项目或证据编号..."
            className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
        <Input
          value="类型筛选：service / api / port"
          readOnly
          className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        />
        <Input
          value="范围状态：已纳入 / 待确认 / 待复核"
          readOnly
          className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
            <TableRow>
              <TableHead>资产</TableHead>
              <TableHead>主机 / 所属</TableHead>
              <TableHead>画像</TableHead>
              <TableHead>关联项目</TableHead>
              <TableHead>范围状态</TableHead>
              <TableHead>最近发现</TableHead>
              <TableHead className="text-right">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((asset) => (
              <TableRow key={asset.id} className="bg-white/90 dark:bg-slate-950/70">
                <TableCell>
                  <p className="font-medium text-slate-950 dark:text-white">{asset.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    {asset.type}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="font-medium text-slate-950 dark:text-white">{asset.host}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{asset.ownership}</p>
                </TableCell>
                <TableCell className="max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {asset.profile}
                </TableCell>
                <TableCell>{asset.projectName}</TableCell>
                <TableCell>
                  <StatusBadge tone={getScopeTone(asset.scopeStatus)}>{asset.scopeStatus}</StatusBadge>
                </TableCell>
                <TableCell>{asset.lastSeen}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm" className="rounded-full border-slate-300 dark:border-slate-700">
                    <Link href={`/assets/${asset.id}`}>查看画像</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
