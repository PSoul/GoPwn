/**
 * Dynamic system prompt loader.
 * Loads the pentest methodology prompt from a configurable file path.
 * Cached in memory — restart worker to pick up changes.
 */

import { readFile } from "fs/promises"
import { resolve } from "path"

const DEFAULT_PROMPT_PATH = "mcps/pentest-agent-prompt.md"

let cached: string | null = null

/**
 * Load the system prompt from disk. Falls back to a minimal default
 * if the file is missing, so the pipeline never hard-fails on prompt load.
 */
export async function loadSystemPrompt(): Promise<string> {
  if (cached) return cached

  const promptPath = resolve(process.cwd(), DEFAULT_PROMPT_PATH)

  try {
    const content = await readFile(promptPath, "utf-8")
    cached = content.trim()
    console.log(`[system-prompt] Loaded from ${promptPath} (${cached.length} chars)`)
    return cached
  } catch {
    console.warn(`[system-prompt] ${promptPath} not found, using minimal fallback`)
    cached = FALLBACK_PROMPT
    return cached
  }
}

/**
 * Invalidate the cache so the next call re-reads from disk.
 */
export function invalidatePromptCache(): void {
  cached = null
}

const FALLBACK_PROMPT = `你是一个专业的安全评估AI助手。你的角色是协助进行授权的安全评估工作。
你必须：
- 只对明确授权的目标进行测试
- 使用合理的测试方法论，不要暴力破解或造成服务中断
- 如实报告发现，不夸大也不遗漏
- 对发现的问题提供修复建议

重要原则：
- 不要假设端口号对应特定服务，先探测再判断
- 不要生成破坏性的测试用例
- 每一步都要有明确的目的和预期结果`
