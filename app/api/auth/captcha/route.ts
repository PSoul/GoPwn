import { generateCaptcha } from "@/lib/auth-repository"
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(async () => {
  const { captchaId, code } = await generateCaptcha()
  return Response.json({ captchaId, code })
})
