import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Pool, type PoolClient } from 'pg';

const XHS_TITLE_CODE = 'XHS_TITLE';
const XHS_TITLE_DEVELOPER_PROMPT = `你是一名擅长中文生活方式与内容平台表达的标题编辑。

请根据输入的主题、亮点、受众和语气，生成恰好 5 个小红书风格标题。

要求：
1. 5 个标题应具有不同切入角度，不得只是替换少量同义词。
2. 标题自然、具体、有吸引力。
3. 优先突出真实亮点、用户收益或明确场景。
4. 不得编造价格、数据、效果、身份或经历。
5. 不使用虚假紧迫感和夸张保证。
6. 不堆砌 Emoji 或连续感叹号。
7. 建议每条标题控制在适合手机阅读的长度。
8. angle 使用简短中文标签，例如“场景型”“问题型”“经验型”。
9. 只返回指定 JSON 结构。`;

// 首个样例模板的字段和输出结构取自项目契约与 Prompt 规范；草稿阶段不允许后台单独改动它们。
const XHS_TITLE_FORM_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['topic', 'style'],
  properties: {
    topic: { type: 'string', minLength: 2, maxLength: 80 },
    audience: { type: 'string', maxLength: 50 },
    sellingPoints: { type: 'string', maxLength: 300 },
    style: { type: 'string', enum: ['真实', '活泼', '专业'], default: '真实' },
  },
};
const XHS_TITLE_OUTPUT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: {
    items: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'angle'],
        properties: { title: { type: 'string', minLength: 1 }, angle: { type: 'string', minLength: 1 } },
      },
    },
  },
};

interface DraftRow {
  id: string;
  version: number;
  developer_prompt: string;
  change_log: string;
  form_schema: unknown;
  output_schema: unknown;
  system_prompt_version: string;
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

function draftRevision(row: DraftRow): string {
  return createHash('sha256').update(JSON.stringify([row.id, row.version, row.developer_prompt, row.change_log])).digest('hex');
}

interface TemplateRow {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  status: string;
  current_version: number | null;
  updated_at: Date;
  updated_by_username: string | null;
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

interface PublishedVersionRow {
  version: number;
  is_current: boolean;
  model: string | null;
  change_log: string;
  published_at: Date | null;
  published_by_username: string | null;
}

interface PublishedVersionDetailRow extends PublishedVersionRow {
  system_prompt_version: string;
  developer_prompt: string;
  form_schema: unknown;
  output_schema: unknown;
  model_config: Record<string, unknown>;
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
  systemPromptVersion: string;
  developerPrompt: string;
  formSchema: unknown;
  outputSchema: unknown;
  modelConfig: Record<string, unknown>;
}

function publishedVersion(row: PublishedVersionRow): AdminPublishedTemplateVersion {
  return {
    version: row.version,
    isCurrent: row.is_current,
    model: row.model,
    changeLog: row.change_log,
    publishedAt: row.published_at?.toISOString() ?? null,
    publishedByUsername: row.published_by_username,
  };
}

@Injectable()
export class AdminTemplatesService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 2000,
  });

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async list(): Promise<AdminTemplateListItem[]> {
    // current_version_id 仅代表已选中的版本；历史模板的 updated_by 保持空值，不用发布人代替更新人。
    const result = await this.pool.query<TemplateRow>(
      `SELECT t.id, t.code, t.name, t.category, t.description, t.status,
              v.version AS current_version, t.updated_at,
              a.username AS updated_by_username
       FROM templates t
       LEFT JOIN template_versions v ON v.id = t.current_version_id AND v.template_id = t.id
       LEFT JOIN admin_users a ON a.id = t.updated_by
       ORDER BY t.sort_order ASC, t.code ASC`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      description: row.description,
      status: row.status,
      currentVersion: row.current_version,
      updatedAt: row.updated_at.toISOString(),
      updatedByUsername: row.updated_by_username,
    }));
  }

  async listXhsTitlePublishedVersions(): Promise<AdminPublishedTemplateVersion[] | null> {
    const result = await this.pool.query<PublishedVersionRow>(
      `SELECT v.version, v.id = t.current_version_id AS is_current,
              v.model_config->>'model' AS model, v.change_log, v.published_at,
              a.username AS published_by_username
       FROM templates t
       JOIN template_versions v ON v.template_id = t.id AND v.status = 'published'
       LEFT JOIN admin_users a ON a.id = v.published_by
       WHERE t.code = $1 ORDER BY v.version DESC`,
      [XHS_TITLE_CODE],
    );
    // 空历史和模板不存在需要区分，以免后台把错误配置显示成“暂无发布版本”。
    if (result.rows.length === 0) {
      const exists = await this.pool.query('SELECT 1 FROM templates WHERE code = $1', [XHS_TITLE_CODE]);
      if (exists.rowCount === 0) return null;
    }
    return result.rows.map(publishedVersion);
  }

  async getXhsTitlePublishedVersion(version: number): Promise<AdminPublishedTemplateVersionDetail | null> {
    const result = await this.pool.query<PublishedVersionDetailRow>(
      `SELECT v.version, v.id = t.current_version_id AS is_current,
              v.model_config->>'model' AS model, v.change_log, v.published_at,
              a.username AS published_by_username, v.system_prompt_version,
              v.developer_prompt, v.form_schema, v.output_schema, v.model_config
       FROM templates t
       JOIN template_versions v ON v.template_id = t.id AND v.status = 'published'
       LEFT JOIN admin_users a ON a.id = v.published_by
       WHERE t.code = $1 AND v.version = $2`,
      [XHS_TITLE_CODE, version],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      ...publishedVersion(row),
      systemPromptVersion: row.system_prompt_version,
      developerPrompt: row.developer_prompt,
      formSchema: row.form_schema,
      outputSchema: row.output_schema,
      // 管理端只展示运行参数；即使旧数据误把密钥写入 JSON，也不能从详情接口带出。
      modelConfig: {
        provider: typeof row.model_config?.provider === 'string' ? row.model_config.provider : undefined,
        model: typeof row.model_config?.model === 'string' ? row.model_config.model : undefined,
        maxTokens: typeof row.model_config?.maxTokens === 'number' ? row.model_config.maxTokens : undefined,
        responseFormat: typeof row.model_config?.responseFormat === 'string' ? row.model_config.responseFormat : undefined,
      },
    };
  }

  private async findXhsTitle(client: PoolClient): Promise<AdminTemplateDraft['template'] & { id: string } | null> {
    const result = await client.query<AdminTemplateDraft['template'] & { id: string }>(
      'SELECT id, code, name, description, status FROM templates WHERE code = $1',
      [XHS_TITLE_CODE],
    );
    return result.rows[0] ?? null;
  }

  private async latestDraft(client: PoolClient, templateId: string): Promise<DraftRow | null> {
    const result = await client.query<DraftRow>(
      `SELECT id, version, developer_prompt, change_log, form_schema, output_schema, system_prompt_version FROM template_versions
       WHERE template_id = $1 AND status = 'draft' ORDER BY version DESC LIMIT 1`,
      [templateId],
    );
    return result.rows[0] ?? null;
  }

  private async nextVersion(client: PoolClient, templateId: string): Promise<number> {
    const result = await client.query<{ next_version: number }>(
      'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM template_versions WHERE template_id = $1',
      [templateId],
    );
    return result.rows[0]?.next_version ?? 1;
  }

  async getXhsTitleDraft(): Promise<AdminTemplateDraft | null> {
    const client = await this.pool.connect();
    try {
      const template = await this.findXhsTitle(client);
      if (!template) return null;
      const draft = await this.latestDraft(client, template.id);
      // 新草稿继承当前已发布 Prompt，避免发布后再次编辑时退回最初的示例文本。
      const published = draft ? null : await client.query<{ developer_prompt: string }>(
        `SELECT v.developer_prompt FROM templates t
         JOIN template_versions v ON v.id = t.current_version_id AND v.template_id = t.id
         WHERE t.id = $1 AND v.status = 'published'`,
        [template.id],
      );
      return {
        template: { code: template.code, name: template.name, description: template.description, status: template.status },
        version: draft?.version ?? await this.nextVersion(client, template.id),
        developerPrompt: draft?.developer_prompt ?? published?.rows[0]?.developer_prompt ?? XHS_TITLE_DEVELOPER_PROMPT,
        changeLog: draft?.change_log ?? '',
        revision: draft ? draftRevision(draft) : null,
        saved: !!draft,
      };
    } finally {
      client.release();
    }
  }

  async saveXhsTitleDraft(input: SaveTemplateDraftInput, adminId: string): Promise<AdminTemplateDraft | 'not_found' | 'conflict'> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // 锁定模板行，确保同一模板首次建草稿和版本号分配串行进行。
      const templateResult = await client.query<AdminTemplateDraft['template'] & { id: string }>(
        'SELECT id, code, name, description, status FROM templates WHERE code = $1 FOR UPDATE',
        [XHS_TITLE_CODE],
      );
      const template = templateResult.rows[0];
      if (!template) {
        await client.query('ROLLBACK');
        return 'not_found';
      }
      const draft = await this.latestDraft(client, template.id);
      // revision 防止另一个管理员覆盖已保存的 Prompt；首次保存也要求客户端仍看到“无草稿”。
      if ((draft ? draftRevision(draft) : null) !== input.revision) {
        await client.query('ROLLBACK');
        return 'conflict';
      }
      let saved: DraftRow;
      if (draft) {
        const result = await client.query<DraftRow>(
          `UPDATE template_versions SET developer_prompt = $2, change_log = $3
           WHERE id = $1 AND status = 'draft'
           RETURNING id, version, developer_prompt, change_log, form_schema, output_schema, system_prompt_version`,
          [draft.id, input.developerPrompt.trim(), input.changeLog.trim()],
        );
        saved = result.rows[0]!;
      } else {
        const version = await this.nextVersion(client, template.id);
        const result = await client.query<DraftRow>(
          `INSERT INTO template_versions
           (id, template_id, version, status, form_schema, output_schema, system_prompt_version,
            developer_prompt, model_config, change_log)
           VALUES ($1, $2, $3, 'draft', $4::jsonb, $5::jsonb, 'SYSTEM_PROMPT_V1', $6, $7::jsonb, $8)
           RETURNING id, version, developer_prompt, change_log, form_schema, output_schema, system_prompt_version`,
          [randomUUID(), template.id, version, JSON.stringify(XHS_TITLE_FORM_SCHEMA),
            JSON.stringify(XHS_TITLE_OUTPUT_SCHEMA), input.developerPrompt.trim(), '{}', input.changeLog.trim()],
        );
        saved = result.rows[0]!;
      }
      // 模板列表展示最近编辑人；current_version_id 和 status 不变，草稿不会影响线上版本。
      await client.query('UPDATE templates SET updated_by = $2, updated_at = NOW() WHERE id = $1', [template.id, adminId]);
      await client.query('COMMIT');
      return {
        template: { code: template.code, name: template.name, description: template.description, status: template.status },
        version: saved.version,
        developerPrompt: saved.developer_prompt,
        changeLog: saved.change_log,
        revision: draftRevision(saved),
        saved: true,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async publishXhsTitleDraft(
    revision: string, adminId: string, requestId: string, clientIp: string,
  ): Promise<PublishTemplateResult | 'not_found' | 'conflict' | 'invalid'> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // 发布与保存争用同一模板行锁，防止校验后草稿被改写，或并发发布两个版本。
      const templateResult = await client.query<{ id: string; status: string; current_version_id: string | null }>(
        'SELECT id, status, current_version_id FROM templates WHERE code = $1 FOR UPDATE',
        [XHS_TITLE_CODE],
      );
      const template = templateResult.rows[0];
      if (!template) {
        await client.query('ROLLBACK');
        return 'not_found';
      }
      const draft = await this.latestDraft(client, template.id);
      if (!draft || draftRevision(draft) !== revision) {
        await client.query('ROLLBACK');
        return 'conflict';
      }
      // 契约与系统提示词由代码固定；数据库中的草稿若偏离契约，禁止直接发布。
      if (!isDeepStrictEqual(draft.form_schema, XHS_TITLE_FORM_SCHEMA) ||
        !isDeepStrictEqual(draft.output_schema, XHS_TITLE_OUTPUT_SCHEMA) ||
        draft.system_prompt_version !== 'SYSTEM_PROMPT_V1' ||
        !draft.developer_prompt.trim() || draft.developer_prompt.length > 10000 ||
        !draft.change_log.trim() || draft.change_log.length > 500 ||
        !['disabled', 'active'].includes(template.status)) {
        await client.query('ROLLBACK');
        return 'invalid';
      }
      const model = process.env.DASHSCOPE_MODEL?.trim() || 'qwen-plus';
      if (!process.env.DASHSCOPE_API_KEY?.trim() || !model || model.length > 100) {
        await client.query('ROLLBACK');
        return 'invalid';
      }
      // 只固化非密钥配置，历史版本内容发布后不再修改；后续任务可固定引用该版本。
      const published = await client.query<{ published_at: Date }>(
        `UPDATE template_versions
         SET status = 'published', model_config = $2::jsonb, published_by = $3, published_at = NOW()
         WHERE id = $1 AND status = 'draft' RETURNING published_at`,
        [draft.id, JSON.stringify({ provider: 'bailian', model, maxTokens: 512, responseFormat: 'json_object' }), adminId],
      );
      await client.query(
        `UPDATE templates SET current_version_id = $2, status = 'active', updated_by = $3, updated_at = NOW()
         WHERE id = $1`,
        [template.id, draft.id, adminId],
      );
      await client.query(
        `INSERT INTO admin_audit_logs
         (id, admin_user_id, action, resource_type, resource_id, request_id, ip_hash, change_summary)
         VALUES ($1, $2, 'template.publish', 'template', $3, $4, $5, $6::jsonb)`,
        [randomUUID(), adminId, template.id, requestId, createHash('sha256').update(clientIp).digest('hex'),
          JSON.stringify({ code: XHS_TITLE_CODE, version: draft.version,
            previousVersionId: template.current_version_id, model })],
      );
      await client.query('COMMIT');
      return { version: draft.version, status: 'active', publishedAt: published.rows[0]!.published_at.toISOString(), model };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async changeXhsTitleAvailability(
    input: ChangeTemplateAvailabilityInput, adminId: string, requestId: string, clientIp: string,
  ): Promise<ChangeTemplateAvailabilityResult | 'not_found' | 'conflict' | 'invalid'> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{
        id: string; status: string; current_version_id: string | null;
        current_version: number | null; version_status: string | null;
      }>(
        `SELECT t.id, t.status, t.current_version_id,
                v.version AS current_version, v.status AS version_status
         FROM templates t
         LEFT JOIN template_versions v ON v.id = t.current_version_id AND v.template_id = t.id
         WHERE t.code = $1 FOR UPDATE OF t`,
        [XHS_TITLE_CODE],
      );
      const template = result.rows[0];
      if (!template) {
        await client.query('ROLLBACK');
        return 'not_found';
      }
      // 用页面读取到的状态和版本做并发检查，避免另一位管理员刚发布或上下架后被旧页面覆盖。
      if (template.status !== input.expectedStatus ||
        template.current_version !== input.expectedVersion ||
        template.status === input.status) {
        await client.query('ROLLBACK');
        return 'conflict';
      }
      // 上下架只改变入口可用性，不能替换或修改已发布版本；无已发布版本的模板不可上架。
      if (!template.current_version_id || template.current_version === null ||
        template.version_status !== 'published' ||
        !['active', 'disabled'].includes(template.status)) {
        await client.query('ROLLBACK');
        return 'invalid';
      }
      const updated = await client.query<{ updated_at: Date }>(
        'UPDATE templates SET status = $2, updated_by = $3, updated_at = NOW() WHERE id = $1 RETURNING updated_at',
        [template.id, input.status, adminId],
      );
      await client.query(
        `INSERT INTO admin_audit_logs
         (id, admin_user_id, action, resource_type, resource_id, request_id, ip_hash, change_summary)
         VALUES ($1, $2, $3, 'template', $4, $5, $6, $7::jsonb)`,
        [randomUUID(), adminId, input.status === 'active' ? 'template.enable' : 'template.disable',
          template.id, requestId, createHash('sha256').update(clientIp).digest('hex'),
          JSON.stringify({ code: XHS_TITLE_CODE, previousStatus: template.status,
            status: input.status, version: template.current_version })],
      );
      await client.query('COMMIT');
      return { status: input.status, currentVersion: template.current_version,
        updatedAt: updated.rows[0]!.updated_at.toISOString() };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rollbackXhsTitleVersion(
    targetVersion: number, input: RollbackTemplateVersionInput,
    adminId: string, requestId: string, clientIp: string,
  ): Promise<RollbackTemplateVersionResult | 'not_found' | 'conflict' | 'invalid'> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{
        id: string; status: string; current_version_id: string | null;
        current_version: number | null; version_status: string | null;
      }>(
        `SELECT t.id, t.status, t.current_version_id,
                v.version AS current_version, v.status AS version_status
         FROM templates t
         LEFT JOIN template_versions v ON v.id = t.current_version_id AND v.template_id = t.id
         WHERE t.code = $1 FOR UPDATE OF t`,
        [XHS_TITLE_CODE],
      );
      const template = result.rows[0];
      if (!template) {
        await client.query('ROLLBACK');
        return 'not_found';
      }
      // 锁定模板后核对页面快照，避免并发发布、上下架或回滚覆盖另一位管理员的操作。
      if (template.current_version !== input.expectedCurrentVersion ||
        template.status !== input.expectedStatus || template.current_version === targetVersion) {
        await client.query('ROLLBACK');
        return 'conflict';
      }
      if (!template.current_version_id || template.version_status !== 'published' ||
        !['active', 'disabled'].includes(template.status)) {
        await client.query('ROLLBACK');
        return 'invalid';
      }
      const target = await client.query<{ id: string }>(
        `SELECT id FROM template_versions
         WHERE template_id = $1 AND version = $2 AND status = 'published'`,
        [template.id, targetVersion],
      );
      if (!target.rows[0]) {
        await client.query('ROLLBACK');
        return 'not_found';
      }
      // 历史版本和已绑定该版本的任务不可变；仅切换模板指针，且下架中的模板仍保持下架。
      const updated = await client.query<{ updated_at: Date }>(
        'UPDATE templates SET current_version_id = $2, updated_by = $3, updated_at = NOW() WHERE id = $1 RETURNING updated_at',
        [template.id, target.rows[0].id, adminId],
      );
      await client.query(
        `INSERT INTO admin_audit_logs
         (id, admin_user_id, action, resource_type, resource_id, request_id, ip_hash, change_summary)
         VALUES ($1, $2, 'template.rollback', 'template', $3, $4, $5, $6::jsonb)`,
        [randomUUID(), adminId, template.id, requestId, createHash('sha256').update(clientIp).digest('hex'),
          JSON.stringify({ code: XHS_TITLE_CODE, previousVersion: template.current_version,
            currentVersion: targetVersion, status: template.status, reason: input.reason.trim() })],
      );
      await client.query('COMMIT');
      return { previousVersion: template.current_version!, currentVersion: targetVersion,
        status: template.status as 'active' | 'disabled',
        updatedAt: updated.rows[0]!.updated_at.toISOString() };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
