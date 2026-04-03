import { generateCaptcha } from "@/lib/auth/auth-repository"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async () => {
  const { captchaId, code } = await generateCaptcha()
  return Response.json({ captchaId, code })
})
