import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: string
  eyebrow?: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{eyebrow}</p> : null}
        <h1 className="text-[30px] font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h1>
        {description ? <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  )
}
