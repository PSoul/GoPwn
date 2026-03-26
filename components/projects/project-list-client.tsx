"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArchiveX, ExternalLink, Pencil, Search } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProjectRecord } from "@/lib/prototype-types"

const statusToneMap = {
  运行中: "info",
  待处理: "warning",
  已阻塞: "danger",
  已完成: "success",
} as const

type ProjectListClientProps = {
  projects: ProjectRecord[]
}

export function ProjectListClient({ projects }: ProjectListClientProps) {
  const [keyword, setKeyword] = useState("")
  const [stageFilter, setStageFilter] = useState("全部阶段")
  const [statusFilter, setStatusFilter] = useState("全部状态")
  const [pendingArchive, setPendingArchive] = useState<ProjectRecord | null>(null)
  const [lastArchivedProject, setLastArchivedProject] = useState<string | null>(null)

  const stageOptions = useMemo(
    () => ["全部阶段", ...Array.from(new Set(projects.map((project) => project.stage)))],
    [projects],
  )

  const filteredProjects = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return projects.filter((project) => {
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        [project.name, project.seed, project.code, project.targetSummary, project.riskSummary]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword)

      const matchesStage = stageFilter === "全部阶段" || project.stage === stageFilter
      const matchesStatus = statusFilter === "全部状态" || project.status === statusFilter

      return matchesKeyword && matchesStage && matchesStatus
    })
  }, [keyword, projects, stageFilter, statusFilter])

  const summaryCards = [
    { label: "筛选结果", value: `${filteredProjects.length}`, note: "当前可见项目" },
    {
      label: "阻塞项目",
      value: `${filteredProjects.filter((project) => project.status === "已阻塞").length}`,
      note: "需要优先清障",
    },
    {
      label: "审批压力",
      value: `${filteredProjects.reduce((sum, project) => sum + project.pendingApprovals, 0)}`,
      note: "待处理审批动作",
    },
    {
      label: "开放任务",
      value: `${filteredProjects.reduce((sum, project) => sum + project.openTasks, 0)}`,
      note: "需研究员继续接管",
    },
  ]

  return (
    <SectionCard title="项目列表" description="项目列表现在支持真实搜索、筛选、详情跳转、编辑和关闭动作，作为项目模块的管理入口。">
      <div className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr_0.8fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索项目名称、目标种子、项目编号或风险摘要..."
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <SelectValue placeholder="筛选阶段" />
            </SelectTrigger>
            <SelectContent>
              {stageOptions.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <SelectValue placeholder="筛选状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="全部状态">全部状态</SelectItem>
              <SelectItem value="运行中">运行中</SelectItem>
              <SelectItem value="待处理">待处理</SelectItem>
              <SelectItem value="已阻塞">已阻塞</SelectItem>
              <SelectItem value="已完成">已完成</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{card.value}</div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{card.note}</p>
            </div>
          ))}
        </div>

        {lastArchivedProject ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/80 dark:bg-amber-950/30 dark:text-amber-100">
            已记录原型动作：{lastArchivedProject} 已进入“关闭/归档”确认流程。当前阶段仍以原型展示为主，不会真的删除数据。
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-slate-800">
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-slate-900/70">
              <TableRow>
                <TableHead>项目 / 编号</TableHead>
                <TableHead>目标与负责人</TableHead>
                <TableHead>当前主阶段</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>审批 / 任务</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">管理动作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow key={project.id} className="bg-white/90 align-top dark:bg-slate-950/70">
                  <TableCell className="min-w-[240px]">
                    <div className="space-y-1">
                      <Link href={`/projects/${project.id}`} className="font-medium text-slate-950 hover:text-slate-700 dark:text-white dark:hover:text-slate-200">
                        {project.name}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{project.code}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{project.summary}</p>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{project.targetSummary}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        种子 {project.seed} · {project.targetType}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">负责人 {project.owner}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{project.stage}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{project.riskSummary}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <StatusBadge tone={statusToneMap[project.status]}>{project.status}</StatusBadge>
                      <div className="flex flex-wrap gap-1">
                        {project.tags.slice(0, 2).map((tag) => (
                          <StatusBadge key={tag} tone="neutral" className="bg-slate-50">
                            {tag}
                          </StatusBadge>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      <p>{project.pendingApprovals} 个待审批</p>
                      <p>{project.openTasks} 个开放任务</p>
                      <p>{project.assetCount} 个资产 / {project.evidenceCount} 条证据</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      <p>{project.lastUpdated}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{project.lastActor}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button asChild size="sm" variant="outline" className="rounded-xl">
                        <Link href={`/projects/${project.id}`}>
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          详情
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="rounded-xl">
                        <Link href={`/projects/${project.id}/edit`}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          编辑
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setPendingArchive(project)}>
                        <ArchiveX className="mr-1 h-3.5 w-3.5" />
                        归档
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={Boolean(pendingArchive)} onOpenChange={(open) => !open && setPendingArchive(null)}>
        <AlertDialogContent className="rounded-[28px] border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle>确认关闭项目</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingArchive?.name} 将被标记为“关闭/归档候选”。在这版前端原型里，我们保留数据，只记录管理动作，不做硬删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (pendingArchive) {
                  setLastArchivedProject(pendingArchive.name)
                }
                setPendingArchive(null)
              }}
            >
              确认归档
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}
