"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { FolderKanban, ListTree, ScanSearch, ShieldCheck } from "lucide-react"

import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/infra/api-client"

const projectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空").max(100, "项目名称最多 100 个字符"),
  targetInput: z.string().min(1, "请至少填写一个目标"),
  description: z.string().optional(),
})
type ProjectFormValues = z.infer<typeof projectSchema>

type ProjectFormProps = {
  mode: "create"
  defaultValues?: { name?: string; targetInput?: string; description?: string }
}

function normalizeTargets(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

export function ProjectForm({ defaultValues }: ProjectFormProps) {
  const router = useRouter()
  const [isRouting, startTransition] = useTransition()
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      targetInput: defaultValues?.targetInput ?? "",
      description: defaultValues?.description ?? "",
    },
  })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isBusy = isSaving || isRouting
  const watchedName = form.watch("name")
  const watchedDescription = form.watch("description")
  const watchedTargetInput = form.watch("targetInput")
  const normalizedTargets = normalizeTargets(watchedTargetInput)

  async function onSubmit(values: ProjectFormValues) {
    setErrorMessage(null)
    setIsSaving(true)

    try {
      const payload = await apiFetch<{ error?: string; project?: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(values),
      })

      if (!payload.project) {
        setErrorMessage(payload.error ?? "项目保存失败，请稍后再试。")
        return
      }

      startTransition(() => {
        router.push(`/projects/${payload.project!.id}`)
        router.refresh()
      })
    } catch {
      setErrorMessage("项目保存失败，请稍后再试。")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
      <div className="space-y-5">
        <SectionCard
          title="项目基础信息"
          description="填写项目名称、目标和说明。"
        >
          <div className="grid gap-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>项目名称</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="例如：某公司年度渗透测试" className="h-12 rounded-2xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetInput"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目标</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="min-h-40 rounded-2xl font-mono text-sm" />
                  </FormControl>
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    可输入域名、IP、IP 段，LLM 收到信息后会自动进行任务整理和分发。不同目标一行一个。
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>项目说明</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="min-h-32 rounded-2xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="确认创建"
          description="保存后会进入项目工作台。"
        >
          {errorMessage ? (
            <div className="mb-4 rounded-item border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={isBusy}
              className="h-12 rounded-2xl bg-slate-950 px-6 text-base text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {isBusy ? "提交中..." : "创建项目"}
            </Button>
            <Button asChild type="button" variant="outline" className="h-12 rounded-2xl px-6">
              <Link href="/projects">返回列表</Link>
            </Button>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard title="项目预览" description="右侧预览帮助确认当前项目输入。">
          <div className="space-y-4">
            <div className="rounded-item border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-950 dark:text-white">{watchedName || "未命名项目"}</p>
              </div>
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{watchedDescription || "还没有填写项目说明。"}</p>
            </div>

            <div className="rounded-item border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-2 flex items-center gap-2">
                <ListTree className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-950 dark:text-white">目标拆分预览</p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{normalizedTargets.length} 个目标将进入规划队列</p>
              <div className="mt-3 space-y-2">
                {normalizedTargets.length > 0 ? (
                  normalizedTargets.slice(0, 6).map((target) => (
                    <div
                      key={target}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
                    >
                      {target}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    目标会在这里按行拆分显示。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-item border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-950 dark:text-white">审批策略</p>
              </div>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                审批策略由全局设置统一管理。高风险操作需要人工审批后才能执行。
              </p>
            </div>

            <div className="rounded-item border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-2 flex items-center gap-2">
                <ScanSearch className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-950 dark:text-white">工作台提示</p>
              </div>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                并发、超时和重试在探测工具配置与系统设置中统一生效。
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </form>
    </Form>
  )
}
