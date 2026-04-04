import { clearAuthCookie } from "@/lib/infra/auth"
import { apiHandler, json } from "@/lib/infra/api-handler"

export const POST = apiHandler(async () => {
  await clearAuthCookie()
  return json({ ok: true })
})
