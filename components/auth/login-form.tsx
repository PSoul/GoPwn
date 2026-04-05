"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { ShieldCheck, UserCircle2, Siren } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function LoginForm({ className, ...props }: React.ComponentProps<"section">) {
  const searchParams = useSearchParams()
  const [account, setAccount] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account, password }),
      })
      const payload = (await response.json()) as { error?: string; redirectTo?: string }

      if (!response.ok) {
        setErrorMessage(payload.error ?? "登录失败，请稍后再试。")
        return
      }

      window.location.assign(searchParams?.get("from") ?? "/dashboard")
    } catch {
      setErrorMessage("登录失败，请稍后再试。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden rounded-[2rem] border-slate-200/80 bg-white/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.65)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <CardContent className="grid p-0 lg:grid-cols-[1.1fr_0.9fr]">
          <form className="flex flex-col justify-between p-8 lg:p-10" onSubmit={handleSubmit}>
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  平台账号登录
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">进入 GoPwn</h1>
                  <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                    AI Agent 驱动的下一代渗透测试平台。
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="account">账号</Label>
                  <Input
                    id="account"
                    autoComplete="username"
                    value={account}
                    onChange={(event) => setAccount(event.target.value)}
                    placeholder="admin@company.local"
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </div>

                {errorMessage ? (
                  <div className="rounded-3xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                    {errorMessage}
                  </div>
                ) : null}

                <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                  <p className="font-medium text-slate-900 dark:text-slate-100">默认账号</p>
                  <p className="mt-2">
                    账号 <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px] text-slate-900 dark:bg-slate-950 dark:text-slate-100">admin@company.local</span>
                  </p>
                  <p className="mt-1">
                    密码 <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px] text-slate-900 dark:bg-slate-950 dark:text-slate-100">Prototype@2026</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-2xl bg-slate-950 text-base hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">
                {isSubmitting ? "登录中..." : "登录平台"}
              </Button>
            </div>
          </form>

          <div className="relative overflow-hidden border-l border-slate-200/80 bg-[linear-gradient(160deg,_rgba(14,165,233,0.16),_rgba(255,255,255,0.92)_35%,_rgba(14,165,233,0.08)_100%)] p-8 dark:border-slate-800 dark:bg-[linear-gradient(160deg,_rgba(14,165,233,0.22),_rgba(2,6,23,0.94)_38%,_rgba(14,165,233,0.16)_100%)] lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.24),_transparent_30%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.2),_transparent_24%)]" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-sky-700 dark:text-sky-300">GoPwn</p>
                <h2 className="max-w-sm text-2xl font-semibold leading-tight text-slate-950 dark:text-white">
                  The Next Generation of Penetration Testing.
                </h2>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                  <div className="mb-3 flex items-center gap-3">
                    <UserCircle2 className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">智能编排</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">LLM 规划 → MCP 执行 → LLM 分析 → 自动验证</p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    多轮自动编排覆盖信息收集、攻击面发现、漏洞评估、验证全流程。
                  </p>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/80 dark:bg-amber-950/40">
                  <div className="mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-200">
                    <Siren className="h-4 w-4" />
                    <span className="text-sm font-medium">使用提醒</span>
                  </div>
                  <p className="text-sm leading-6 text-amber-800/90 dark:text-amber-100/90">
                    本平台仅用于授权安全评估。高风险动作需审批，所有操作留有审计记录。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
