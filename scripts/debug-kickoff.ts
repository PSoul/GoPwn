import "dotenv/config"
import { runProjectLifecycleKickoff } from "@/lib/orchestration/orchestrator-service"

async function main() {
  const projectId = process.argv[2] || "proj-20260403-fb246dab"

  console.log("Calling runProjectLifecycleKickoff for", projectId)
  console.time("kickoff")

  try {
    const result = await runProjectLifecycleKickoff(projectId, {
      controlCommand: "start",
      note: "Debug test",
    })
    console.timeEnd("kickoff")
    console.log("Result:", JSON.stringify(result, null, 2)?.slice(0, 2000))
  } catch (err) {
    console.timeEnd("kickoff")
    console.error("ERROR:", err)
  }
}

main()
