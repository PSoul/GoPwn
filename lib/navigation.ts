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
}

export const prototypeNavigation: NavigationItem[] = [
  { title: "仪表盘", href: "/dashboard", icon: Blocks },
  { title: "项目管理", href: "/projects", icon: FolderKanban, badge: "12" },
  { title: "审批中心", href: "/approvals", icon: ClipboardCheck, badge: "6" },
  { title: "资产中心", href: "/assets", icon: Network },
  { title: "证据与结果", href: "/evidence", icon: Files },
  { title: "系统设置", href: "/settings", icon: Settings2 },
]
