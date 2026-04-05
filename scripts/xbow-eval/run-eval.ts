/**
 * XBOW 基准测试评估主脚本
 *
 * 执行流程：
 * 1. 加载 benchmark 目录
 * 2. 按筛选条件选择子集
 * 3. 逐个：构建 Docker → 启动 → 创建 GoPwn 项目 → 等待完成 → 事后验证 flag → 停止
 * 4. 生成评估报告
 *
 * 核心原则：LLM 不知道 flag，不知道 benchmark 描述，只知道目标 URL。
 * flag 仅在测试完成后用于比对验证。
 *
 * 用法：
 *   npx tsx scripts/xbow-eval/run-eval.ts [--level 1] [--tags xss,sqli] [--limit 10]
 */

import { loadCatalog, filterBenchmarks, type BenchmarkMeta } from "./benchmark-catalog"
import { startBenchmark, stopBenchmark, waitForReady } from "./benchmark-runner"
import { GoPwnClient, searchForFlag, type ProjectResult } from "./gopwn-client"
import { generateReport, type EvalResult } from "./reporter"

interface EvalOptions {
  maxLevel?: number
  tags?: string[]
  limit?: number
  gopwnUrl?: string
  timeoutPerBenchmark?: number
}

function parseArgs(): EvalOptions {
  const args = process.argv.slice(2)
  const opts: EvalOptions = {}
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--level":
        opts.maxLevel = parseInt(args[++i])
        break
      case "--tags":
        opts.tags = args[++i].split(",")
        break
      case "--limit":
        opts.limit = parseInt(args[++i])
        break
      case "--gopwn-url":
        opts.gopwnUrl = args[++i]
        break
      case "--timeout":
        opts.timeoutPerBenchmark = parseInt(args[++i]) * 1000
        break
    }
  }
  return opts
}

async function evaluateSingle(
  client: GoPwnClient,
  meta: BenchmarkMeta,
  timeoutMs: number,
): Promise<EvalResult> {
  const result: EvalResult = {
    benchmarkId: meta.id,
    name: meta.name,
    level: meta.level,
    tags: meta.tags,
    passed: false,
    flagFound: false,
    lifecycle: "unknown",
    durationMs: 0,
    findingsCount: 0,
    mcpRunsCount: 0,
    error: undefined,
  }

  let running
  try {
    // 1. 启动靶场
    running = await startBenchmark(meta)

    // 2. 等待靶场就绪
    const ready = await waitForReady(running.url, 60_000)
    if (!ready) {
      result.error = "靶场启动超时"
      return result
    }

    // 3. 创建 GoPwn 项目 — 只传 URL，不传任何提示
    const projectId = await client.createProject(running.url)

    // 4. 启动渗透测试
    await client.startProject(projectId)

    // 5. 等待完成（自动审批）
    const projResult = await client.pollUntilDone(projectId, timeoutMs, true)

    // 6. 事后验证 — 检查 LLM 是否自己找到了 flag
    const flagFound = searchForFlag(projResult, meta.flag)

    result.passed = flagFound
    result.flagFound = flagFound
    result.lifecycle = projResult.lifecycle
    result.durationMs = projResult.durationMs
    result.findingsCount = projResult.findings.length
    result.mcpRunsCount = projResult.mcpRuns.length
  } catch (err: any) {
    result.error = err.message
  } finally {
    // 7. 清理靶场
    if (running) {
      await stopBenchmark(meta).catch(() => {})
    }
  }
  return result
}

async function main() {
  const opts = parseArgs()

  console.log("=== XBOW Benchmark Evaluation ===")
  console.log("原则：LLM 不知道 flag，不知道 benchmark 描述，只知道目标 URL")
  console.log("")

  // 加载目录
  const catalog = loadCatalog()
  console.log(`目录加载完成: ${catalog.total} 个挑战`)

  // 筛选子集
  const selected = filterBenchmarks(catalog, {
    maxLevel: opts.maxLevel,
    tags: opts.tags,
    limit: opts.limit,
  })
  console.log(`选中 ${selected.length} 个挑战进行评估`)

  // 连接 GoPwn
  const client = new GoPwnClient(opts.gopwnUrl)
  await client.login()
  console.log("GoPwn 已连接\n")

  // 逐个评估
  const results: EvalResult[] = []
  const timeoutMs = opts.timeoutPerBenchmark ?? 600_000

  for (let i = 0; i < selected.length; i++) {
    const meta = selected[i]
    console.log(`\n[${i + 1}/${selected.length}] ${meta.id} (Level ${meta.level}, ${meta.tags.join(",")})`)
    console.log("─".repeat(60))

    const result = await evaluateSingle(client, meta, timeoutMs)
    results.push(result)

    const status = result.passed ? "PASS" : result.error ? `ERROR: ${result.error}` : "FAIL"
    console.log(`  结果: ${status}`)
    console.log(`  Findings: ${result.findingsCount}, MCP Runs: ${result.mcpRunsCount}`)
    console.log(`  耗时: ${(result.durationMs / 1000).toFixed(1)}s`)
  }

  // 生成报告
  console.log("\n" + "=".repeat(60))
  const report = generateReport(results, catalog)
  console.log(report.text)

  // 保存报告
  const { writeFileSync } = await import("fs")
  const reportPath = `docs/xbow-eval-report-${new Date().toISOString().slice(0, 10)}.md`
  writeFileSync(reportPath, report.markdown, "utf-8")
  console.log(`\n报告已保存: ${reportPath}`)
}

main().catch((err) => {
  console.error("评估失败:", err)
  process.exit(1)
})
