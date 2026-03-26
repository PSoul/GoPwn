import { Plus, Search } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
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
import { projects } from "@/lib/prototype-data"

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="项目管理"
        description="查看项目当前主阶段、阻塞状态和待审批压力，并从这里进入项目详情或创建新项目。"
        actions={
          <Button className="rounded-full bg-slate-950 px-5 dark:bg-sky-500 dark:text-slate-950">
            <Plus className="mr-2 h-4 w-4" />
            新建项目
          </Button>
        }
      />

      <SectionCard title="项目列表" eyebrow="Project Queue" description="用结构化表格承接项目增删改查和阶段筛选，不把项目详情做成抽象入口。">
        <div className="mb-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="搜索项目名称、目标种子或审批单号..." className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 dark:border-slate-800 dark:bg-slate-900" />
          </div>
          <Input value="阶段筛选：全部阶段" readOnly className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
          <Input value="状态筛选：运行中 / 已阻塞" readOnly className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
              <TableRow>
                <TableHead>项目名称</TableHead>
                <TableHead>目标种子</TableHead>
                <TableHead>当前主阶段</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>待审批</TableHead>
                <TableHead>风险摘要</TableHead>
                <TableHead>最近更新时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id} className="bg-white/90 dark:bg-slate-950/70">
                  <TableCell className="font-medium text-slate-950 dark:text-white">{project.name}</TableCell>
                  <TableCell>{project.seed}</TableCell>
                  <TableCell>{project.stage}</TableCell>
                  <TableCell>
                    <StatusBadge tone={project.status === "已阻塞" ? "danger" : "info"}>{project.status}</StatusBadge>
                  </TableCell>
                  <TableCell>{project.pendingApprovals}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-300">{project.riskSummary}</TableCell>
                  <TableCell>{project.lastUpdated}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  )
}
