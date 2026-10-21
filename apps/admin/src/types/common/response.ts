/**
 * API 响应类型定义模块
 *
 * 提供统一的 API 响应结构类型定义
 *
 * ## 主要功能
 *
 * - 基础响应结构定义
 * - 泛型支持（适配不同数据类型）
 * - 统一的响应格式约束
 *
 * ## 使用场景
 *
 * - API 请求响应类型约束
 * - 接口数据类型定义
 * - 响应数据解析
 *
 * @module types/common/response
 * @author Art Design Pro Team
 */

import type { ApiError, ApiSuccess } from '../../../../../packages/contracts/src/api'

/** 后台沿用项目共享契约，不再使用模板自带的数字状态码响应格式。 */
export type BaseResponse<T = unknown> = ApiSuccess<T>

/** 仅将字段完整的项目响应视为有效，避免把模板 Mock 或异常 HTML 当作成功数据。 */
export function isApiSuccess(value: unknown): value is ApiSuccess<unknown> {
  if (!value || typeof value !== 'object') return false
  const response = value as Record<string, unknown>
  return (
    response.code === 'OK' &&
    typeof response.message === 'string' &&
    typeof response.requestId === 'string' &&
    'data' in response
  )
}

export function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') return false
  const response = value as Record<string, unknown>
  return (
    typeof response.code === 'string' &&
    response.code !== 'OK' &&
    typeof response.message === 'string' &&
    typeof response.requestId === 'string' &&
    'details' in response
  )
}
