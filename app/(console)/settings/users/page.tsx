"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Shield, UserCog, UserCheck } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { SettingsSubnav } from "@/components/settings/settings-subnav"
import { Button } from "@/components/ui/button"

type UserRole = "admin" | "researcher" | "approver"
type UserStatus = "active" | "disabled"

interface UserItem {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
  createdAt: string
  lastLoginAt?: string
}

const roleLabels: Record<UserRole, string> = {
  admin: "管理员",
  researcher: "研究员",
  approver: "审批员",
}

const roleIcons: Record<UserRole, typeof Shield> = {
  admin: Shield,
  researcher: UserCog,
  approver: UserCheck,
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ email: "", password: "", displayName: "", role: "researcher" as UserRole })
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data.items ?? data)
      }
    } catch { /* best effort */ }
    setLoading(false)
  }, [])

  useEffect(() => { void loadUsers() }, [loadUsers])

  async function handleCreate() {
    setFormError("")
    if (!formData.email || !formData.password || !formData.displayName) {
      setFormError("请填写所有必要字段")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setShowForm(false)
        setFormData({ email: "", password: "", displayName: "", role: "researcher" })
        void loadUsers()
      } else {
        const err = await res.json()
        setFormError(err.error || "创建失败")
      }
    } catch {
      setFormError("网络错误")
    }
    setSubmitting(false)
  }

  async function handleToggleStatus(user: UserItem) {
    const newStatus = user.status === "active" ? "disabled" : "active"
    try {
      await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      void loadUsers()
    } catch { /* best effort */ }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="用户管理" description="管理平台用户账号与角色分配。" />
      <SettingsSubnav currentHref="/settings/users" />

      <SectionCard
        title="用户列表"
        eyebrow="User Management"
        description="当前平台所有注册用户。管理员可以创建新用户、分配角色和管理账号状态。"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5 rounded-full">
              <Plus className="h-3.5 w-3.5" />
              新建用户
            </Button>
          </div>

          {showForm && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">邮箱</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="user@company.local" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">密码</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="至少 8 位" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">显示名称</label>
                  <input type="text" value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="张三" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">角色</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    <option value="researcher">研究员</option>
                    <option value="approver">审批员</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
              </div>
              {formError && <p className="mt-2 text-xs text-rose-600">{formError}</p>}
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={submitting} className="rounded-full">
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "创建"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="rounded-full">
                  取消
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">暂无用户，请先创建</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400">用户</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400">邮箱</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400">角色</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400">状态</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-600 dark:text-slate-400">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const RoleIcon = roleIcons[user.role]
                    return (
                      <tr key={user.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/50">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{user.displayName}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <RoleIcon className="h-3.5 w-3.5" />
                            {roleLabels[user.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={user.status === "active" ? "success" : "danger"}>
                            {user.status === "active" ? "正常" : "已禁用"}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleToggleStatus(user)} className="text-xs">
                            {user.status === "active" ? "禁用" : "启用"}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
