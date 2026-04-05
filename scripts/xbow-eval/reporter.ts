/**
 * XBOW 评估报告生成器
 * 生成详细的能力评估报告，区分平台问题和 LLM 能力问题。
 */

import type { CatalogSummary } from "./benchmark-catalog"

export interface EvalResult {
  benchmarkId: string
  name: string
  level: number
  tags: string[]
  passed: boolean
  flagFound: boolean
  lifecycle: string
  durationMs: number
  findingsCount: number
  mcpRunsCount: number
  error?: string
}

export interface ReportData {
  text: string
  markdown: string
  summary: {
    total: number
    passed: number
    failed: number
    errors: number
    passRate: number
    byLevel: Record<number, { total: number; passed: number }>
    byTag: Record<string, { total: number; passed: number }>
  }
}

export function generateReport(results: EvalResult[], catalog: CatalogSummary): ReportData {
  const total = results.length
  const passed = results.filter((r) => r.passed).length
  const errors = results.filter((r) => r.error).length
  const failed = total - passed - errors
  const passRate = total > 0 ? (passed / total) * 100 : 0

  // 按难度统计
  const byLevel: Record<number, { total: number; passed: number }> = {}
  for (const r of results) {
    if (!byLevel[r.level]) byLevel[r.level] = { total: 0, passed: 0 }
    byLevel[r.level].total++
    if (r.passed) byLevel[r.level].passed++
  }

  // 按标签统计
  const byTag: Record<string, { total: number; passed: number }> = {}
  for (const r of results) {
    for (const tag of r.tags) {
      if (!byTag[tag]) byTag[tag] = { total: 0, passed: 0 }
      byTag[tag].total++
      if (r.passed) byTag[tag].passed++
    }
  }

  // 问题诊断
  const diagnostics = diagnoseProblemAreas(results)

  const text = formatTextReport(total, passed, failed, errors, passRate, byLevel, byTag, diagnostics)
  const markdown = formatMarkdownReport(
    results, total, passed, failed, errors, passRate, byLevel, byTag, diagnostics, catalog,
  )

  return {
    text,
    markdown,
    summary: { total, passed, failed, errors, passRate, byLevel, byTag },
  }
}

/** 诊断问题领域：区分平台问题 vs LLM 能力问题 */
function diagnoseProblemAreas(results: EvalResult[]): string[] {
  const diagnostics: string[] = []

  // 平台流程问题：lifecycle 异常
  const lifecycleIssues = results.filter((r) => !r.passed && r.lifecycle === "failed")
  if (lifecycleIssues.length > 0) {
    diagnostics.push(
      `[平台问题] ${lifecycleIssues.length} 个挑战因平台错误失败 (lifecycle=failed)，` +
      `需检查 worker 日志和 MCP 工具可用性`,
    )
  }

  // 平台流程问题：超时
  const timeoutIssues = results.filter((r) => !r.passed && r.error?.includes("超时"))
  if (timeoutIssues.length > 0) {
    diagnostics.push(
      `[平台问题] ${timeoutIssues.length} 个挑战因超时失败，` +
      `可能需要增加 ReAct 步数或单轮超时`,
    )
  }

  // 平台流程问题：Docker 错误
  const dockerErrors = results.filter((r) => r.error?.includes("docker"))
  if (dockerErrors.length > 0) {
    diagnostics.push(
      `[环境问题] ${dockerErrors.length} 个挑战因 Docker 构建/启动失败`,
    )
  }

  // LLM 能力问题：完成但没找到 flag
  const llmMiss = results.filter(
    (r) => !r.passed && !r.error && r.lifecycle === "completed" && r.findingsCount > 0,
  )
  if (llmMiss.length > 0) {
    diagnostics.push(
      `[LLM 能力] ${llmMiss.length} 个挑战 LLM 完成了测试流程但未找到 flag，` +
      `说明 LLM 的漏洞利用推理能力不足`,
    )
  }

  // LLM 能力问题：完成但几乎没有发现
  const noFindings = results.filter(
    (r) => !r.passed && !r.error && r.findingsCount === 0,
  )
  if (noFindings.length > 0) {
    diagnostics.push(
      `[LLM 能力] ${noFindings.length} 个挑战 LLM 没产生任何 finding，` +
      `说明 LLM 的攻击面发现能力需加强`,
    )
  }

  // 按标签分析弱项
  const tagResults: Record<string, { total: number; passed: number }> = {}
  for (const r of results) {
    for (const tag of r.tags) {
      if (!tagResults[tag]) tagResults[tag] = { total: 0, passed: 0 }
      tagResults[tag].total++
      if (r.passed) tagResults[tag].passed++
    }
  }
  const weakTags = Object.entries(tagResults)
    .filter(([, v]) => v.total >= 3 && v.passed / v.total < 0.3)
    .map(([tag, v]) => `${tag}(${v.passed}/${v.total})`)

  if (weakTags.length > 0) {
    diagnostics.push(
      `[LLM 弱项] 以下漏洞类别通过率低于 30%: ${weakTags.join(", ")}`,
    )
  }

  return diagnostics
}

function formatTextReport(
  total: number, passed: number, failed: number, errors: number, passRate: number,
  byLevel: Record<number, { total: number; passed: number }>,
  byTag: Record<string, { total: number; passed: number }>,
  diagnostics: string[],
): string {
  let text = `\nXBOW 评估结果\n`
  text += `总计: ${total} | 通过: ${passed} | 失败: ${failed} | 错误: ${errors}\n`
  text += `通过率: ${passRate.toFixed(1)}%\n\n`

  text += `按难度:\n`
  for (const [level, data] of Object.entries(byLevel).sort()) {
    text += `  Level ${level}: ${data.passed}/${data.total} (${((data.passed / data.total) * 100).toFixed(0)}%)\n`
  }

  text += `\n按漏洞类别 (top 10):\n`
  const sortedTags = Object.entries(byTag).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
  for (const [tag, data] of sortedTags) {
    text += `  ${tag}: ${data.passed}/${data.total} (${((data.passed / data.total) * 100).toFixed(0)}%)\n`
  }

  if (diagnostics.length > 0) {
    text += `\n问题诊断:\n`
    for (const d of diagnostics) {
      text += `  ${d}\n`
    }
  }

  return text
}

function formatMarkdownReport(
  results: EvalResult[], total: number, passed: number, failed: number,
  errors: number, passRate: number,
  byLevel: Record<number, { total: number; passed: number }>,
  byTag: Record<string, { total: number; passed: number }>,
  diagnostics: string[], catalog: CatalogSummary,
): string {
  let md = `# XBOW 基准测试评估报告\n\n`
  md += `> 生成时间: ${new Date().toISOString()}\n\n`
  md += `## 评估原则\n\n`
  md += `- LLM 不知道 flag，不知道 benchmark 描述，只知道目标 URL\n`
  md += `- Flag 仅在测试完成后用于事后验证\n`
  md += `- 评估结果区分平台/流程问题和 LLM 推理能力问题\n\n`

  md += `## 总体结果\n\n`
  md += `| 指标 | 值 |\n|------|----|\n`
  md += `| 评估总数 | ${total} / ${catalog.total} |\n`
  md += `| 通过 | ${passed} |\n`
  md += `| 失败 | ${failed} |\n`
  md += `| 错误 | ${errors} |\n`
  md += `| **通过率** | **${passRate.toFixed(1)}%** |\n\n`

  md += `## 按难度分布\n\n`
  md += `| 难度 | 通过/总数 | 通过率 |\n|------|-----------|--------|\n`
  for (const [level, data] of Object.entries(byLevel).sort()) {
    md += `| Level ${level} | ${data.passed}/${data.total} | ${((data.passed / data.total) * 100).toFixed(0)}% |\n`
  }

  md += `\n## 按漏洞类别\n\n`
  md += `| 漏洞类别 | 通过/总数 | 通过率 |\n|----------|-----------|--------|\n`
  const sorted = Object.entries(byTag).sort((a, b) => b[1].total - a[1].total)
  for (const [tag, data] of sorted) {
    const rate = ((data.passed / data.total) * 100).toFixed(0)
    md += `| ${tag} | ${data.passed}/${data.total} | ${rate}% |\n`
  }

  if (diagnostics.length > 0) {
    md += `\n## 问题诊断\n\n`
    for (const d of diagnostics) {
      md += `- ${d}\n`
    }
  }

  md += `\n## 详细结果\n\n`
  md += `| ID | 名称 | 难度 | 标签 | 结果 | Findings | MCP Runs | 耗时 | 备注 |\n`
  md += `|----|------|------|------|------|----------|----------|------|------|\n`
  for (const r of results) {
    const status = r.passed ? "PASS" : r.error ? "ERROR" : "FAIL"
    const note = r.error ?? (r.passed ? "" : r.lifecycle)
    md += `| ${r.benchmarkId} | ${r.name.slice(0, 30)} | ${r.level} | ${r.tags.join(",").slice(0, 20)} | ${status} | ${r.findingsCount} | ${r.mcpRunsCount} | ${(r.durationMs / 1000).toFixed(0)}s | ${note.slice(0, 30)} |\n`
  }

  md += `\n## 改进建议\n\n`
  md += `基于评估结果，以下方向可以提升平台能力：\n\n`
  md += `1. **LLM 推理增强** — 通过率低的漏洞类别需要加强 LLM 方法论引导（不是给答案）\n`
  md += `2. **ReAct 步数** — 复杂挑战可能需要更多步数完成多步攻击链\n`
  md += `3. **工具可用性** — 检查失败案例中 MCP 工具是否正常响应\n`
  md += `4. **审批流程** — 自动评估需要自动审批机制\n`

  return md
}
