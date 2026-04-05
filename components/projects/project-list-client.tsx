"use client"

import { useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { ExternalLink, Pencil, Search, Trash2 } from "lucide-react"

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import type { Project, ProjectLifecycle, PentestPhase } from "@/lib/generated/prisma"
import { LIFECYCLE_LABELS, PHASE_LABELS } from "@/lib/types/labels"
import { apiFetch } from "@/lib/infra/api-client"

const PAGE_SIZE = 12

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const lifecycleToneMap: Record<ProjectLifecycle, Tone> = {
  executing: "info",
  idle: "neutral",
  planning: "info",
  completed: "success",
  waiting_approval: "danger",
  reviewing: "warning",
  settling: "success",
  stopping: "warning",
  stopped: "neutral",
  failed: "danger",
}

const lifecyclePriority: Record<ProjectLifecycle, number> = {
  executing: 0,
  waiting_approval: 1,
  planning: 2,
  idle: 3,
  reviewing: 4,
  settling: 5,
  stopping: 6,
  stopped: 7,
  completed: 8,
  failed: 9,
}

type ProjectListClientProps = {
  projects: Project[]
}

export function ProjectListClient({ projects }: ProjectListClientProps) {
  const [projectItems, setProjectItems] = useState(projects)
  const [keyword, setKeyword] = useState("")
  const [phaseFilter, setPhaseFilter] = useState("all")
  const [lifecycleFilter, setLifecycleFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)
  const [lastDeletedProject, setLastDeletedProject] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const resetPage = useCallback(() => setPage(1), [])

  const filteredProjects = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    const filtered = projectItems.filter((project) => {
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        [project.name, project.code, project.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword)

      const matchesPhase = phaseFilter === "all" || project.currentPhase === phaseFilter
      const matchesLifecycle = lifecycleFilter === "all" || project.lifecycle === lifecycleFilter

      return matchesKeyword && matchesPhase && matchesLifecycle
    })

    return filtered.sort((a, b) => {
      const pa = lifecyclePriority[a.lifecycle] ?? 9
      const pb = lifecyclePriority[b.lifecycle] ?? 9
      if (pa !== pb) return pa - pb
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [keyword, projectItems, phaseFilter, lifecycleFilter])

  const summaryCards = [
    { label: "筛选结果", value: `${filteredProjects.length}`, note: "当前可见项目" },
    {
      label: "阻塞项目",
      value: `${filteredProjects.filter((p) => p.lifecycle === "waiting_approval").length}`,
      note: "需要优先清障",
    },
    {
      label: "执行中",
      value: `${filteredProjects.filter((p) => p.lifecycle === "executing").length}`,
      note: "正在自动化测试",
    },
    {
      label: "已完成",
      value: `${filteredProjects.filter((p) => p.lifecycle === "completed").length}`,
      note: "已完成全部测试",
    },
  ]

  async function handleDeleteConfirm() {
    if (!pendingDelete) return

    setDeleteError(null)
    setIsDeleting(true)

    try {
      await apiFetch(`/api/projects/${pendingDelete.id}`, { method: "DELETE" })

      const deletedName = pendingDelete.name
      setProjectItems((current) => current.filter((item) => item.id !== pendingDelete.id))
      setLastDeletedProject(deletedName)
      setPendingDelete(null)
    } catch {
      setDeleteError("项目删除失败，请稍后再试。")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <SectionCard title="项目列表" description="支持搜索、筛选、详情跳转、编辑和删除操作。">
      <div className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr_0.8fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={keyword}
              onChange={(event) => { setKeyword(event.target.value); resetPage() }}
              placeholder="搜索项目名称、项目编号或项目说明..."
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <Select value={phaseFilter} onValueChange={(v) => { setPhaseFilter(v); resetPage() }}>
            <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <SelectValue placeholder="筛选阶段" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部阶段</SelectItem>
              {(Object.entries(PHASE_LABELS) as [PentestPhase, string][]).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={lifecycleFilter} onValueChange={(v) => { setLifecycleFilter(v); resetPage() }}>
            <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <SelectValue placeholder="筛选状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {(Object.entries(LIFECYCLE_LABELS) as [ProjectLifecycle, string][]).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
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

        {lastDeletedProject ? (
          <div className="rounded-item border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/80 dark:bg-emerald-950/30 dark:text-emerald-100">
            {lastDeletedProject} 已删除。
          </div>
        ) : null}

        {deleteError ? (
          <div className="rounded-item border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
            {deleteError}
          </div>
        ) : null}

        {filteredProjects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">没有匹配的项目</p>
            <Button asChild className="mt-4 rounded-full" variant="outline">
              <Link href="/projects/new">新建项目</Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目名称</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>阶段</TableHead>
                <TableHead>轮次</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((project) => {
                const tone = lifecycleToneMap[project.lifecycle] ?? "neutral"
                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-slate-950 hover:text-slate-700 dark:text-white dark:hover:text-slate-200"
                      >
                        {project.name}
                      </Link>
                      {project.description && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xs">{project.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={tone}>{LIFECYCLE_LABELS[project.lifecycle]}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">{PHASE_LABELS[project.currentPhase]}</TableCell>
                    <TableCell className="text-sm">{project.currentRound}/{project.maxRounds}</TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400">{new Date(project.updatedAt).toLocaleDateString("zh-CN")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Link href={`/projects/${project.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Link href={`/projects/${project.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => setPendingDelete(project)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredProjects.length} onPageChange={setPage} />
      </div>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="rounded-card border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 {pendingDelete?.name} 吗？此操作不可恢复，项目的所有数据（资产、漏洞、证据等）将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => { void handleDeleteConfirm() }}
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}
