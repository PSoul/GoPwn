import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="新建项目"
        description="从目标种子、授权说明、范围规则和策略配置开始，建立首版项目闭环。"
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <SectionCard title="基础信息" eyebrow="Project Seed" description="记录项目名称、目标类型和目标种子。">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="project-name">项目名称</Label>
                <Input id="project-name" defaultValue="华曜科技匿名外网面梳理" className="h-12 rounded-2xl" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="target-type">目标类型</Label>
                <Input id="target-type" defaultValue="domain" className="h-12 rounded-2xl" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="seed-target">目标种子</Label>
                <Input id="seed-target" defaultValue="huayao.com" className="h-12 rounded-2xl" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="授权与范围" eyebrow="Authorization" description="明确授权说明、范围规则与禁止动作。">
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="authorization">授权说明</Label>
                <Textarea
                  id="authorization"
                  defaultValue="仅用于授权外网匿名面安全评估，不包含登录后功能验证。"
                  className="min-h-28 rounded-2xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scope-rules">范围规则</Label>
                <Textarea
                  id="scope-rules"
                  defaultValue="允许解析域名、子域、开放端口、服务画像、Web/API 入口；新对象需经过归属判定后纳入。"
                  className="min-h-28 rounded-2xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="forbidden-actions">禁止动作</Label>
                <Textarea
                  id="forbidden-actions"
                  defaultValue="禁止无人审批的高风险验证；禁止越权目标验证；禁止超出授权速率策略的主动探测。"
                  className="min-h-28 rounded-2xl"
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="执行策略" eyebrow="Control" description="控制默认并发、速率和调度边界。">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="concurrency">默认并发限制</Label>
                <Input id="concurrency" defaultValue="4" className="h-12 rounded-2xl" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rate-limit">默认速率限制</Label>
                <Input id="rate-limit" defaultValue="60 req/min" className="h-12 rounded-2xl" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timeout">默认超时</Label>
                <Input id="timeout" defaultValue="30s" className="h-12 rounded-2xl" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="审批策略" eyebrow="Approval Gate" description="所有高风险动作逐项审批，低风险主动探测仍受并发和速率控制。">
            <div className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <p>高风险受控验证：人工逐项审批</p>
              <p>低风险主动探测：自动执行，受策略限速</p>
              <p>被动观测：默认自动执行，保留审计链路</p>
            </div>
          </SectionCard>

          <SectionCard title="确认创建" eyebrow="Submit" description="创建后将进入项目详情页，开始按照阶段状态机推进。">
            <div className="space-y-4">
              <Button className="h-12 w-full rounded-2xl bg-slate-950 text-base dark:bg-sky-500 dark:text-slate-950">
                创建项目
              </Button>
              <Button variant="outline" className="h-12 w-full rounded-2xl">
                保存草稿
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
