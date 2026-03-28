import { cn } from "@/lib/utils"

export function ProjectWorkspaceIntro({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-[28px] border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 lg:flex-row lg:items-start lg:justify-between",
        className,
      )}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          工作区视图
        </p>
        <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  )
}
