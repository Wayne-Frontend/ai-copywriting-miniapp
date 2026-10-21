export const TEMPLATE_FIELDS = {
  XHS_TITLE: {
    topic: { type: 'text', required: true, minLength: 2, maxLength: 80 },
    audience: { type: 'text', required: false, maxLength: 50 },
    sellingPoints: { type: 'textarea', required: false, maxLength: 300 },
    style: { type: 'select', required: true, options: ['真实', '活泼', '专业'], default: '真实' },
  },
  XHS_SCRIPT: {
    topic: { type: 'text', required: true, minLength: 2, maxLength: 80 },
    keyPoints: { type: 'textarea', required: true, minLength: 10, maxLength: 500 },
    audience: { type: 'text', required: false, maxLength: 50 },
    style: { type: 'select', required: true, options: ['分享', '种草', '知识'], default: '分享' },
  },
  VIDEO_SPEECH: {
    topic: { type: 'text', required: true, minLength: 2, maxLength: 80 },
    keyPoints: { type: 'textarea', required: true, minLength: 10, maxLength: 500 },
    durationSeconds: { type: 'select', required: true, options: [30, 60, 90], default: 60 },
    style: { type: 'select', required: true, options: ['自然', '热情', '专业'], default: '自然' },
  },
  MOMENTS_COPY: {
    topic: { type: 'text', required: true, minLength: 2, maxLength: 80 },
    scene: { type: 'select', required: true, options: ['日常', '活动', '产品', '节日'] },
    tone: { type: 'select', required: true, options: ['轻松', '真诚', '简洁'] },
    targetLength: { type: 'select', required: true, options: [50, 100, 150] },
  },
  TEXT_REWRITE: {
    originalText: { type: 'textarea', required: true, minLength: 20, maxLength: 1500 },
    objective: { type: 'select', required: true, options: ['精简', '更通顺', '更有感染力', '更正式'] },
    style: { type: 'select', required: false, options: ['保持原风格', '自然', '专业'] },
  },
  WEEKLY_REPORT: {
    completedItems: { type: 'textarea', required: true, minLength: 10, maxLength: 1000 },
    achievements: { type: 'textarea', required: false, maxLength: 500 },
    problems: { type: 'textarea', required: false, maxLength: 500 },
    nextWeekPlan: { type: 'textarea', required: true, minLength: 5, maxLength: 500 },
    style: { type: 'select', required: true, options: ['简洁', '正式'], default: '简洁' },
  },
  MEETING_NOTES: {
    rawNotes: { type: 'textarea', required: true, minLength: 20, maxLength: 2500 },
    meetingTitle: { type: 'text', required: false, maxLength: 80 },
    meetingDate: { type: 'text', required: false, pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    extractActionItems: { type: 'boolean', required: false, default: true },
  },
  WORK_EMAIL: {
    recipientRole: { type: 'text', required: true, minLength: 2, maxLength: 80 },
    purpose: { type: 'text', required: true, minLength: 2, maxLength: 100 },
    keyPoints: { type: 'textarea', required: true, minLength: 10, maxLength: 800 },
    tone: { type: 'select', required: true, options: ['正式', '友好', '简洁'] },
    subject: { type: 'text', required: false, maxLength: 100 },
  },
  ESSAY_OUTLINE: {
    topic: { type: 'text', required: true, minLength: 2, maxLength: 100 },
    schoolStage: { type: 'select', required: true, options: ['小学', '初中', '高中'] },
    writingDirection: { type: 'textarea', required: false, maxLength: 200 },
    outlineStructure: { type: 'select', required: true, options: ['三段式', '五段式'] },
  },
  THESIS_OUTLINE: {
    researchTopic: { type: 'text', required: true, minLength: 5, maxLength: 120 },
    discipline: { type: 'text', required: false, maxLength: 80 },
    schoolStage: { type: 'select', required: true, options: ['本科', '硕士', '通用'] },
    researchFocus: { type: 'textarea', required: false, maxLength: 300 },
  },
} as const;

export type TemplateCode = keyof typeof TEMPLATE_FIELDS;

type FieldsOf<C extends TemplateCode> = (typeof TEMPLATE_FIELDS)[C];
type RequiredKeys<F> = {
  [K in keyof F]: F[K] extends { required: true } ? K : never;
}[keyof F];
type FieldValue<F> = F extends { type: 'boolean' }
  ? boolean
  : F extends { options: readonly (infer Option)[] }
    ? Option
    : string;

// 根据同一份字段配置推导请求类型，避免表单校验与接口类型各维护一套枚举。
export type TemplateInputs<C extends TemplateCode> = {
  [K in RequiredKeys<FieldsOf<C>>]: FieldValue<FieldsOf<C>[K]>;
} & {
  [K in Exclude<keyof FieldsOf<C>, RequiredKeys<FieldsOf<C>>>]?: FieldValue<FieldsOf<C>[K]>;
};
