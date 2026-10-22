import type { TemplateCode, TemplateInputs } from './templates';
import type { TemplateOutputMap } from './outputs';

export const USER_API_PREFIX = '/api/v1' as const;
export const ADMIN_API_PREFIX = '/api/admin/v1' as const;

export const ADMIN_AUTH_ROUTES = {
  csrf: { method: 'GET', path: '/auth/csrf' },
  login: { method: 'POST', path: '/auth/login' },
  me: { method: 'GET', path: '/auth/me' },
  logout: { method: 'POST', path: '/auth/logout' },
} as const;

export interface AdminIdentity {
  id: string;
  username: string;
  role: string;
  email?: string | null;
  avatarKey?: string | null;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
  totp: string;
}

export interface AdminTemplateListItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  status: string;
  currentVersion: number | null;
  updatedAt: string;
  updatedByUsername: string | null;
}

export interface AdminPublishedTemplateVersion {
  version: number;
  isCurrent: boolean;
  model: string | null;
  changeLog: string;
  publishedAt: string | null;
  publishedByUsername: string | null;
}

export interface AdminPublishedTemplateVersionDetail extends AdminPublishedTemplateVersion {
  description?: string | null;
  systemPromptVersion: string;
  developerPrompt: string;
  formSchema: unknown;
  outputSchema: unknown;
  modelConfig: Record<string, unknown>;
}

export interface AdminTemplateDraft {
  template: { code: string; name: string; description: string; status: string };
  version: number;
  developerPrompt: string;
  changeLog: string;
  revision: string | null;
  saved: boolean;
}

export interface SaveTemplateDraftInput {
  developerPrompt: string;
  changeLog: string;
  revision: string | null;
}

export interface PublishTemplateDraftInput {
  revision: string;
}

export interface PublishTemplateResult {
  version: number;
  status: 'active';
  publishedAt: string;
  model: string;
}

export interface ChangeTemplateAvailabilityInput {
  status: 'active' | 'disabled';
  expectedStatus: 'active' | 'disabled';
  expectedVersion: number;
}

export interface ChangeTemplateAvailabilityResult {
  status: 'active' | 'disabled';
  currentVersion: number;
  updatedAt: string;
}

export interface RollbackTemplateVersionInput {
  expectedCurrentVersion: number;
  expectedStatus: 'active' | 'disabled';
  reason: string;
}

export interface RollbackTemplateVersionResult {
  previousVersion: number;
  currentVersion: number;
  status: 'active' | 'disabled';
  updatedAt: string;
}

export interface ManagedTemplateDraft {
  code: string;
  name: string;
  status: 'active' | 'disabled';
  version: number;
  description: string;
  developerPrompt: string;
  changeLog: string;
  formSchema: unknown;
  outputSchema: unknown;
  maxOutputTokens: number;
  testCases: Record<string, unknown>[];
  evaluation: { results: Record<string, { passed: boolean; output: unknown; model: string; durationMs: number }>;
    approvedBy?: string; approvedAt?: string; note?: string } | null;
  revision: string | null;
  saved: boolean;
}

export type SaveManagedTemplateDraftInput = Pick<ManagedTemplateDraft,
  'description' | 'developerPrompt' | 'changeLog' | 'formSchema' | 'outputSchema' |
  'maxOutputTokens' | 'testCases' | 'revision'>;

export interface ManagedTemplateTestResult {
  index: number;
  output: unknown;
  model: string;
  durationMs: number;
  completed: number;
  total: number;
}

export interface AdminXhsTitleTestRequest {
  revision: string;
  inputs: TemplateInputs<'XHS_TITLE'>;
}

export interface AdminXhsTitleTestResult {
  version: number;
  revision: string;
  model: string;
  durationMs: number;
  tokenUsage: { input: number; output: number; total: number } | null;
  items: TemplateOutputMap['XHS_TITLE']['items'];
}

// 仅登记 PRD 已列出的用户端路径；支付通知和管理端细节待对应业务契约明确后添加。
export const USER_API_ROUTES = {
  wechatLogin: { method: 'POST', path: '/auth/wechat-login' },
  me: { method: 'GET', path: '/me' },
  deleteMe: { method: 'DELETE', path: '/me' },
  templates: { method: 'GET', path: '/templates' },
  templateDetail: { method: 'GET', path: '/templates/:id' },
  createGeneration: { method: 'POST', path: '/generations' },
  generationDetail: { method: 'GET', path: '/generations/:id' },
  generations: { method: 'GET', path: '/generations' },
  deleteGeneration: { method: 'DELETE', path: '/generations/:id' },
  savedContent: { method: 'PUT', path: '/generations/:id/saved-content' },
  credits: { method: 'GET', path: '/credits' },
  plans: { method: 'GET', path: '/plans' },
  createOrder: { method: 'POST', path: '/orders' },
  orderPayment: { method: 'POST', path: '/orders/:id/pay' },
  orders: { method: 'GET', path: '/orders' },
  orderDetail: { method: 'GET', path: '/orders/:id' },
  refundRequest: { method: 'POST', path: '/refund-requests' },
} as const;

export const API_ERROR_CODES = [
  'AUTH_REQUIRED',
  'SESSION_EXPIRED',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'TEMPLATE_UNAVAILABLE',
  'INSUFFICIENT_CREDITS',
  'TASK_ALREADY_RUNNING',
  'IDEMPOTENCY_CONFLICT',
  'RATE_LIMITED',
  'CONTENT_REJECTED',
  'AI_TIMEOUT',
  'AI_SERVICE_ERROR',
  'ORDER_NOT_PAYABLE',
  'PAYMENT_PENDING',
  'PERMISSION_DENIED',
  'SERVICE_UNAVAILABLE',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiSuccess<T> {
  code: 'OK';
  message: string;
  data: T;
  requestId: string;
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details: unknown;
  requestId: string;
}

export type CreateGenerationRequest = {
  [C in TemplateCode]: {
    templateId: C;
    templateVersion: number;
    clientRequestId: string;
    inputs: TemplateInputs<C>;
  };
}[TemplateCode];

export interface CreateGenerationData {
  jobId: string;
  status: 'queued';
  estimatedCreditCost: 1;
}

export type CreateGenerationResponse = ApiSuccess<CreateGenerationData>;

export type GenerationStatus = 'queued' | 'running' | 'succeeded' | 'rejected' | 'failed' | 'timed_out';

export interface GenerationResult<C extends TemplateCode> {
  text: string;
  structured: TemplateOutputMap[C];
  schemaVersion: string;
  aiGenerated: true;
}

interface GenerationJobBase {
  jobId: string;
  templateId: TemplateCode;
  createdAt: string;
  completedAt: string | null;
}

// 终态之外不交付结果；失败与审核拒绝不得被客户端误认为一次成功生成。
type SuccessfulGenerationJob = {
  [C in TemplateCode]: GenerationJobBase & {
      templateId: C;
      status: 'succeeded';
      result: GenerationResult<C>;
      creditsConsumed: 1;
    };
}[TemplateCode];

export type GenerationJobData =
  | SuccessfulGenerationJob
  | (GenerationJobBase & {
      status: Exclude<GenerationStatus, 'succeeded'>;
      result?: null;
      creditsConsumed: 0;
    });

export type GenerationJobResponse = ApiSuccess<GenerationJobData>;
