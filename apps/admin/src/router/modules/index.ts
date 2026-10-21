import { AppRouteRecord } from '@/types/router'
import { dashboardRoutes } from './dashboard'
import { templateRoutes } from './templates'

/**
 * 导出所有模块化路由
 */
// 仅注册已接入真实接口的页面；示例路由文件保留供后续参考。
export const routeModules: AppRouteRecord[] = [dashboardRoutes, templateRoutes]
