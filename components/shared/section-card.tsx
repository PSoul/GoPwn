import { cn } from "@/lib/utils"

export function SectionCard({
  title,
  eyebrow,
  description,
  children,
  className,
}: {
  title: string
  eyebrow?: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-950",
        className,
      )}
    >
      <div className="mb-5 flex flex-col gap-1">
        {eyebrow ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{eyebrow}</span>
        ) : null}
        <h2 className="text-[28px] font-semibold leading-none text-slate-950 dark:text-white">{title}</h2>
        {description ? <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
