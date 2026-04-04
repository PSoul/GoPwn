"use client"

import { useState } from "react"
import { BrainCircuit, Cpu, Eye, Workflow } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { apiFetch } from "@/lib/infra/api-client"
import type { LlmProfile } from "@/lib/generated/prisma"

const roleMeta: Record<string, {
  title: string
  description: string
  icon: typeof Workflow
}> = {
  orchestrator: {
    title: "主规划模型",
    description: "负责任务规划、能力拆解和下一步调度建议，是整个平台的「脑」。",
    icon: Workflow,
  },
  reviewer: {
    title: "结果审阅模型",
    description: "负责审阅执行返回的结果、压缩摘要和帮助判断结论是否足够稳定。",
    icon: Eye,
  },
  analyzer: {
    title: "结果分析模型",
    description: "负责分析 MCP 工具执行结果，提取漏洞发现和资产信息。可使用较低等级模型以节省成本。",
    icon: Cpu,
  },
}

export function LlmSettingsPanel({ initialProfiles }: { initialProfiles: LlmProfile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function updateProfile(profileId: string, patch: Partial<LlmProfile>) {
    setProfiles((current) => current.map((profile) => (profile.id === profileId ? { ...profile, ...patch } : profile)))
  }

  async function saveProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) return

    setSavingProfileId(profileId)
    setMessage(null)
    setErrorMessage(null)

    try {
      const payload = await apiFetch<{ profile: LlmProfile; profiles: LlmProfile[] }>("/api/settings/llm", {
        method: "PATCH",
        body: JSON.stringify(profile),
      })

      if (payload.profiles) {
        setProfiles(payload.profiles)
        setMessage(`LLM 配置 ${payload.profile.provider} / ${payload.profile.model} 已保存。`)
      }
    } catch {
      setErrorMessage("LLM 配置保存失败，请稍后再试。")
    } finally {
      setSavingProfileId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        {profiles.map((profile) => {
          const meta = roleMeta[profile.provider] ?? {
            title: profile.provider,
            description: `${profile.provider} / ${profile.model}`,
            icon: BrainCircuit,
          }
          const Icon = meta.icon

          return (
            <div
              key={profile.id}
              className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">{meta.title}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{profile.provider} / {profile.model}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{meta.description}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusBadge tone="info">{profile.provider}</StatusBadge>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">Provider</span>
                  <Input
                    value={profile.provider}
                    onChange={(event) => updateProfile(profile.id, { provider: event.target.value })}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">API Key</span>
                  <Input
                    value={profile.apiKey}
                    onChange={(event) => updateProfile(profile.id, { apiKey: event.target.value })}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">Base URL</span>
                  <Input
                    value={profile.baseUrl}
                    onChange={(event) => updateProfile(profile.id, { baseUrl: event.target.value })}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">Model</span>
                  <Input
                    value={profile.model}
                    onChange={(event) => updateProfile(profile.id, { model: event.target.value })}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-950 dark:text-white">超时 (ms)</span>
                    <Input
                      type="number"
                      value={String(profile.timeoutMs)}
                      onChange={(event) =>
                        updateProfile(profile.id, {
                          timeoutMs: Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : profile.timeoutMs,
                        })
                      }
                      className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-950 dark:text-white">Temperature</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={String(profile.temperature)}
                      onChange={(event) =>
                        updateProfile(profile.id, {
                          temperature: Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : profile.temperature,
                        })
                      }
                      className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button type="button" className="rounded-full" disabled={savingProfileId === profile.id} onClick={() => saveProfile(profile.id)}>
                  {savingProfileId === profile.id ? "保存中..." : "保存配置"}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {message && (
        <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-3xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
