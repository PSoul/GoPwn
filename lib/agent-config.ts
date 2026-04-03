/**
 * agent-config.ts — AI Agent 智能体核心配置
 *
 * 本平台本质是一个 AI Agent + 固化结果的安全评估平台。
 * 此文件定义 Agent 的所有可调参数，参考：
 * - Claude Code CLI: 环境感知、并行任务、输出截断
 * - Codex CLI: 审批策略(4级)、沙箱级别、推理深度
 * - Aider: 多模型角色、上下文压缩阈值、历史 token 预算
 * - Cursor: 并行工具上限、重试上限
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export interface AgentConfig {
  /** ===== 模型配置 ===== */
  model: {
    /** 编排器模型（主模型，负责规划和决策） */
    orchestratorProfile: string
    /** 审阅器模型（弱模型，负责总结和结论） */
    reviewerProfile: string
    /** 分析器模型（可使用较低等级模型，负责工具结果分析和 write-back） */
    analyzerProfile: string
    /** 推理深度: low=快速粗略, medium=平衡, high=深度分析 */
    reasoningEffort: "low" | "medium" | "high"
  }

  /** ===== 上下文管理 ===== */
  context: {
    /** LLM 最大上下文 token 数（用于计算压缩阈值） */
    maxContextTokens: number
    /** 上下文压缩触发阈值（占 maxContextTokens 的百分比，超过则开始压缩） */
    compressionThresholdPercent: number
    /** 单个工具输出最大字符数（超过则截断） */
    toolOutputMaxChars: number
    /** 工具输出摘要阈值（超过此字符数则使用结构化摘要而非原文） */
    toolOutputSummarizeThreshold: number
    /** 传给 LLM 的最近上下文条目数上限 */
    recentContextMaxItems: number
    /** 轮次历史保留策略: 最近 N 轮保留完整细节 */
    roundHistoryDetailCount: number
    /** 资产快照每类最大展示数 */
    assetSnapshotMaxPerType: number
  }

  /** ===== 执行控制 ===== */
  execution: {
    /** 最大并行工具执行数 */
    maxParallelTools: number
    /** 工具默认超时（秒） */
    toolTimeoutDefaultSeconds: number
    /** 工具最大超时（秒） */
    toolTimeoutMaxSeconds: number
    /** 工具失败最大重试次数 */
    maxRetries: number
    /** 最大编排轮次 */
    maxRounds: number
    /** 是否启用自动续跑 */
    autoReplan: boolean
    /** 连续无进展轮次数（触发停止） */
    noProgressStopRounds: number
  }

  /** ===== 安全与审批 ===== */
  safety: {
    /**
     * 审批策略（参考 Codex CLI 4 级模型）:
     * - "strict": 所有工具执行都需要人工审批
     * - "cautious": 高风险需审批，低风险自动执行（默认）
     * - "autonomous": 仅破坏性操作需审批
     * - "full-auto": 完全自主，无需审批（仅限靶场环境）
     */
    approvalPolicy: "strict" | "cautious" | "autonomous" | "full-auto"
    /** 是否允许 execute_code 工具（自主脚本） */
    allowCodeExecution: boolean
    /** 是否允许 execute_command 工具（Shell 命令） */
    allowCommandExecution: boolean
    /** 是否允许写入文件 */
    allowFileWrite: boolean
    /** 范围约束: 是否严格限制在项目目标范围内 */
    strictScopeEnforcement: boolean
  }

  /** ===== Agent 行为 ===== */
  behavior: {
    /** 是否启用轮间自我反思 */
    enableSelfReflection: boolean
    /** 是否启用攻击路径建模 */
    enableAttackPathModeling: boolean
    /** 是否启用凭据提取与传递 */
    enableCredentialChain: boolean
    /** 是否启用 Web 搜索（CVE/漏洞库查询） */
    enableWebSearch: boolean
    /** 是否启用交互式浏览器（Playwright） */
    enableBrowserInteraction: boolean
    /** Agent 个性: concise=简洁高效, detailed=详细解释, balanced=平衡 */
    personality: "concise" | "detailed" | "balanced"
    /** 日志详细程度 */
    logVerbosity: "minimal" | "normal" | "verbose"
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: {
    orchestratorProfile: "orchestrator",
    reviewerProfile: "reviewer",
    analyzerProfile: "analyzer",
    reasoningEffort: "medium",
  },
  context: {
    maxContextTokens: 65536,
    compressionThresholdPercent: 70,
    toolOutputMaxChars: 30000,
    toolOutputSummarizeThreshold: 2000,
    recentContextMaxItems: 8,
    roundHistoryDetailCount: 3,
    assetSnapshotMaxPerType: 20,
  },
  execution: {
    maxParallelTools: 3,
    toolTimeoutDefaultSeconds: 120,
    toolTimeoutMaxSeconds: 300,
    maxRetries: 2,
    maxRounds: 5,
    autoReplan: true,
    noProgressStopRounds: 2,
  },
  safety: {
    approvalPolicy: "cautious",
    allowCodeExecution: true,
    allowCommandExecution: true,
    allowFileWrite: true,
    strictScopeEnforcement: true,
  },
  behavior: {
    enableSelfReflection: true,
    enableAttackPathModeling: true,
    enableCredentialChain: true,
    enableWebSearch: false, // 默认关闭，需要配置搜索 API
    enableBrowserInteraction: false, // 默认关闭，需要 Playwright
    personality: "concise",
    logVerbosity: "normal",
  },
}

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

function getConfigPath(): string {
  const storeDir = join(process.cwd(), ".prototype-store")
  if (!existsSync(storeDir)) mkdirSync(storeDir, { recursive: true })
  return join(storeDir, "agent-config.json")
}

/** 读取 Agent 配置（从独立 JSON 文件读取，缺失字段用默认值填充） */
export function getAgentConfig(): AgentConfig {
  const configPath = getConfigPath()

  if (!existsSync(configPath)) return { ...DEFAULT_AGENT_CONFIG }

  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Partial<AgentConfig>
    return deepMerge(DEFAULT_AGENT_CONFIG as unknown as Record<string, unknown>, raw as Record<string, unknown>) as unknown as AgentConfig
  } catch {
    return { ...DEFAULT_AGENT_CONFIG }
  }
}

/** 更新 Agent 配置（部分更新，merge 到现有配置） */
export function updateAgentConfig(patch: DeepPartial<AgentConfig>): AgentConfig {
  const current = getAgentConfig()
  const merged = deepMerge(current as unknown as Record<string, unknown>, patch as Record<string, unknown>) as unknown as AgentConfig

  writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2), "utf-8")

  return merged
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const targetVal = target[key]
    const sourceVal = source[key]

    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === "object" &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      )
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Convenience accessors
// ---------------------------------------------------------------------------

/** 计算工具输出是否应该使用摘要（而非原文） */
export function shouldSummarizeOutput(outputLength: number): boolean {
  const config = getAgentConfig()
  return outputLength > config.context.toolOutputSummarizeThreshold
}

/** 计算当前上下文是否接近压缩阈值 */
export function isContextNearThreshold(currentTokenEstimate: number): boolean {
  const config = getAgentConfig()
  const threshold = config.context.maxContextTokens * (config.context.compressionThresholdPercent / 100)
  return currentTokenEstimate >= threshold
}

/** 粗略估算文本 token 数（中文约 1.5 char/token，英文约 4 char/token） */
export function estimateTokens(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length
  const otherChars = text.length - cjkChars
  return Math.ceil(cjkChars / 1.5 + otherChars / 4)
}

/** 根据审批策略判断某风险级别是否需要审批 */
export function requiresApproval(riskLevel: string): boolean {
  const config = getAgentConfig()

  switch (config.safety.approvalPolicy) {
    case "full-auto":
      return false
    case "autonomous":
      return riskLevel === "高" || riskLevel === "critical"
    case "cautious":
      return riskLevel === "高" || riskLevel === "中"
    case "strict":
      return true
    default:
      return riskLevel === "高"
  }
}
