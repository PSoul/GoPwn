/**
 * env-detector.ts — 平台运行环境探测
 *
 * 探测 OS、Shell、Node.js 版本、可用系统工具等信息，
 * 供 LLM 大脑在规划和脚本生成时参考，避免生成不兼容的命令。
 */
import { execSync } from "node:child_process"
import os from "node:os"

export interface PlatformEnvironment {
  /** 操作系统名称 */
  osName: string
  /** 操作系统平台标识 (win32/linux/darwin) */
  osPlatform: string
  /** CPU 架构 (x64/arm64) */
  osArch: string
  /** 可用 Shell */
  shell: string
  /** Node.js 版本 */
  nodeVersion: string
  /** 临时文件目录 */
  tmpDir: string
  /** 可用系统工具（名称→路径或版本） */
  availableSystemTools: Record<string, string>
  /** 不可用的常用工具 */
  missingTools: string[]
}

/** 要探测的常用渗透测试/系统工具 */
const TOOLS_TO_PROBE = [
  "curl",
  "wget",
  "python3",
  "python",
  "pip",
  "nmap",
  "dig",
  "nslookup",
  "whois",
  "nc",
  "ncat",
  "ssh",
  "git",
  "jq",
  "openssl",
  "sqlmap",
  "nikto",
  "gobuster",
  "hydra",
  "john",
]

function probeToolAvailability(toolName: string): string | null {
  const cmd = process.platform === "win32" ? `where ${toolName} 2>nul` : `which ${toolName} 2>/dev/null`
  try {
    const result = execSync(cmd, { encoding: "utf-8", timeout: 3000, windowsHide: true })
    return result.trim().split("\n")[0] || null
  } catch {
    return null
  }
}

let _cachedEnv: PlatformEnvironment | null = null

/**
 * 探测当前平台运行环境。首次调用时执行探测，后续返回缓存。
 */
export function detectPlatformEnvironment(): PlatformEnvironment {
  if (_cachedEnv) return _cachedEnv

  const available: Record<string, string> = {}
  const missing: string[] = []

  for (const tool of TOOLS_TO_PROBE) {
    const path = probeToolAvailability(tool)
    if (path) {
      available[tool] = path
    } else {
      missing.push(tool)
    }
  }

  const osNameMap: Record<string, string> = {
    win32: `Windows ${os.release()}`,
    linux: `Linux ${os.release()}`,
    darwin: `macOS ${os.release()}`,
  }

  const shellMap: Record<string, string> = {
    win32: "cmd.exe / PowerShell (Git Bash if available)",
    linux: "/bin/bash",
    darwin: "/bin/zsh",
  }

  _cachedEnv = {
    osName: osNameMap[process.platform] ?? `${process.platform} ${os.release()}`,
    osPlatform: process.platform,
    osArch: process.arch,
    shell: shellMap[process.platform] ?? "/bin/sh",
    nodeVersion: process.version,
    tmpDir: os.tmpdir(),
    availableSystemTools: available,
    missingTools: missing,
  }

  return _cachedEnv
}

/**
 * 生成 LLM 可读的环境描述文本
 */
export function buildEnvironmentPromptSection(): string {
  const env = detectPlatformEnvironment()
  const toolLines = Object.entries(env.availableSystemTools)
    .map(([name, path]) => `  - ${name}: ${path}`)
    .join("\n")
  const missingLine =
    env.missingTools.length > 0 ? `- 不可用工具: ${env.missingTools.join(", ")}` : "- 所有常用工具均可用"

  return [
    "## 执行环境",
    `- 操作系统: ${env.osName} (${env.osPlatform}/${env.osArch})`,
    `- Shell: ${env.shell}`,
    `- Node.js: ${env.nodeVersion}`,
    `- 临时文件目录: ${env.tmpDir}`,
    `- 可用系统工具:`,
    toolLines || "  (无)",
    missingLine,
    `- 注意: ${env.osPlatform === "win32" ? "当前为 Windows 环境，Shell 命令请使用 Windows 兼容语法（或通过 execute_code 使用 Node.js 跨平台 API）。避免 Linux-only 命令如 grep -P, sed -i, /dev/null 等。" : "当前为 Unix 环境，可直接使用标准 Shell 命令。"}`,
  ].join("\n")
}

