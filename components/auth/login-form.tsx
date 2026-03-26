import { ShieldCheck, Siren, UserCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function LoginForm({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden rounded-[2rem] border-slate-200/80 bg-white/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.65)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <CardContent className="grid p-0 lg:grid-cols-[1.1fr_0.9fr]">
          <form className="flex flex-col justify-between p-8 lg:p-10">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  平台账号登录
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">进入授权外网安全评估平台</h1>
                  <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                    通过标准后台入口进入研究员工作台。所有高风险动作均保留审批与审计链路，登录行为会进入平台审计日志。
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="account">账号</Label>
                  <Input id="account" placeholder="researcher@company.local" className="h-12 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">密码</Label>
                    <a href="#" className="text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100">
                      忘记密码
                    </a>
                  </div>
                  <Input id="password" type="password" className="h-12 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="captcha">验证码</Label>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <Input id="captcha" placeholder="请输入图形验证码" className="h-12 rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
                    <div className="flex h-12 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-100 text-sm font-medium tracking-[0.35em] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      7K2Q
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <Button type="submit" className="h-12 w-full rounded-2xl bg-slate-950 text-base hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">
                登录平台
              </Button>
              <div className="flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>默认入口受平台审计与异常登录告警保护。</span>
                <a href="#" className="font-medium text-slate-700 underline-offset-4 hover:underline dark:text-slate-200">
                  联系管理员
                </a>
              </div>
            </div>
          </form>

          <div className="relative overflow-hidden border-l border-slate-200/80 bg-[linear-gradient(160deg,_rgba(14,165,233,0.16),_rgba(255,255,255,0.92)_35%,_rgba(14,165,233,0.08)_100%)] p-8 dark:border-slate-800 dark:bg-[linear-gradient(160deg,_rgba(14,165,233,0.22),_rgba(2,6,23,0.94)_38%,_rgba(14,165,233,0.16)_100%)] lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.24),_transparent_30%),linear-gradient(to_bottom,_transparent,_rgba(15,23,42,0.04))] dark:bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.2),_transparent_24%),linear-gradient(to_bottom,_transparent,_rgba(2,6,23,0.34))]" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-sky-700 dark:text-sky-300">审计可追溯</p>
                <h2 className="max-w-sm text-2xl font-semibold leading-tight text-slate-950 dark:text-white">
                  登录不是入口页装饰，而是进入流程控制、证据归档和审批约束的第一道关口。
                </h2>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                  <div className="mb-3 flex items-center gap-3">
                    <UserCircle2 className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">研究员入口校验</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">账号、密码、验证码三层校验</p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    进入控制台后将保留审批、任务调度、人工接管和证据链访问轨迹，便于后续审计复盘。
                  </p>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/80 dark:bg-amber-950/40">
                  <div className="mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-200">
                    <Siren className="h-4 w-4" />
                    <span className="text-sm font-medium">登录后提醒</span>
                  </div>
                  <p className="text-sm leading-6 text-amber-800/90 dark:text-amber-100/90">
                    本平台仅用于授权外网安全评估。高风险动作必须逐项审批，越权目标不会进入受控验证链路。
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
