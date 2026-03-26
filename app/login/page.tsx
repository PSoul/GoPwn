import { Suspense } from "react"

import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(135deg,_#f8fafc,_#e2e8f0_52%,_#eff6ff)] px-6 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_28%),linear-gradient(135deg,_#020617,_#0f172a_55%,_#082f49)] md:px-10">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-7xl items-center">
        <Suspense fallback={<div className="w-full" />}>
          <LoginForm className="w-full" />
        </Suspense>
      </div>
    </div>
  )
}
