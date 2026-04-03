"use client"

import { useState } from "react"
import { BrainCircuit, Cpu, Eye, Workflow } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { apiFetch } from "@/lib/api-client"
import type { LlmProfileRecord } from "@/lib/prototype-types"

const roleMeta = {
  orchestrator: {
    title: "主规划模型",
    description: "负责任务规划、能力拆解和下一步调度建议，是整个平台的“脑”。",
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
} as const

export function LlmSettingsPanel({ initialProfiles }: { initialProfiles: LlmProfileRecord[] }) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function updateProfile(profileId: string, patch: Partial<LlmProfileRecord>) {
    setProfiles((current) => current.map((profile) => (profile.id === profileId ? { ...profile, ...patch } : profile)))
  }

  async function saveProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId)

    if (!profile) {
      return
    }

    setSavingProfileId(profileId)
    setMessage(null)
    setErrorMessage(null)

    try {
      const response = await apiFetch("/api/settings/llm", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(profile),
      })
      const payload = (await response.json()) as { profiles?: LlmProfileRecord[]; profile?: LlmProfileRecord; error?: string }

      if (!response.ok || !payload.profiles || !payload.profile) {
        setErrorMessage(payload.error ?? "LLM 配置保存失败，请稍后再试。")
        return
      }

      setProfiles(payload.profiles)
      setMessage(`LLM 配置 ${payload.profile.label} 已保存。`)
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
          const meta = roleMeta[profile.id]
          const Icon = meta.icon

          return (
            <div
              key={profile.id}
              className="rounded-card border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_-32px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">{meta.title}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{profile.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{meta.description}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {profile.id === "orchestrator" ? <BrainCircuit className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusBadge tone={profile.enabled ? "success" : "neutral"}>{profile.enabled ? "已启用" : "已停用"}</StatusBadge>
                <StatusBadge tone="info">{profile.provider}</StatusBadge>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">Provider</span>
                  <Input
                    aria-label={`Provider · ${profile.label}`}
                    value={profile.provider}
                    onChange={(event) => updateProfile(profile.id, { provider: event.target.value })}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">API Key</span>
                  <Input
                    aria-label={`API Key · ${profile.label}`}
                    value={profile.apiKey}
                    onChange={(event) => updateProfile(profile.id, { apiKey: event.target.value })}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">Base URL</span>
                  <Input
                    aria-label={`Base URL · ${profile.label}`}
                    value={profile.baseUrl}
                    onChange={(event) => updateProfile(profile.id, { baseUrl: event.target.value })}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">Model</span>
                  <Input
                    aria-label={`Model · ${profile.label}`}
                    value={profile.model}
                    onChange={(event) => updateProfile(profile.id, { model: event.target.value })}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-950 dark:text-white">上下文窗口 (tokens)</span>
                  <Input
                    aria-label={`Context Window · ${profile.label}`}
                    type="number"
                    value={String(profile.contextWindowSize)}
                    onChange={(event) =>
                      updateProfile(profile.id, {
                        contextWindowSize: Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : profile.contextWindowSize,
                      })
                    }
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">模型上下文窗口大小，超过 70% 时自动压缩历史对话。</p>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-950 dark:text-white">超时 (ms)</span>
                    <Input
                      aria-label={`Timeout · ${profile.label}`}
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
                      aria-label={`Temperature · ${profile.label}`}
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

                <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                  <div>
                    <p className="text-sm font-medium text-slate-950 dark:text-white">启用该角色</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">启用后，运行时会优先读取这里的配置，而不是只依赖环境变量。</p>
                  </div>
                  <Switch
                    checked={profile.enabled}
                    aria-label={`启用 ${profile.label}`}
                    onCheckedChange={(checked) => updateProfile(profile.id, { enabled: checked })}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button type="button" className="rounded-full" disabled={savingProfileId === profile.id} onClick={() => saveProfile(profile.id)}>
                  {savingProfileId === profile.id ? "保存中..." : `保存 ${profile.label}`}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {message ? (
        <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-3xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}
