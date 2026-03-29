export default function ConsoleLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-8 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      </div>
      {/* Content skeleton */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="h-3 w-16 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="mt-2 h-7 w-12 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
