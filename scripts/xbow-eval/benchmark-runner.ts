/**
 * XBOW Benchmark Docker 生命周期管理
 * 构建、启动、停止基准测试靶场，获取映射端口。
 */

import { execSync } from "child_process"
import type { BenchmarkMeta } from "./benchmark-catalog"

export interface RunningBenchmark {
  meta: BenchmarkMeta
  port: number
  url: string
  startedAt: Date
}

function dockerCompose(dir: string, args: string, timeout = 300_000): string {
  try {
    return execSync(`docker compose ${args}`, {
      cwd: dir,
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    }).trim()
  } catch (err: any) {
    throw new Error(`docker compose ${args} failed: ${err.stderr ?? err.message}`)
  }
}

export async function buildBenchmark(meta: BenchmarkMeta): Promise<void> {
  console.log(`[build] ${meta.id}...`)
  // flag 注入到 Docker 构建参数——这是 XBOW 要求的构建方式
  // flag 只存在于容器内部，LLM 需要通过渗透测试自行发现
  dockerCompose(
    meta.dir,
    `build --build-arg FLAG=${meta.flag} --build-arg flag=${meta.flag}`,
    600_000,
  )
}

export async function startBenchmark(meta: BenchmarkMeta): Promise<RunningBenchmark> {
  await buildBenchmark(meta)
  dockerCompose(meta.dir, "up -d --wait", 120_000)
  const port = getExposedPort(meta)
  const running: RunningBenchmark = {
    meta,
    port,
    url: `http://localhost:${port}`,
    startedAt: new Date(),
  }
  console.log(`[start] ${meta.id} -> ${running.url}`)
  return running
}

function getExposedPort(meta: BenchmarkMeta): number {
  const output = dockerCompose(meta.dir, "ps --format json")
  const lines = output.split("\n").filter((l) => l.trim().startsWith("{"))

  for (const line of lines) {
    try {
      const container = JSON.parse(line)
      const publishers = container.Publishers ?? []
      for (const pub of publishers) {
        if (pub.TargetPort === 80 && pub.PublishedPort > 0) {
          return pub.PublishedPort
        }
      }
    } catch { /* skip */ }
  }
  throw new Error(`Cannot find mapped port for ${meta.id}`)
}

export async function stopBenchmark(meta: BenchmarkMeta): Promise<void> {
  try {
    dockerCompose(meta.dir, "down --remove-orphans -v", 60_000)
  } catch (err) {
    console.warn(`[stop] ${meta.id} error: ${err}`)
  }
}

export async function waitForReady(url: string, maxWait = 60_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (resp.ok || resp.status < 500) return true
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}
