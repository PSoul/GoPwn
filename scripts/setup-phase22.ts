import "dotenv/config"
import { prisma } from "../lib/prisma"

async function main() {
  // 1. Configure LLM profiles with SiliconFlow DeepSeek-V3.2
  const apiKey = "sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc"
  const baseUrl = "https://api.siliconflow.cn/v1"
  const model = "Pro/deepseek-ai/DeepSeek-V3"

  console.log("=== Configuring LLM Profiles ===")

  await prisma.llmProfile.update({
    where: { id: "orchestrator" },
    data: { apiKey, baseUrl, model, enabled: true },
  })
  console.log("✓ orchestrator configured")

  await prisma.llmProfile.update({
    where: { id: "reviewer" },
    data: { apiKey, baseUrl, model, enabled: true },
  })
  console.log("✓ reviewer configured")

  await prisma.llmProfile.update({
    where: { id: "analyzer" },
    data: { apiKey, baseUrl, model, enabled: true },
  })
  console.log("✓ analyzer configured")

  // 2. Verify configuration
  const profiles = await prisma.llmProfile.findMany({ select: { id: true, enabled: true, model: true, baseUrl: true } })
  console.log("\n=== LLM Profiles ===")
  for (const p of profiles) {
    console.log(`  ${p.id}: ${p.enabled ? "✓ enabled" : "✗ disabled"} | ${p.model} @ ${p.baseUrl}`)
  }

  // 3. Check MCP tools (should be seeded separately)
  const toolCount = await prisma.mcpTool.count()
  console.log(`\n=== MCP Tools: ${toolCount} registered ===`)
  if (toolCount === 0) {
    console.log("  ⚠ No MCP tools. Run: npx tsx prisma/seed.ts")
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
