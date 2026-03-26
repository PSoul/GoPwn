import { getDashboardPayload } from "@/lib/prototype-api"

export async function GET() {
  return Response.json(getDashboardPayload())
}
