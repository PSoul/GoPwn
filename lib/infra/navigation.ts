import {
  LayoutDashboard,
  FolderKanban,
  Shield,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  section: string
  badge?: string
}

export const prototypeNavigation: NavItem[] = [
  { title: "仪表盘", href: "/dashboard", icon: LayoutDashboard, section: "总览" },
  { title: "项目", href: "/projects", icon: FolderKanban, section: "总览" },
  { title: "漏洞中心", href: "/findings", icon: Shield, section: "发现" },
  { title: "设置", href: "/settings", icon: Settings, section: "系统" },
]

export function getNavigationTitle(pathname: string): string {
  const item = prototypeNavigation.find(
    (nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`),
  )
  return item?.title ?? "平台控制台"
}

export type TrailItem = {
  label: string
  href?: string
}

export function getNavigationTrail(pathname: string): TrailItem[] {
  const trail: TrailItem[] = []
  for (const nav of prototypeNavigation) {
    if (pathname === nav.href || pathname.startsWith(`${nav.href}/`)) {
      trail.push({ label: nav.title, href: nav.href })
      break
    }
  }
  // If we're on a detail page, add a detail breadcrumb
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length > 2) {
    trail.push({ label: "详情" })
  }
  return trail
}
