import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { withApiHandler } from "@/lib/api-handler"

const STORE_DIR = join(process.cwd(), ".prototype-store")
const APP_VERSION = process.env.npm_package_version ?? "0.0.0"

export const GET = withApiHandler(async () => {
  const timestamp = new Date().toISOString()

  try {
    await readdir(STORE_DIR)
    return Response.json({ status: "ok", timestamp, version: APP_VERSION })
  } catch {
    return Response.json({ status: "degraded", timestamp, version: APP_VERSION, detail: "data store not accessible" })
  }
})
