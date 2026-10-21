const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

// 名称和分类取自 PRD 的首期模板清单；只初始化目录，不伪造未经验证的 Prompt 版本。
const templates = [
  { code: 'XHS_TITLE', name: '小红书标题生成', category: '自媒体', description: '一次生成 5 个可独立复制的标题。' },
  { code: 'XHS_SCRIPT', name: '小红书内容脚本', category: '自媒体', description: '生成标题、开头、正文和结尾组成的内容脚本。' },
  { code: 'VIDEO_SPEECH', name: '短视频口播稿', category: '自媒体', description: '根据主题、要点和目标时长生成口播文案。' },
  { code: 'MOMENTS_COPY', name: '朋友圈文案', category: '自媒体', description: '根据主题、场景、语气和篇幅生成朋友圈文字。' },
  { code: 'TEXT_REWRITE', name: '文案润色改写', category: '自媒体', description: '在忠于原意的前提下优化已有文案。' },
  { code: 'WEEKLY_REPORT', name: '工作周报', category: '职场', description: '整理本周工作、成果、问题和下周计划。' },
  { code: 'MEETING_NOTES', name: '会议纪要', category: '职场', description: '根据用户提供的会议记录整理纪要。' },
  { code: 'WORK_EMAIL', name: '工作邮件', category: '职场', description: '根据收件对象、目的和要点生成邮件主题与正文。' },
  { code: 'ESSAY_OUTLINE', name: '作文提纲', category: '学生', description: '生成作文结构与写作思路，不生成完整作文。' },
  { code: 'THESIS_OUTLINE', name: '论文大纲', category: '学生', description: '提供研究问题与章节提纲，不代写论文。' },
];

function validateCatalog() {
  const codes = new Set(templates.map((item) => item.code));
  if (templates.length !== 10 || codes.size !== 10 ||
      templates.some((item) => item.code.length > 40 || item.name.length > 80 ||
        item.category.length > 32 || item.description.length > 500)) {
    throw new Error('模板初始化清单不符合数据库约束');
  }
}

async function main() {
  validateCatalog();
  if (process.argv.includes('--dry-run')) {
    for (const item of templates) process.stdout.write(`${item.code}\t${item.name}\t${item.category}\n`);
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error('缺少 DATABASE_URL');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
    connectionTimeoutMillis: 2000 });
  let client;
  let inserted = 0;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    for (const [index, item] of templates.entries()) {
      // 只按固定 code 插入缺失项；重跑不能覆盖运营人员后来修改的名称、排序或状态。
      const result = await client.query(
        `INSERT INTO templates (id, code, name, category, description, status, sort_order, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'disabled', $6, NOW())
         ON CONFLICT (code) DO NOTHING`,
        [randomUUID(), item.code, item.name, item.category, item.description, index + 1],
      );
      inserted += result.rowCount;
    }
    await client.query('COMMIT');
    process.stdout.write(`模板目录初始化完成：新增 ${inserted} 条，已有 ${templates.length - inserted} 条保持不变。\n`);
    process.stdout.write('新模板均为 disabled，未创建版本，不能用于生成；发布流程需单独完成。\n');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
