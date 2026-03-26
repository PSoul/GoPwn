import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.28em] text-sky-600 dark:text-sky-300">流程指挥台</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h1>
        {description ? <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  )
}
