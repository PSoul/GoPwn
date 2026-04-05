import { startProject } from "@/lib/services/project-service"

async function main() {
  const id = process.argv[2] || "cmnljpvjv000se8uyaex7ab4r"
  const result = await startProject(id)
  console.log("Started:", JSON.stringify(result))
}
main().catch(e => { console.error(e.message); process.exit(1) })
