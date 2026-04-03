import { withApiHandler } from "@/lib/infra/api-handler"
import { getAgentConfig, updateAgentConfig } from "@/lib/settings/agent-config"

/** GET /api/settings/agent-config — 读取 Agent 配置 */
export const GET = withApiHandler(async () => {
  const config = getAgentConfig()
  return Response.json(config)
})

/** PATCH /api/settings/agent-config — 部分更新 Agent 配置 */
export const PATCH = withApiHandler(async (req) => {
  const patch = await req.json()
  const updated = updateAgentConfig(patch)
  return Response.json(updated)
})
