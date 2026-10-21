import request from '@/utils/http'
import { fetchCsrfToken } from './auth'
import type {
  AdminTemplateDraft,
  AdminTemplateListItem,
  SaveTemplateDraftInput
} from '../../../../packages/contracts/src/api'

export type { AdminTemplateDraft, AdminTemplateListItem, SaveTemplateDraftInput }

export function fetchAdminTemplates() {
  return request.get<AdminTemplateListItem[]>({
    url: '/api/admin/v1/templates',
    showErrorMessage: false
  })
}

export function fetchXhsTitleDraft() {
  return request.get<AdminTemplateDraft>({
    url: '/api/admin/v1/templates/XHS_TITLE/draft',
    showErrorMessage: false
  })
}

export async function saveXhsTitleDraft(data: SaveTemplateDraftInput) {
  const { csrfToken } = await fetchCsrfToken()
  return request.put<AdminTemplateDraft>({
    url: '/api/admin/v1/templates/XHS_TITLE/draft',
    data,
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}
