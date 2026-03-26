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
        "rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_12px_50px_-32px_rgba(15,23,42,0.45)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/80",
        className,
      )}
    >
      <div className="mb-5 flex flex-col gap-1">
        {eyebrow ? (
          <span className="text-[11px] uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">{eyebrow}</span>
        ) : null}
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
        {description ? <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
