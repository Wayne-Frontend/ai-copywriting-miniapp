import request from '@/utils/http'
import { fetchCsrfToken } from './auth'
import type {
  AdminTemplateDraft,
  AdminTemplateListItem,
  AdminPublishedTemplateVersion,
  AdminPublishedTemplateVersionDetail,
  SaveTemplateDraftInput,
  PublishTemplateDraftInput,
  PublishTemplateResult,
  ChangeTemplateAvailabilityInput,
  ChangeTemplateAvailabilityResult,
  RollbackTemplateVersionInput,
  RollbackTemplateVersionResult,
  ManagedTemplateDraft,
  SaveManagedTemplateDraftInput,
  ManagedTemplateTestResult,
  AdminXhsTitleTestRequest,
  AdminXhsTitleTestResult
} from '../../../../packages/contracts/src/api'

export type {
  AdminTemplateDraft,
  AdminTemplateListItem,
  AdminPublishedTemplateVersion,
  AdminPublishedTemplateVersionDetail,
  SaveTemplateDraftInput,
  PublishTemplateDraftInput,
  PublishTemplateResult,
  ChangeTemplateAvailabilityInput,
  ChangeTemplateAvailabilityResult,
  RollbackTemplateVersionInput,
  RollbackTemplateVersionResult,
  ManagedTemplateDraft,
  SaveManagedTemplateDraftInput,
  ManagedTemplateTestResult,
  AdminXhsTitleTestRequest,
  AdminXhsTitleTestResult
}

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

export function fetchXhsTitlePublishedVersions() {
  return request.get<AdminPublishedTemplateVersion[]>({
    url: '/api/admin/v1/templates/XHS_TITLE/versions',
    showErrorMessage: false
  })
}

export function fetchXhsTitlePublishedVersion(version: number) {
  return request.get<AdminPublishedTemplateVersionDetail>({
    url: `/api/admin/v1/templates/XHS_TITLE/versions/${version}`,
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

export async function testXhsTitleDraft(data: AdminXhsTitleTestRequest) {
  const { csrfToken } = await fetchCsrfToken()
  return request.post<AdminXhsTitleTestResult>({
    url: '/api/admin/v1/templates/XHS_TITLE/draft/test',
    data,
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}

export async function publishXhsTitleDraft(data: PublishTemplateDraftInput) {
  const { csrfToken } = await fetchCsrfToken()
  return request.post<PublishTemplateResult>({
    url: '/api/admin/v1/templates/XHS_TITLE/draft/publish',
    data,
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}

export async function changeXhsTitleAvailability(data: ChangeTemplateAvailabilityInput) {
  const { csrfToken } = await fetchCsrfToken()
  return request.request<ChangeTemplateAvailabilityResult>({
    url: '/api/admin/v1/templates/XHS_TITLE/availability',
    method: 'PATCH',
    data,
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}

export async function rollbackXhsTitleVersion(version: number, data: RollbackTemplateVersionInput) {
  const { csrfToken } = await fetchCsrfToken()
  return request.post<RollbackTemplateVersionResult>({
    url: `/api/admin/v1/templates/XHS_TITLE/versions/${version}/rollback`,
    data,
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}

const managedUrl = (code: string) => `/api/admin/v1/managed-templates/${encodeURIComponent(code)}`

export function fetchManagedDraft(code: string) {
  return request.get<ManagedTemplateDraft>({
    url: `${managedUrl(code)}/draft`,
    showErrorMessage: false
  })
}

export async function saveManagedDraft(code: string, data: SaveManagedTemplateDraftInput) {
  const { csrfToken } = await fetchCsrfToken()
  return request.put<ManagedTemplateDraft>({
    url: `${managedUrl(code)}/draft`,
    data,
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}

export async function testManagedCase(code: string, revision: string, index: number) {
  const { csrfToken } = await fetchCsrfToken()
  return request.post<ManagedTemplateTestResult>({
    url: `${managedUrl(code)}/draft/test`,
    data: { revision, index },
    // 论文类输出较长；服务端最多等待 60 秒，页面另留回传和落库时间。
    timeout: 75000,
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}

export async function reviewManagedDraft(code: string, revision: string, note: string) {
  const { csrfToken } = await fetchCsrfToken()
  return request.post<ManagedTemplateDraft>({
    url: `${managedUrl(code)}/draft/review`,
    data: { revision, note },
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}

export async function publishManagedDraft(code: string, revision: string) {
  const { csrfToken } = await fetchCsrfToken()
  return request.post<PublishTemplateResult>({
    url: `${managedUrl(code)}/draft/publish`,
    data: { revision },
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}

export function fetchManagedVersions(code: string) {
  return request.get<AdminPublishedTemplateVersion[]>({
    url: `${managedUrl(code)}/versions`,
    showErrorMessage: false
  })
}

export function fetchManagedVersion(code: string, version: number) {
  return request.get<AdminPublishedTemplateVersionDetail>({
    url: `${managedUrl(code)}/versions/${version}`,
    showErrorMessage: false
  })
}

export async function changeManagedAvailability(
  code: string,
  data: {
    status: 'active' | 'disabled'
    expectedStatus: 'active' | 'disabled'
    expectedCurrentVersion: number
  }
) {
  const { csrfToken } = await fetchCsrfToken()
  return request.request<ChangeTemplateAvailabilityResult>({
    url: `${managedUrl(code)}/availability`,
    method: 'PATCH',
    data,
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}

export async function rollbackManagedVersion(
  code: string,
  version: number,
  data: RollbackTemplateVersionInput
) {
  const { csrfToken } = await fetchCsrfToken()
  return request.post<RollbackTemplateVersionResult>({
    url: `${managedUrl(code)}/versions/${version}/rollback`,
    data,
    headers: { 'x-csrf-token': csrfToken },
    showErrorMessage: false
  })
}
