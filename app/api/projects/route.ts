import { listProjectsPayload } from "@/lib/prototype-api"

export async function GET() {
  return Response.json(listProjectsPayload())
}
