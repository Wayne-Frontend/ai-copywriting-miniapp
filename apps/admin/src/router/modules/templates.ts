import type { AppRouteRecord } from '@/types/router'

export const templateRoutes: AppRouteRecord = {
  path: '/templates',
  name: 'Templates',
  component: '/index/index',
  meta: {
    title: 'menus.templates.title',
    icon: 'ri:file-list-3-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'list',
      name: 'TemplateList',
      component: '/templates/list',
      meta: {
        title: 'menus.templates.list',
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'xhs-title/draft',
      name: 'XhsTitleDraft',
      redirect: '/templates/XHS_TITLE/editor',
      component: '/templates/draft',
      meta: {
        title: 'menus.templates.xhsTitleDraft',
        roles: ['R_SUPER', 'R_ADMIN'],
        isHide: true
      }
    },
    {
      path: ':code/editor',
      name: 'ManagedTemplateEditor',
      component: '/templates/editor',
      meta: {
        title: 'menus.templates.editor',
        roles: ['R_SUPER', 'R_ADMIN'],
        isHide: true
      }
    }
  ]
}
