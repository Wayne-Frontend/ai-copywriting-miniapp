// 与 packages/contracts/src/templates.ts、outputs.ts 的固定业务字段对应。
// 管理员可以调整文案和长度限制，但字段键、类型及输出结构必须保持契约兼容。
const str = { type: 'string', minLength: 1 };
const array = (items: unknown) => ({ type: 'array', items });
const obj = (properties: Record<string, unknown>) => ({
  type: 'object', additionalProperties: false, required: Object.keys(properties), properties,
});
const field = (type: 'string' | 'number' | 'boolean', maxLength?: number, values?: (string | number)[]) => ({
  type, ...(maxLength ? { maxLength } : {}), ...(values ? { enum: values } : {}),
});

export const TEMPLATE_DEFINITIONS = {
  XHS_TITLE: {
    fields: { topic: { ...field('string', 80), minLength: 2 }, audience: field('string', 50),
      sellingPoints: field('string', 300), style: field('string', undefined, ['真实', '活泼', '专业']) },
    required: ['topic', 'style'],
    output: obj({ items: { ...array(obj({ title: str, angle: str })), minItems: 5, maxItems: 5 } }),
  },
  XHS_SCRIPT: {
    fields: { topic: { ...field('string', 80), minLength: 2 }, keyPoints: { ...field('string', 500), minLength: 10 },
      audience: field('string', 50), style: field('string', undefined, ['分享', '种草', '知识']) },
    required: ['topic', 'keyPoints', 'style'],
    output: obj({ title: str, hook: str, bodyParagraphs: array(str), ending: str, hashtags: array(str) }),
  },
  VIDEO_SPEECH: {
    fields: { topic: { ...field('string', 80), minLength: 2 }, keyPoints: { ...field('string', 500), minLength: 10 },
      durationSeconds: field('number', undefined, [30, 60, 90]),
      style: field('string', undefined, ['自然', '热情', '专业']) },
    required: ['topic', 'keyPoints', 'durationSeconds', 'style'],
    output: obj({ hook: str, lines: array(str), ending: str }),
  },
  MOMENTS_COPY: {
    fields: { topic: { ...field('string', 80), minLength: 2 }, scene: field('string', undefined, ['日常', '活动', '产品', '节日']),
      tone: field('string', undefined, ['轻松', '真诚', '简洁']),
      targetLength: field('number', undefined, [50, 100, 150]) },
    required: ['topic', 'scene', 'tone', 'targetLength'],
    output: obj({ text: str }),
  },
  TEXT_REWRITE: {
    fields: { originalText: { ...field('string', 1500), minLength: 20 }, objective: field('string', undefined, ['精简', '更通顺', '更有感染力', '更正式']),
      style: field('string', undefined, ['保持原风格', '自然', '专业']) },
    required: ['originalText', 'objective'],
    output: obj({ rewrittenText: str, changeSummary: array(str) }),
  },
  WEEKLY_REPORT: {
    fields: { completedItems: { ...field('string', 1000), minLength: 10 }, achievements: field('string', 500),
      problems: field('string', 500), nextWeekPlan: { ...field('string', 500), minLength: 5 },
      style: field('string', undefined, ['简洁', '正式']) },
    required: ['completedItems', 'nextWeekPlan', 'style'],
    output: obj({ title: str, completed: array(str), achievements: array(str),
      problemsAndImprovements: array(str), nextWeek: array(str) }),
  },
  MEETING_NOTES: {
    fields: { rawNotes: { ...field('string', 2500), minLength: 20 }, meetingTitle: field('string', 80),
      meetingDate: { ...field('string', 10), pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, extractActionItems: field('boolean') },
    required: ['rawNotes'],
    output: obj({ title: str, meetingDate: { type: ['string', 'null'] }, participants: array(str),
      discussionPoints: array(str), decisions: array(str),
      actionItems: array(obj({ task: str, owner: { type: ['string', 'null'] }, dueDate: { type: ['string', 'null'] } })),
      openQuestions: array(str) }),
  },
  WORK_EMAIL: {
    fields: { recipientRole: { ...field('string', 80), minLength: 2 }, purpose: { ...field('string', 100), minLength: 2 },
      keyPoints: { ...field('string', 800), minLength: 10 }, tone: field('string', undefined, ['正式', '友好', '简洁']),
      subject: field('string', 100) },
    required: ['recipientRole', 'purpose', 'keyPoints', 'tone'],
    output: obj({ subject: str, greeting: str, bodyParagraphs: array(str), closing: str, signaturePlaceholder: str }),
  },
  ESSAY_OUTLINE: {
    fields: { topic: { ...field('string', 100), minLength: 2 }, schoolStage: field('string', undefined, ['小学', '初中', '高中']),
      writingDirection: field('string', 200), outlineStructure: field('string', undefined, ['三段式', '五段式']) },
    required: ['topic', 'schoolStage', 'outlineStructure'],
    output: obj({ topic: str, centralIdea: str, sections: array(obj({ heading: str, points: array(str) })),
      writingTips: array(str), materialDirections: array(str) }),
  },
  THESIS_OUTLINE: {
    fields: { researchTopic: { ...field('string', 120), minLength: 5 }, discipline: field('string', 80),
      schoolStage: field('string', undefined, ['本科', '硕士', '通用']), researchFocus: field('string', 300) },
    required: ['researchTopic', 'schoolStage'],
    output: obj({ titleSuggestion: str, researchQuestion: str, researchScope: str,
      chapters: array(obj({ heading: str, subsections: array(str) })),
      methodSuggestions: array(str), itemsToVerify: array(str) }),
  },
} as const;

export type ManagedTemplateCode = keyof typeof TEMPLATE_DEFINITIONS;
export function managedTemplateCode(value: string): value is ManagedTemplateCode {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_DEFINITIONS, value);
}

export function defaultFormSchema(code: ManagedTemplateCode): Record<string, unknown> {
  const definition = TEMPLATE_DEFINITIONS[code];
  const labels: Record<string, string> = {
    topic: '内容主题', audience: '目标受众', sellingPoints: '核心卖点', style: '表达风格',
    keyPoints: '主要内容与要点', durationSeconds: '目标时长（秒）', scene: '使用场景',
    tone: '语气', targetLength: '目标字数', originalText: '待改写原文', objective: '改写目标',
    completedItems: '本周完成工作', achievements: '工作成果', problems: '遇到的问题',
    nextWeekPlan: '下周计划', rawNotes: '原始会议记录', meetingTitle: '会议标题',
    meetingDate: '会议日期', extractActionItems: '提取待办事项', recipientRole: '收件人角色',
    purpose: '邮件目的', subject: '邮件主题', schoolStage: '学习阶段',
    writingDirection: '写作方向', outlineStructure: '提纲结构', researchTopic: '研究主题',
    discipline: '学科方向', researchFocus: '研究重点',
  };
  const properties = Object.fromEntries(Object.entries(definition.fields).map(([key, value]) =>
    [key, { ...value, title: labels[key] ?? key }]));
  return {
    type: 'object', additionalProperties: false, required: [...definition.required],
    properties,
  };
}

export function defaultOutputSchema(code: ManagedTemplateCode): Record<string, unknown> {
  return structuredClone(TEMPLATE_DEFINITIONS[code].output);
}
