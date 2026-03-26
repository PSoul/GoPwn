import { getMcpSettingsPayload } from "@/lib/prototype-api"

export async function GET() {
  return Response.json(getMcpSettingsPayload())
}
