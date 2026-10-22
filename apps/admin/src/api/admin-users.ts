import request from '@/utils/http'
import { fetchCsrfToken } from './auth'
import { adminAvatar, type AdminAvatarKey } from '@/utils/admin-avatar'

export type AdminRole = 'super_admin' | 'operator'
export type AdminStatus = 'pending_mfa' | 'active' | 'disabled'
export interface AdminProfile {
  nickname: string | null
  realName: string | null
  gender: 'male' | 'female' | 'other' | null
  phone: string | null
  email: string | null
  department: string | null
  avatarKey: AdminAvatarKey | null
  address: string | null
  bio: string | null
}
export interface AdminUserRecord extends AdminProfile {
  id: string
  username: string
  role: AdminRole
  status: AdminStatus
  online: boolean
  createdAt: string
  updatedAt: string
  createdBy: string | null
  updatedBy: string | null
  lastLoginAt: string | null
}
export interface AdminUserListItem extends Api.SystemManage.UserListItem {
  role: AdminRole
  online: boolean
  avatarKey: AdminAvatarKey | null
  realName: string | null
  department: string | null
  address: string | null
  bio: string | null
  lastLoginAt: string | null
}

export function toUserListItem(user: AdminUserRecord): AdminUserListItem {
  return {
    id: user.id,
    userName: user.username,
    nickName: user.nickname ?? '',
    userGender: user.gender ?? '',
    userPhone: user.phone ?? '',
    userEmail: user.email ?? '',
    userRoles: [user.role === 'super_admin' ? 'R_SUPER' : 'R_ADMIN'],
    role: user.role,
    status: user.status,
    online: user.online,
    avatar: adminAvatar(user.avatarKey),
    avatarKey: user.avatarKey,
    realName: user.realName,
    department: user.department,
    address: user.address,
    bio: user.bio,
    createBy: user.createdBy ?? '',
    createTime: user.createdAt,
    updateBy: user.updatedBy ?? '',
    updateTime: user.updatedAt,
    lastLoginAt: user.lastLoginAt
  }
}

const base = '/api/admin/v1/admin-users'

export async function fetchAdminUserList(params: Api.SystemManage.UserSearchParams) {
  const result = await request.get<Api.Common.PaginatedResponse<AdminUserRecord>>({
    url: base,
    params,
    showErrorMessage: false
  })
  return { ...result, records: result.records.map(toUserListItem) }
}

async function write<T>(url: string, method: 'POST' | 'PATCH', data?: unknown) {
  const { csrfToken } = await fetchCsrfToken()
  return request.request<T>({
    url,
    method,
    data,
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}

export const createAdminUser = (data: {
  username: string
  password: string
  role: AdminRole
  profile: AdminProfile
}) => write<{ user: AdminUserRecord; mfaUri: string }>(base, 'POST', data)
export const updateAdminProfile = (id: string, profile: AdminProfile) =>
  write<AdminUserRecord>(`${base}/${id}/profile`, 'PATCH', profile)
export const changeAdminAccess = (id: string, role: AdminRole, status: 'active' | 'disabled') =>
  write<AdminUserRecord>(`${base}/${id}/access`, 'PATCH', { role, status })
export const resetAdminPassword = (id: string, password: string) =>
  write<null>(`${base}/${id}/password/reset`, 'POST', { password })
export const resetAdminMfa = (id: string) =>
  write<{ user: AdminUserRecord; mfaUri: string }>(`${base}/${id}/mfa/reset`, 'POST')
export const confirmAdminMfa = (id: string, token: string) =>
  write<AdminUserRecord>(`${base}/${id}/mfa/confirm`, 'POST', { token })

export const fetchMyAdminProfile = () =>
  request.get<AdminUserRecord>({
    url: '/api/admin/v1/auth/me/profile',
    showErrorMessage: false
  })
export const updateMyAdminProfile = (profile: AdminProfile) =>
  write<AdminUserRecord>('/api/admin/v1/auth/me/profile', 'PATCH', profile)
export const changeMyAdminPassword = (oldPassword: string, newPassword: string, totp: string) =>
  write<null>('/api/admin/v1/auth/me/password', 'POST', { oldPassword, newPassword, totp })
