import request from '@/utils/http'
import type { AdminIdentity, AdminLoginRequest } from '../../../../packages/contracts/src/api'
import { adminAvatar } from '@/utils/admin-avatar'

function toUserInfo(admin: AdminIdentity): Api.Auth.UserInfo {
  // 模板菜单使用 R_SUPER/R_ADMIN；这里仅做显示层映射，权限仍由服务端校验。
  const role =
    admin.role === 'super_admin'
      ? 'R_SUPER'
      : admin.role === 'operator'
        ? 'R_ADMIN'
        : 'R_UNASSIGNED'
  return {
    userId: admin.id,
    userName: admin.username,
    roles: [role],
    buttons: [],
    email: admin.email ?? '',
    avatar: adminAvatar(admin.avatarKey)
  }
}

export function fetchCsrfToken() {
  return request.get<{ csrfToken: string }>({
    url: '/api/admin/v1/auth/csrf',
    skipAuthRedirect: true,
    showErrorMessage: false
  })
}

/**
 * 登录
 * @param params 登录参数
 * @returns 登录响应
 */
export async function fetchLogin(params: AdminLoginRequest): Promise<Api.Auth.UserInfo> {
  const { csrfToken } = await fetchCsrfToken()
  const { admin } = await request.post<{ admin: AdminIdentity }>({
    url: '/api/admin/v1/auth/login',
    data: params,
    headers: { 'x-csrf-token': csrfToken },
    skipAuthRedirect: true,
    showErrorMessage: false
  })
  return toUserInfo(admin)
}

/**
 * 获取用户信息
 * @returns 用户信息
 */
export async function fetchGetUserInfo() {
  const { admin } = await request.get<{ admin: AdminIdentity }>({
    url: '/api/admin/v1/auth/me',
    skipAuthRedirect: true,
    showErrorMessage: false
  })
  return toUserInfo(admin)
}

export async function fetchLogout() {
  const { csrfToken } = await fetchCsrfToken()
  return request.post<null>({
    url: '/api/admin/v1/auth/logout',
    headers: { 'x-csrf-token': csrfToken },
    skipAuthRedirect: true,
    showErrorMessage: false
  })
}
