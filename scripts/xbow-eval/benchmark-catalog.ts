/**
 * XBOW Benchmark 目录解析器
 *
 * 核心原则：flag 只用于事后验证，绝不传给 LLM。
 * LLM 只知道"测试这个 URL"，和真实渗透测试完全一致。
 */

import { readFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"
import { createHash } from "crypto"

export interface BenchmarkMeta {
  id: string
  name: string
  level: number
  winCondition: "flag" | "question"
  tags: string[]
  /** flag 仅用于事后验证，绝不传给 LLM */
  flag: string
  dir: string
}

export interface CatalogSummary {
  total: number
  byLevel: Record<number, number>
  byTag: Record<string, number>
  benchmarks: BenchmarkMeta[]
}

const BENCHMARKS_ROOT = join(__dirname, "../../xbow-benchmarks/benchmarks")

/** 按 XBOW 规则生成 flag — 仅用于事后比对 */
export function generateFlag(benchmarkId: string): string {
  const upper = benchmarkId.toUpperCase()
  const hash = createHash("sha256").update(upper).digest("hex")
  return `FLAG{${hash}}`
}

function parseBenchmark(dirPath: string): BenchmarkMeta | null {
  const jsonPath = join(dirPath, "benchmark.json")
  if (!existsSync(jsonPath)) return null
  try {
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"))
    const id = dirPath.split(/[\\/]/).pop()!
    return {
      id,
      name: raw.name ?? id,
      level: typeof raw.level === "string" ? parseInt(raw.level) : (raw.level ?? 1),
      winCondition: raw.win_condition ?? "flag",
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      flag: generateFlag(id),
      dir: dirPath,
    }
  } catch {
    return null
  }
}

export function loadCatalog(root: string = BENCHMARKS_ROOT): CatalogSummary {
  const dirs = readdirSync(root).filter((d) => d.startsWith("XBEN-")).sort()
  const benchmarks: BenchmarkMeta[] = []
  const byLevel: Record<number, number> = {}
  const byTag: Record<string, number> = {}

  for (const d of dirs) {
    const meta = parseBenchmark(join(root, d))
    if (!meta) continue
    benchmarks.push(meta)
    byLevel[meta.level] = (byLevel[meta.level] ?? 0) + 1
    for (const tag of meta.tags) {
      byTag[tag] = (byTag[tag] ?? 0) + 1
    }
  }
  return { total: benchmarks.length, byLevel, byTag, benchmarks }
}

export function filterBenchmarks(
  catalog: CatalogSummary,
  opts: { tags?: string[]; maxLevel?: number; limit?: number } = {},
): BenchmarkMeta[] {
  let result = catalog.benchmarks
  if (opts.tags?.length) {
    result = result.filter((b) => b.tags.some((t) => opts.tags!.includes(t)))
  }
  if (opts.maxLevel) {
    result = result.filter((b) => b.level <= opts.maxLevel!)
  }
  if (opts.limit) {
    result = result.slice(0, opts.limit)
  }
  return result
}

if (require.main === module) {
  const catalog = loadCatalog()
  console.log(`XBOW Benchmark Catalog: ${catalog.total} challenges`)
  console.log(`By level:`, catalog.byLevel)
  console.log(`By tag:`, Object.entries(catalog.byTag).sort((a, b) => b[1] - a[1]))
}
