import type { LucideIcon } from "lucide-react"
import {
  Blocks,
  ClipboardCheck,
  Files,
  FolderKanban,
  Network,
  Settings2,
} from "lucide-react"

export interface NavigationItem {
  title: string
  href: string
  icon: LucideIcon
  badge?: string
  description?: string
}

export const prototypeNavigation: NavigationItem[] = [
  { title: "仪表盘", href: "/dashboard", icon: Blocks, description: "查看全局阻塞与今日优先事项" },
  { title: "项目管理", href: "/projects", icon: FolderKanban, badge: "12", description: "管理项目推进、范围与阶段状态" },
  { title: "审批中心", href: "/approvals", icon: ClipboardCheck, badge: "6", description: "集中处理跨项目高风险动作审批" },
  { title: "资产中心", href: "/assets", icon: Network, description: "查看资产画像、关系与范围归属" },
  { title: "证据与结果", href: "/evidence", icon: Files, description: "沿证据链路追溯结论与复核状态" },
  { title: "系统设置", href: "/settings", icon: Settings2, description: "控制 MCP 能力、策略与紧急停止" },
]

export function getNavigationTitle(pathname: string) {
  const matched = prototypeNavigation.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )

  return matched?.title ?? "平台工作台"
}
