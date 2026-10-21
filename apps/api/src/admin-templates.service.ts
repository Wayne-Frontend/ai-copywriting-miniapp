import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
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

  private async findXhsTitle(client: PoolClient): Promise<AdminTemplateDraft['template'] & { id: string } | null> {
    const result = await client.query<AdminTemplateDraft['template'] & { id: string }>(
      'SELECT id, code, name, description, status FROM templates WHERE code = $1',
      [XHS_TITLE_CODE],
    );
    return result.rows[0] ?? null;
  }

  private async latestDraft(client: PoolClient, templateId: string): Promise<DraftRow | null> {
    const result = await client.query<DraftRow>(
      `SELECT id, version, developer_prompt, change_log FROM template_versions
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
      return {
        template: { code: template.code, name: template.name, description: template.description, status: template.status },
        version: draft?.version ?? await this.nextVersion(client, template.id),
        developerPrompt: draft?.developer_prompt ?? XHS_TITLE_DEVELOPER_PROMPT,
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
           RETURNING id, version, developer_prompt, change_log`,
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
           RETURNING id, version, developer_prompt, change_log`,
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
}
