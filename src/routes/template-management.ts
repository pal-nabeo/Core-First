import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const templateManagementApi = new Hono<{ Bindings: CloudflareBindings }>();

// テンプレート一覧の取得 (グローバル + テナント固有)
templateManagementApi.get('/templates', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    // グローバルテンプレートとテナント固有テンプレートを取得
    const stmt = c.env.DB.prepare(`
      SELECT 
        t.*,
        COUNT(DISTINCT tf.id) as field_count,
        u.name as created_by_name
      FROM mapping_templates t
      LEFT JOIN template_fields tf ON t.id = tf.template_id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.tenant_id IS NULL OR t.tenant_id = ?
      GROUP BY t.id
      ORDER BY t.is_global DESC, t.created_at DESC
    `);

    const result = await stmt.bind(user.tenant_id).all();

    return c.json({
      success: true,
      templates: result.results
    });

  } catch (error) {
    console.error('Template list error:', error);
    return c.json({ success: false, message: 'テンプレート一覧の取得に失敗しました' }, 500);
  }
});

// 特定テンプレートの詳細取得 (フィールド含む)
templateManagementApi.get('/templates/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const templateId = c.req.param('id');

    // テンプレート情報取得
    const templateStmt = c.env.DB.prepare(`
      SELECT t.*, u.name as created_by_name
      FROM mapping_templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ? AND (t.tenant_id IS NULL OR t.tenant_id = ?)
    `);
    const template = await templateStmt.bind(templateId, user.tenant_id).first();

    if (!template) {
      return c.json({ success: false, message: 'テンプレートが見つかりません' }, 404);
    }

    // フィールド情報取得
    const fieldsStmt = c.env.DB.prepare(`
      SELECT * FROM template_fields 
      WHERE template_id = ?
      ORDER BY field_order ASC
    `);
    const fields = await fieldsStmt.bind(templateId).all();

    return c.json({
      success: true,
      template: {
        ...template,
        fields: fields.results
      }
    });

  } catch (error) {
    console.error('Template detail error:', error);
    return c.json({ success: false, message: 'テンプレート詳細の取得に失敗しました' }, 500);
  }
});

// 新規テンプレートの作成
templateManagementApi.post('/templates', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    // テナント管理者以上の権限が必要
    if (!['tenant_owner', 'tenant_admin'].includes(user.role)) {
      return c.json({ success: false, message: '権限がありません' }, 403);
    }

    const body = await c.req.json();
    const { name, description, category, fields } = body;

    if (!name || !category) {
      return c.json({ success: false, message: 'テンプレート名とカテゴリは必須です' }, 400);
    }

    const templateId = crypto.randomUUID();
    const now = new Date().toISOString();

    // テンプレート作成
    const templateStmt = c.env.DB.prepare(`
      INSERT INTO mapping_templates (
        id, tenant_id, name, description, category, is_global,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await templateStmt.bind(
      templateId,
      user.tenant_id,
      name,
      description || null,
      category,
      0, // テナント固有テンプレート
      user.id,
      now,
      now
    ).run();

    // フィールド追加
    if (fields && Array.isArray(fields)) {
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const fieldId = crypto.randomUUID();
        
        const fieldStmt = c.env.DB.prepare(`
          INSERT INTO template_fields (
            id, template_id, field_name, field_label, field_type,
            field_order, is_required, validation_rules, default_value,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        await fieldStmt.bind(
          fieldId,
          templateId,
          field.field_name,
          field.field_label || field.field_name,
          field.field_type || 'text',
          i,
          field.is_required ? 1 : 0,
          field.validation_rules || null,
          field.default_value || null,
          now
        ).run();
      }
    }

    return c.json({
      success: true,
      template_id: templateId,
      message: 'テンプレートを作成しました'
    });

  } catch (error) {
    console.error('Template create error:', error);
    return c.json({ success: false, message: 'テンプレートの作成に失敗しました' }, 500);
  }
});

// テンプレートの更新
templateManagementApi.put('/templates/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    // テナント管理者以上の権限が必要
    if (!['tenant_owner', 'tenant_admin'].includes(user.role)) {
      return c.json({ success: false, message: '権限がありません' }, 403);
    }

    const templateId = c.req.param('id');
    const body = await c.req.json();
    const { name, description, category } = body;

    // テンプレート存在確認 (グローバルテンプレートは編集不可)
    const checkStmt = c.env.DB.prepare(`
      SELECT id, is_global FROM mapping_templates 
      WHERE id = ? AND tenant_id = ?
    `);
    const existing = await checkStmt.bind(templateId, user.tenant_id).first() as any;

    if (!existing) {
      return c.json({ success: false, message: 'テンプレートが見つかりません' }, 404);
    }

    if (existing.is_global) {
      return c.json({ success: false, message: 'グローバルテンプレートは編集できません' }, 403);
    }

    // テンプレート更新
    const updateStmt = c.env.DB.prepare(`
      UPDATE mapping_templates 
      SET name = ?, description = ?, category = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `);

    await updateStmt.bind(
      name,
      description || null,
      category,
      new Date().toISOString(),
      templateId,
      user.tenant_id
    ).run();

    return c.json({
      success: true,
      message: 'テンプレートを更新しました'
    });

  } catch (error) {
    console.error('Template update error:', error);
    return c.json({ success: false, message: 'テンプレートの更新に失敗しました' }, 500);
  }
});

// テンプレートの削除
templateManagementApi.delete('/templates/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    // テナント管理者以上の権限が必要
    if (!['tenant_owner', 'tenant_admin'].includes(user.role)) {
      return c.json({ success: false, message: '権限がありません' }, 403);
    }

    const templateId = c.req.param('id');

    // テンプレート存在確認 (グローバルテンプレートは削除不可)
    const checkStmt = c.env.DB.prepare(`
      SELECT id, is_global FROM mapping_templates 
      WHERE id = ? AND tenant_id = ?
    `);
    const existing = await checkStmt.bind(templateId, user.tenant_id).first() as any;

    if (!existing) {
      return c.json({ success: false, message: 'テンプレートが見つかりません' }, 404);
    }

    if (existing.is_global) {
      return c.json({ success: false, message: 'グローバルテンプレートは削除できません' }, 403);
    }

    // 関連するフィールドも削除
    const deleteFieldsStmt = c.env.DB.prepare(`
      DELETE FROM template_fields WHERE template_id = ?
    `);
    await deleteFieldsStmt.bind(templateId).run();

    // テンプレート削除
    const deleteStmt = c.env.DB.prepare(`
      DELETE FROM mapping_templates WHERE id = ? AND tenant_id = ?
    `);
    await deleteStmt.bind(templateId, user.tenant_id).run();

    return c.json({
      success: true,
      message: 'テンプレートを削除しました'
    });

  } catch (error) {
    console.error('Template delete error:', error);
    return c.json({ success: false, message: 'テンプレートの削除に失敗しました' }, 500);
  }
});

// テンプレートフィールドの追加
templateManagementApi.post('/templates/:id/fields', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    // テナント管理者以上の権限が必要
    if (!['tenant_owner', 'tenant_admin'].includes(user.role)) {
      return c.json({ success: false, message: '権限がありません' }, 403);
    }

    const templateId = c.req.param('id');
    const body = await c.req.json();
    const { field_name, field_label, field_type, is_required, validation_rules, default_value } = body;

    if (!field_name) {
      return c.json({ success: false, message: 'フィールド名は必須です' }, 400);
    }

    // テンプレート存在確認
    const checkStmt = c.env.DB.prepare(`
      SELECT id, is_global FROM mapping_templates 
      WHERE id = ? AND tenant_id = ?
    `);
    const existing = await checkStmt.bind(templateId, user.tenant_id).first() as any;

    if (!existing) {
      return c.json({ success: false, message: 'テンプレートが見つかりません' }, 404);
    }

    if (existing.is_global) {
      return c.json({ success: false, message: 'グローバルテンプレートは編集できません' }, 403);
    }

    // 現在の最大order取得
    const orderStmt = c.env.DB.prepare(`
      SELECT MAX(field_order) as max_order FROM template_fields WHERE template_id = ?
    `);
    const orderResult = await orderStmt.bind(templateId).first() as any;
    const nextOrder = (orderResult?.max_order || -1) + 1;

    // フィールド追加
    const fieldId = crypto.randomUUID();
    const insertStmt = c.env.DB.prepare(`
      INSERT INTO template_fields (
        id, template_id, field_name, field_label, field_type,
        field_order, is_required, validation_rules, default_value,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await insertStmt.bind(
      fieldId,
      templateId,
      field_name,
      field_label || field_name,
      field_type || 'text',
      nextOrder,
      is_required ? 1 : 0,
      validation_rules || null,
      default_value || null,
      new Date().toISOString()
    ).run();

    return c.json({
      success: true,
      field_id: fieldId,
      message: 'フィールドを追加しました'
    });

  } catch (error) {
    console.error('Field add error:', error);
    return c.json({ success: false, message: 'フィールドの追加に失敗しました' }, 500);
  }
});

// テンプレートフィールドの削除
templateManagementApi.delete('/templates/:templateId/fields/:fieldId', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    // テナント管理者以上の権限が必要
    if (!['tenant_owner', 'tenant_admin'].includes(user.role)) {
      return c.json({ success: false, message: '権限がありません' }, 403);
    }

    const templateId = c.req.param('templateId');
    const fieldId = c.req.param('fieldId');

    // テンプレート存在確認
    const checkStmt = c.env.DB.prepare(`
      SELECT id, is_global FROM mapping_templates 
      WHERE id = ? AND tenant_id = ?
    `);
    const existing = await checkStmt.bind(templateId, user.tenant_id).first() as any;

    if (!existing) {
      return c.json({ success: false, message: 'テンプレートが見つかりません' }, 404);
    }

    if (existing.is_global) {
      return c.json({ success: false, message: 'グローバルテンプレートは編集できません' }, 403);
    }

    // フィールド削除
    const deleteStmt = c.env.DB.prepare(`
      DELETE FROM template_fields WHERE id = ? AND template_id = ?
    `);
    await deleteStmt.bind(fieldId, templateId).run();

    return c.json({
      success: true,
      message: 'フィールドを削除しました'
    });

  } catch (error) {
    console.error('Field delete error:', error);
    return c.json({ success: false, message: 'フィールドの削除に失敗しました' }, 500);
  }
});

// テンプレートの複製
templateManagementApi.post('/templates/:id/duplicate', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    // テナント管理者以上の権限が必要
    if (!['tenant_owner', 'tenant_admin'].includes(user.role)) {
      return c.json({ success: false, message: '権限がありません' }, 403);
    }

    const templateId = c.req.param('id');

    // 元のテンプレート取得 (グローバルテンプレートも複製可能)
    const templateStmt = c.env.DB.prepare(`
      SELECT * FROM mapping_templates 
      WHERE id = ? AND (tenant_id IS NULL OR tenant_id = ?)
    `);
    const template = await templateStmt.bind(templateId, user.tenant_id).first() as any;

    if (!template) {
      return c.json({ success: false, message: 'テンプレートが見つかりません' }, 404);
    }

    // フィールド取得
    const fieldsStmt = c.env.DB.prepare(`
      SELECT * FROM template_fields WHERE template_id = ? ORDER BY field_order ASC
    `);
    const fields = await fieldsStmt.bind(templateId).all();

    // 新しいテンプレートID
    const newTemplateId = crypto.randomUUID();
    const now = new Date().toISOString();

    // テンプレート複製
    const duplicateStmt = c.env.DB.prepare(`
      INSERT INTO mapping_templates (
        id, tenant_id, name, description, category, is_global,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await duplicateStmt.bind(
      newTemplateId,
      user.tenant_id,
      `${template.name} (コピー)`,
      template.description,
      template.category,
      0, // テナント固有として複製
      user.id,
      now,
      now
    ).run();

    // フィールド複製
    for (const field of fields.results as any[]) {
      const newFieldId = crypto.randomUUID();
      const fieldStmt = c.env.DB.prepare(`
        INSERT INTO template_fields (
          id, template_id, field_name, field_label, field_type,
          field_order, is_required, validation_rules, default_value,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await fieldStmt.bind(
        newFieldId,
        newTemplateId,
        field.field_name,
        field.field_label,
        field.field_type,
        field.field_order,
        field.is_required,
        field.validation_rules,
        field.default_value,
        now
      ).run();
    }

    return c.json({
      success: true,
      template_id: newTemplateId,
      message: 'テンプレートを複製しました'
    });

  } catch (error) {
    console.error('Template duplicate error:', error);
    return c.json({ success: false, message: 'テンプレートの複製に失敗しました' }, 500);
  }
});

export default templateManagementApi;
