import type { LucideIcon } from "lucide-react"
import {
  Blocks,
  Files,
  FolderKanban,
  Network,
  Settings2,
} from "lucide-react"

export interface NavigationItem {
  title: string
  href: string
  icon: LucideIcon
  section: "总览" | "发现" | "系统"
  badge?: string
  description?: string
}

export const prototypeNavigation: NavigationItem[] = [
  { title: "仪表盘", href: "/dashboard", icon: Blocks, section: "总览", description: "查看全局阻塞与今日优先事项" },
  { title: "项目管理", href: "/projects", icon: FolderKanban, section: "总览", description: "管理项目推进、范围与阶段状态" },
  { title: "资产中心", href: "/assets", icon: Network, section: "发现", description: "查看资产画像、关系与范围归属" },
  { title: "漏洞中心", href: "/vuln-center", icon: Files, section: "发现", description: "跨项目漏洞总览与证据追踪" },
  { title: "系统设置", href: "/settings", icon: Settings2, section: "系统", description: "控制 MCP 能力、策略与紧急停止" },
]

export function getNavigationTitle(pathname: string) {
  const matched = prototypeNavigation.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )

  return matched?.title ?? "平台工作台"
}

export function getNavigationTrail(pathname: string) {
  const matched = prototypeNavigation.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )

  return [
    { label: "平台控制台", href: "/dashboard" },
    { label: matched?.title ?? "工作台" },
  ]
}
