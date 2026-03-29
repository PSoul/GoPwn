"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[ProjectError]", error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950">
          <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">项目加载失败</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {error.message || "无法加载项目数据，请重试。"}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={reset} size="sm" className="rounded-full">
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            重试
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-3.5 w-3.5" />
              返回项目列表
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
