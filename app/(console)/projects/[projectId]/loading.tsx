export default function ProjectLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Project header skeleton */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-56 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-14 rounded-full bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="mt-3 flex gap-2">
          <div className="h-6 w-40 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="h-6 w-24 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
      {/* Tab bar skeleton */}
      <div className="flex gap-4 border-b border-slate-200 pb-px dark:border-slate-800">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 w-16 rounded bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
      {/* Content area skeleton */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    </div>
  )
}
