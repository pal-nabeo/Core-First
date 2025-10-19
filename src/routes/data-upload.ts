import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const dataUploadApi = new Hono<{ Bindings: CloudflareBindings }>();

// ファイルアップロード処理
dataUploadApi.post('/upload', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const templateId = formData.get('template_id') as string;
    
    if (!file) {
      return c.json({ success: false, message: 'ファイルが選択されていません' }, 400);
    }

    // ファイルサイズチェック (100MB制限)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ success: false, message: 'ファイルサイズは100MBまでです' }, 400);
    }

    // ファイルタイプチェック
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json', 'application/xml', 'application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ success: false, message: '対応していないファイル形式です' }, 400);
    }

    // ファイルタイプの判定
    let fileType = 'other';
    if (file.type.includes('csv')) fileType = 'csv';
    else if (file.type.includes('excel') || file.type.includes('spreadsheet')) fileType = 'excel';
    else if (file.type.includes('json')) fileType = 'json';
    else if (file.type.includes('xml')) fileType = 'xml';
    else if (file.type.includes('pdf')) fileType = 'pdf';
    else if (file.type.includes('image')) fileType = 'image';

    // アップロードIDの生成
    const uploadId = crypto.randomUUID();
    const now = new Date().toISOString();

    // データベースにアップロード情報を記録
    const stmt = c.env.DB.prepare(`
      INSERT INTO data_uploads (
        id, tenant_id, uploaded_by, file_name, file_size, file_type,
        template_id, status, progress, total_rows, processed_rows,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      uploadId,
      user.tenant_id,
      user.id,
      file.name,
      file.size,
      fileType,
      templateId || null,
      'pending',
      0,
      0,
      0,
      now,
      now
    ).run();

    // TODO: R2ストレージへのファイル保存処理
    // const fileBuffer = await file.arrayBuffer();
    // await c.env.R2?.put(`uploads/${uploadId}/${file.name}`, fileBuffer);

    // TODO: バックグラウンドでファイル処理を開始
    // - CSVパース
    // - データ検証
    // - マッピング適用
    // - データベースへの格納

    return c.json({ 
      success: true, 
      upload_id: uploadId,
      message: 'ファイルアップロードが開始されました',
      status: 'pending'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ success: false, message: 'アップロード処理に失敗しました' }, 500);
  }
});

// アップロード履歴の取得
dataUploadApi.get('/history', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const stmt = c.env.DB.prepare(`
      SELECT 
        u.id, u.file_name, u.file_size, u.file_type, u.status,
        u.progress, u.total_rows, u.processed_rows, u.success_rows,
        u.failed_rows, u.error_message, u.created_at, u.updated_at,
        t.name as template_name,
        usr.name as uploaded_by_name
      FROM data_uploads u
      LEFT JOIN mapping_templates t ON u.template_id = t.id
      LEFT JOIN users usr ON u.uploaded_by = usr.id
      WHERE u.tenant_id = ?
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const result = await stmt.bind(user.tenant_id, limit, offset).all();

    return c.json({
      success: true,
      uploads: result.results,
      total: result.results.length
    });

  } catch (error) {
    console.error('History fetch error:', error);
    return c.json({ success: false, message: '履歴の取得に失敗しました' }, 500);
  }
});

// 特定アップロードの詳細取得
dataUploadApi.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const uploadId = c.req.param('id');

    const stmt = c.env.DB.prepare(`
      SELECT 
        u.*,
        t.name as template_name,
        usr.name as uploaded_by_name,
        usr.email as uploaded_by_email
      FROM data_uploads u
      LEFT JOIN mapping_templates t ON u.template_id = t.id
      LEFT JOIN users usr ON u.uploaded_by = usr.id
      WHERE u.id = ? AND u.tenant_id = ?
    `);

    const result = await stmt.bind(uploadId, user.tenant_id).first();

    if (!result) {
      return c.json({ success: false, message: 'アップロードが見つかりません' }, 404);
    }

    return c.json({
      success: true,
      upload: result
    });

  } catch (error) {
    console.error('Upload detail fetch error:', error);
    return c.json({ success: false, message: '詳細の取得に失敗しました' }, 500);
  }
});

// アップロードの削除
dataUploadApi.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const uploadId = c.req.param('id');

    // テナント確認
    const checkStmt = c.env.DB.prepare(`
      SELECT id FROM data_uploads WHERE id = ? AND tenant_id = ?
    `);
    const existing = await checkStmt.bind(uploadId, user.tenant_id).first();

    if (!existing) {
      return c.json({ success: false, message: 'アップロードが見つかりません' }, 404);
    }

    // TODO: R2からファイルも削除
    // await c.env.R2?.delete(`uploads/${uploadId}`);

    // データベースから削除
    const deleteStmt = c.env.DB.prepare(`
      DELETE FROM data_uploads WHERE id = ? AND tenant_id = ?
    `);
    await deleteStmt.bind(uploadId, user.tenant_id).run();

    return c.json({
      success: true,
      message: 'アップロードを削除しました'
    });

  } catch (error) {
    console.error('Upload delete error:', error);
    return c.json({ success: false, message: '削除に失敗しました' }, 500);
  }
});

// アップロードの再処理
dataUploadApi.post('/:id/retry', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const uploadId = c.req.param('id');

    // テナント確認とステータスチェック
    const checkStmt = c.env.DB.prepare(`
      SELECT id, status FROM data_uploads WHERE id = ? AND tenant_id = ?
    `);
    const existing = await checkStmt.bind(uploadId, user.tenant_id).first() as any;

    if (!existing) {
      return c.json({ success: false, message: 'アップロードが見つかりません' }, 404);
    }

    if (existing.status !== 'failed') {
      return c.json({ success: false, message: '失敗したアップロードのみ再処理できます' }, 400);
    }

    // ステータスをpendingに戻す
    const updateStmt = c.env.DB.prepare(`
      UPDATE data_uploads 
      SET status = 'pending', progress = 0, error_message = NULL, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `);
    await updateStmt.bind(new Date().toISOString(), uploadId, user.tenant_id).run();

    // TODO: バックグラウンド処理を再開

    return c.json({
      success: true,
      message: '再処理を開始しました'
    });

  } catch (error) {
    console.error('Upload retry error:', error);
    return c.json({ success: false, message: '再処理の開始に失敗しました' }, 500);
  }
});

// アップロード統計の取得
dataUploadApi.get('/stats/summary', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const stmt = c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_uploads,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_uploads,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_uploads,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_uploads,
        SUM(file_size) as total_size,
        SUM(total_rows) as total_rows
      FROM data_uploads
      WHERE tenant_id = ?
    `);

    const result = await stmt.bind(user.tenant_id).first();

    return c.json({
      success: true,
      stats: result
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    return c.json({ success: false, message: '統計の取得に失敗しました' }, 500);
  }
});

export default dataUploadApi;
