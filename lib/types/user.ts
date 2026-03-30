export type UserRole = "admin" | "researcher" | "approver"

export type UserStatus = "active" | "disabled"

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  displayName: string
  role: UserRole
  status: UserStatus
  createdAt: string
  lastLoginAt?: string
}
