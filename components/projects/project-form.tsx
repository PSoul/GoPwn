"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ClipboardCheck, FolderKanban, ShieldCheck } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ProjectFormPreset, ProjectMutationInput, ProjectRecord } from "@/lib/prototype-types"

type ProjectFormProps = {
  mode: "create" | "edit"
  preset: ProjectFormPreset
  project?: ProjectRecord
}

export function ProjectForm({ mode, preset, project }: ProjectFormProps) {
  const isEdit = mode === "edit"
  const router = useRouter()
  const [isRouting, startTransition] = useTransition()
  const [formData, setFormData] = useState<ProjectMutationInput>(preset)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isBusy = isSaving || isRouting

  function updateField<Key extends keyof ProjectMutationInput>(field: Key, value: ProjectMutationInput[Key]) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function submitProject(intent: "create" | "update" | "duplicate") {
    setErrorMessage(null)
    setIsSaving(true)

    const method = intent === "update" ? "PATCH" : "POST"
    const endpoint =
      intent === "update" && project ? `/api/projects/${project.id}` : "/api/projects"

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const payload = (await response.json()) as { error?: string; project?: { id: string } }

      if (!response.ok || !payload.project) {
        setErrorMessage(payload.error ?? "项目保存失败，请稍后再试。")
        return
      }

      startTransition(() => {
        router.push(`/projects/${payload.project.id}`)
        router.refresh()
      })
    } catch {
      setErrorMessage("项目保存失败，请稍后再试。")
    } finally {
      setIsSaving(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitProject(isEdit ? "update" : "create")
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
      <div className="space-y-5">
        <SectionCard title="基础信息" description="统一维护项目名称、目标摘要、负责人和标签，让列表与详情页读取同一份项目信息。">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="project-name">项目名称</Label>
              <Input id="project-name" value={formData.name} onChange={(event) => updateField("name", event.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-owner">负责人</Label>
              <Input id="project-owner" value={formData.owner} onChange={(event) => updateField("owner", event.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="target-type">目标类型</Label>
              <Input id="target-type" value={formData.targetType} onChange={(event) => updateField("targetType", event.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority">优先级</Label>
              <Input id="priority" value={formData.priority} onChange={(event) => updateField("priority", event.target.value as ProjectMutationInput["priority"])} className="h-12 rounded-2xl" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="seed-target">目标种子</Label>
              <Input id="seed-target" value={formData.seed} onChange={(event) => updateField("seed", event.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="target-summary">目标摘要</Label>
              <Textarea id="target-summary" value={formData.targetSummary} onChange={(event) => updateField("targetSummary", event.target.value)} className="min-h-28 rounded-2xl" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="project-tags">标签</Label>
              <Input id="project-tags" value={formData.tags} onChange={(event) => updateField("tags", event.target.value)} className="h-12 rounded-2xl" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="授权与范围" description="把授权说明、范围规则和禁止动作显式写在项目级配置中，方便审批和详情页复用。">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="authorization">授权说明</Label>
              <Textarea id="authorization" value={formData.authorizationSummary} onChange={(event) => updateField("authorizationSummary", event.target.value)} className="min-h-28 rounded-2xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scope-rules">范围规则</Label>
              <Textarea id="scope-rules" value={formData.scopeSummary} onChange={(event) => updateField("scopeSummary", event.target.value)} className="min-h-28 rounded-2xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="forbidden-actions">禁止动作</Label>
              <Textarea id="forbidden-actions" value={formData.forbiddenActions} onChange={(event) => updateField("forbiddenActions", event.target.value)} className="min-h-28 rounded-2xl" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="执行与审批策略" description="执行策略、速率与审批模式统一维护，避免项目详情、审批中心和系统设置各写一份。">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="default-concurrency">默认并发</Label>
              <Input id="default-concurrency" value={formData.defaultConcurrency} onChange={(event) => updateField("defaultConcurrency", event.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate-limit">速率限制</Label>
              <Input id="rate-limit" value={formData.rateLimit} onChange={(event) => updateField("rateLimit", event.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timeout">超时与重试</Label>
              <Input id="timeout" value={formData.timeout} onChange={(event) => updateField("timeout", event.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="approval-mode">审批模式</Label>
              <Input id="approval-mode" value={formData.approvalMode} onChange={(event) => updateField("approvalMode", event.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="delivery-notes">交付备注</Label>
              <Textarea id="delivery-notes" value={formData.deliveryNotes} onChange={(event) => updateField("deliveryNotes", event.target.value)} className="min-h-28 rounded-2xl" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title={isEdit ? "确认修改" : "确认创建"} description={isEdit ? "原型中用统一表单承接项目编辑，保持与新建页一致的结构和字段命名。" : "创建后将进入项目详情页，继续围绕阶段、审批、证据和资产推进。"}>
          {errorMessage ? (
            <div className="mb-4 rounded-[22px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isBusy} className="h-12 rounded-2xl bg-slate-950 px-6 text-base text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
              {isBusy ? "提交中..." : isEdit ? "保存修改" : "创建项目"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              className="h-12 rounded-2xl px-6"
              onClick={() => {
                if (isEdit) {
                  void submitProject("duplicate")
                }
              }}
            >
              {isEdit ? "另存为新项目" : "保存草稿"}
            </Button>
            {project ? (
              <Button asChild type="button" variant="ghost" className="h-12 rounded-2xl px-6">
                <Link href={`/projects/${project.id}`}>返回项目详情</Link>
              </Button>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard title="表单摘要" description="右侧摘要帮助研究员确认这次编辑会影响哪些项目控制信息。">
          <div className="space-y-4">
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-950 dark:text-white">{formData.name}</p>
              </div>
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{formData.targetSummary}</p>
            </div>

            {project ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">当前状态</p>
                  <div className="mt-2">
                    <StatusBadge tone={project.status === "已阻塞" ? "danger" : project.status === "已完成" ? "success" : "info"}>
                      {project.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{project.stage}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs text-slate-500 dark:text-slate-400">审批与任务</p>
                  <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">{project.pendingApprovals} 个待审批 / {project.openTasks} 个开放任务</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{project.lastUpdated} · {project.lastActor}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-xs text-slate-500 dark:text-slate-400">创建提示</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  建议先用清晰的目标摘要和范围规则建好项目基线，后续再从详情页继续补审批、资产与证据链。
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="操作提醒" description="项目模块优先保持可解释性和可追溯性，因此这里强调策略变更会影响到的下游页面。">
          <div className="space-y-3">
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-950 dark:text-white">审批链路</p>
              </div>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                审批模式、禁止动作和速率策略会同步影响审批中心的可见说明与高风险动作文案。
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-950 dark:text-white">项目详情</p>
              </div>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                目标摘要、范围规则和控制策略会在项目详情摘要区与任务/调度面板中持续露出。
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </form>
  )
}
