import { getStoredEvidenceById } from "@/lib/data/evidence-repository"
import { buildRuntimeArtifactUrl } from "@/lib/data/runtime-artifacts"
import { withApiHandler } from "@/lib/infra/api-handler"

export const GET = withApiHandler(async (_request, { params }) => {
  const { evidenceId } = await params
  const record = await getStoredEvidenceById(evidenceId)

  if (!record) {
    return Response.json({ error: `Evidence '${evidenceId}' not found` }, { status: 404 })
  }

  return Response.json({
    record,
    artifacts: {
      screenshotUrl: buildRuntimeArtifactUrl(record.screenshotArtifactPath) ?? undefined,
      htmlUrl: buildRuntimeArtifactUrl(record.htmlArtifactPath) ?? undefined,
    },
  })
})
