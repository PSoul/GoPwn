"use client"

import { useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { ProjectCard } from "@/components/projects/project-card"
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
import { Pagination } from "@/components/shared/pagination"
import type { ProjectRecord } from "@/lib/prototype-types"
import { apiFetch } from "@/lib/infra/api-client"

const PAGE_SIZE = 12

type ProjectListClientProps = {
  projects: ProjectRecord[]
}

export function ProjectListClient({ projects }: ProjectListClientProps) {
  const [projectItems, setProjectItems] = useState(projects)
  const [keyword, setKeyword] = useState("")
  const [stageFilter, setStageFilter] = useState("全部阶段")
  const [statusFilter, setStatusFilter] = useState("全部状态")
  const [page, setPage] = useState(1)
  const [pendingArchive, setPendingArchive] = useState<ProjectRecord | null>(null)
  const [lastArchivedProject, setLastArchivedProject] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)

  const resetPage = useCallback(() => setPage(1), [])

  const stageOptions = useMemo(
    () => ["全部阶段", ...Array.from(new Set(projectItems.map((project) => project.stage)))],
    [projectItems],
  )

  const filteredProjects = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    const filtered = projectItems.filter((project) => {
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        [project.name, project.targetInput, project.code, project.description, project.riskSummary]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword)

      const matchesStage = stageFilter === "全部阶段" || project.stage === stageFilter
      const matchesStatus = statusFilter === "全部状态" || project.status === statusFilter

      return matchesKeyword && matchesStage && matchesStatus
    })

    // Sort: running/blocked first, then by update time
    return filtered.sort((a, b) => {
      const priorityOrder: Record<string, number> = { 运行中: 0, 等待审批: 1, 待启动: 2, 已暂停: 3, 已完成: 4, 已停止: 5 }
      const pa = priorityOrder[a.status] ?? 9
      const pb = priorityOrder[b.status] ?? 9
      if (pa !== pb) return pa - pb
      return b.lastUpdated.localeCompare(a.lastUpdated)
    })
  }, [keyword, projectItems, stageFilter, statusFilter])

  const summaryCards = [
    { label: "筛选结果", value: `${filteredProjects.length}`, note: "当前可见项目" },
    {
      label: "阻塞项目",
      value: `${filteredProjects.filter((project) => project.status === "等待审批").length}`,
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

  async function handleArchiveConfirm() {
    if (!pendingArchive) {
      return
    }

    setArchiveError(null)
    setIsArchiving(true)

    try {
      const response = await apiFetch(`/api/projects/${pendingArchive.id}/archive`, {
        method: "POST",
      })
      const payload = (await response.json()) as { error?: string; project?: ProjectRecord }

      if (!response.ok || !payload.project) {
        setArchiveError(payload.error ?? "项目归档失败，请稍后再试。")
        return
      }

      setProjectItems((current) =>
        current.map((item) => (item.id === payload.project?.id ? payload.project : item)),
      )
      setLastArchivedProject(payload.project.name)
      setPendingArchive(null)
    } catch {
      setArchiveError("项目归档失败，请稍后再试。")
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <SectionCard title="项目列表" description="支持搜索、筛选、详情跳转、编辑和归档操作。">
      <div className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr_0.8fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={keyword}
              onChange={(event) => { setKeyword(event.target.value); resetPage() }}
              placeholder="搜索项目名称、目标、项目编号或项目说明..."
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); resetPage() }}>
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

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); resetPage() }}>
            <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <SelectValue placeholder="筛选状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="全部状态">全部状态</SelectItem>
              <SelectItem value="运行中">运行中</SelectItem>
              <SelectItem value="待启动">待启动</SelectItem>
              <SelectItem value="已暂停">已暂停</SelectItem>
              <SelectItem value="已停止">已停止</SelectItem>
              <SelectItem value="等待审批">等待审批</SelectItem>
              <SelectItem value="已完成">已完成</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-item border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{card.value}</div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{card.note}</p>
            </div>
          ))}
        </div>

        {lastArchivedProject ? (
          <div className="rounded-item border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/80 dark:bg-amber-950/30 dark:text-amber-100">
            {lastArchivedProject} 已归档，并已写入本地持久化存储与审计日志。
          </div>
        ) : null}

        {archiveError ? (
          <div className="rounded-item border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
            {archiveError}
          </div>
        ) : null}

        {/* Card Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onArchive={(p) => setPendingArchive(p)}
            />
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">没有匹配的项目</p>
            <Button asChild className="mt-4 rounded-full" variant="outline">
              <Link href="/projects/new">新建项目</Link>
            </Button>
          </div>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredProjects.length} onPageChange={setPage} />
      </div>

      <AlertDialog open={Boolean(pendingArchive)} onOpenChange={(open) => !open && setPendingArchive(null)}>
        <AlertDialogContent className="rounded-card border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle>确认关闭项目</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingArchive?.name} 将被标记为归档完成。当前实现会保留数据本体，并把归档动作写入本地持久化存储与审计日志。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={isArchiving}
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                void handleArchiveConfirm()
              }}
            >
              {isArchiving ? "归档中..." : "确认归档"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}
