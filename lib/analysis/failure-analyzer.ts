/**
 * failure-analyzer.ts — 工具执行失败智能分析
 *
 * 当 MCP 工具执行失败时，分析错误原因并给出重试建议，
 * 让 LLM 大脑在下一轮规划时能做出更智能的决策。
 *
 * 参考 Claude Code 的错误处理模式：诊断 → 分析 → 建议 → 重试
 */
import { getAgentConfig } from "@/lib/settings/agent-config"

export interface FailureAnalysis {
  /** 工具名 */
  toolName: string
  /** 目标 */
  target: string
  /** 原始错误信息 */
  errorMessage: string
  /** 失败分类 */
  failureCategory: FailureCategory
  /** 可能原因 */
  likelyCause: string
  /** 建议的重试策略 */
  suggestedRetry: string | null
  /** 当前重试次数 */
  retryCount: number
  /** 是否值得重试 */
  worthRetrying: boolean
  /** 替代工具建议 */
  alternativeTool: string | null
}

export type FailureCategory =
  | "timeout"           // 执行超时
  | "connection_refused" // 目标拒绝连接
  | "dns_failure"       // DNS 解析失败
  | "auth_required"     // 需要认证/权限
  | "rate_limited"      // 被速率限制
  | "tool_error"        // 工具自身错误
  | "target_down"       // 目标不可达
  | "scope_violation"   // 越界/范围问题
  | "output_overflow"   // 输出过大
  | "unknown"           // 未知错误

/** 分析工具执行失败的原因并给出建议 */
export function analyzeFailure(
  toolName: string,
  target: string,
  errorMessage: string,
  retryCount: number = 0,
): FailureAnalysis {
  const config = getAgentConfig()
  const category = classifyError(errorMessage)
  const { cause, retry, alternative } = getAnalysis(category, toolName, target, errorMessage)

  return {
    toolName,
    target,
    errorMessage: errorMessage.slice(0, 500),
    failureCategory: category,
    likelyCause: cause,
    suggestedRetry: retry,
    retryCount,
    worthRetrying: retry !== null && retryCount < config.execution.maxRetries,
    alternativeTool: alternative,
  }
}

/** 将错误信息分类 */
function classifyError(error: string): FailureCategory {
  const lower = error.toLowerCase()

  if (lower.includes("timeout") || lower.includes("超时") || lower.includes("timed out") || lower.includes("etimedout")) {
    return "timeout"
  }
  if (lower.includes("econnrefused") || lower.includes("connection refused") || lower.includes("拒绝连接")) {
    return "connection_refused"
  }
  if (lower.includes("enotfound") || lower.includes("dns") || lower.includes("getaddrinfo") || lower.includes("解析失败")) {
    return "dns_failure"
  }
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("认证")) {
    return "auth_required"
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many") || lower.includes("频率")) {
    return "rate_limited"
  }
  if (lower.includes("ehostunreach") || lower.includes("enetunreach") || lower.includes("host unreachable") || lower.includes("不可达")) {
    return "target_down"
  }
  if (lower.includes("maxbuffer") || lower.includes("truncat") || lower.includes("output too large")) {
    return "output_overflow"
  }
  if (lower.includes("scope") || lower.includes("越界") || lower.includes("out of scope")) {
    return "scope_violation"
  }
  if (lower.includes("error") || lower.includes("exception") || lower.includes("failed")) {
    return "tool_error"
  }

  return "unknown"
}

/** 根据失败类型生成分析和建议 */
function getAnalysis(
  category: FailureCategory,
  toolName: string,
  target: string,
  error: string,
): { cause: string; retry: string | null; alternative: string | null } {
  switch (category) {
    case "timeout":
      return {
        cause: `工具 ${toolName} 对 ${target} 执行超时。可能是扫描范围过大、目标响应慢、或网络延迟高。`,
        retry: getTimeoutRetryAdvice(toolName),
        alternative: getTimeoutAlternative(toolName),
      }

    case "connection_refused":
      return {
        cause: `目标 ${target} 拒绝连接。端口可能未开放、服务未运行、或被防火墙阻挡。`,
        retry: "尝试换一个端口或使用 TCP banner grab 确认服务状态。",
        alternative: "execute_code（用 Node.js net 模块自行探测）",
      }

    case "dns_failure":
      return {
        cause: `无法解析目标 ${target} 的 DNS 记录。域名可能不存在、DNS 服务器不可达、或域名拼写错误。`,
        retry: "检查域名拼写，或直接使用 IP 地址。",
        alternative: null,
      }

    case "auth_required":
      return {
        cause: `目标 ${target} 返回认证/授权错误。需要有效凭据才能继续。`,
        retry: "如果已有凭据库中的凭据，尝试附带认证信息重试。否则标记为需要人工审批。",
        alternative: null,
      }

    case "rate_limited":
      return {
        cause: `目标 ${target} 或 API 触发了速率限制。请求频率过高。`,
        retry: "等待 30-60 秒后重试，或降低并发数。",
        alternative: null,
      }

    case "target_down":
      return {
        cause: `目标 ${target} 不可达。主机可能下线或网络不通。`,
        retry: null,
        alternative: null,
      }

    case "output_overflow":
      return {
        cause: `工具 ${toolName} 输出超过了缓冲区限制。扫描结果过多。`,
        retry: "缩小扫描范围（如限制端口范围、减少目标数量）后重试。",
        alternative: null,
      }

    case "scope_violation":
      return {
        cause: `操作超出了项目目标范围。`,
        retry: null,
        alternative: null,
      }

    case "tool_error":
      return {
        cause: `工具 ${toolName} 执行出错: ${error.slice(0, 200)}`,
        retry: "检查工具参数是否正确，或使用 execute_code 自行实现等效功能。",
        alternative: "execute_code",
      }

    default:
      return {
        cause: `工具 ${toolName} 执行失败，原因未知: ${error.slice(0, 200)}`,
        retry: "可以尝试使用 execute_code 自主编写脚本实现相同目的。",
        alternative: "execute_code",
      }
  }
}

function getTimeoutRetryAdvice(toolName: string): string {
  const adviceMap: Record<string, string> = {
    fscan_port_scan: "缩小端口范围为 TOP1000（-p 1-1000）或指定具体端口，增加超时时间。",
    fscan_comprehensive_scan: "拆分为独立步骤：先端口扫描，再对开放端口做服务识别。",
    dirsearch_scan: "减少字典大小或缩小扫描路径范围，增加超时。",
    dirsearch_recursive_scan: "改用 dirsearch_scan 非递归模式，或限制递归深度。",
    afrog_poc_scan: "限制 POC 类别（如只扫高危 POC），或缩小目标 URL 列表。",
    httpx_probe: "减少目标 URL 数量，或增加超时。",
  }

  return adviceMap[toolName] ?? "增加超时时间，或缩小扫描范围后重试。"
}

function getTimeoutAlternative(toolName: string): string | null {
  const altMap: Record<string, string> = {
    fscan_port_scan: "execute_code（用 Node.js net.connect 扫描关键端口）",
    dirsearch_scan: "curl_http_request（手动检查关键路径）",
    afrog_poc_scan: "execute_code（用 Node.js 发送特定 POC payload）",
  }

  return altMap[toolName] ?? null
}

/** 格式化失败分析为 LLM 可读的文本 */
export function formatFailureForPrompt(analysis: FailureAnalysis): string {
  const lines = [
    `✗ ${analysis.toolName}(${analysis.target}) 失败`,
    `  原因: ${analysis.likelyCause}`,
  ]

  if (analysis.suggestedRetry && analysis.worthRetrying) {
    lines.push(`  建议重试(${analysis.retryCount}/${analysis.retryCount + 1}): ${analysis.suggestedRetry}`)
  }

  if (analysis.alternativeTool) {
    lines.push(`  替代方案: ${analysis.alternativeTool}`)
  }

  if (!analysis.worthRetrying && !analysis.alternativeTool) {
    lines.push("  建议: 跳过此目标或等待人工介入。")
  }

  return lines.join("\n")
}
