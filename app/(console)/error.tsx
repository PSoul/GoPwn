"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[ConsoleError]", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950">
          <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">页面加载失败</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {error.message || "发生了意外错误，请重试或联系管理员。"}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">错误编号: {error.digest}</p>
        )}
        <Button onClick={reset} className="mt-6 rounded-full" size="sm">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          重试
        </Button>
      </div>
    </div>
  )
}
