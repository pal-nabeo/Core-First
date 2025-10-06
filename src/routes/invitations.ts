// PAL物流SaaS - 招待管理API
import { Hono } from 'hono';
import { generateInvitationToken } from '../utils/auth';
import type { CloudflareBindings } from '../types/auth';

const invitationsApi = new Hono<{ Bindings: CloudflareBindings }>();

// デバッグ用API
invitationsApi.get('/debug', async (c) => {
  try {
    // 単純なクエリでテーブル存在確認
    const test = await c.env.DB.prepare("SELECT COUNT(*) as count FROM invitations").first();
    return c.json({ success: true, count: test.count });
  } catch (error) {
    return c.json({ success: false, error: error.message });
  }
});

// 招待一覧取得
invitationsApi.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const status = c.req.query('status') || '';
    const offset = (page - 1) * limit;

    // シンプルなクエリに変更（まずはJOINなしで基本機能を確認）
    let invitationsQuery = `
      SELECT 
        i.id,
        i.email,
        i.status,
        i.expires_at,
        i.invitation_message,
        i.created_at,
        i.accepted_at
      FROM invitations i
      WHERE 1=1
    `;

    const queryParams = [];

    if (status) {
      invitationsQuery += ' AND i.status = ?';
      queryParams.push(status);
    }

    invitationsQuery += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const result = await c.env.DB.prepare(invitationsQuery).bind(...queryParams).all();
    const invitations = result.results || [];

    // 総数取得
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as total FROM invitations i ${whereClause}
    `).bind(1, status || undefined).first(); // TODO: テナントIDを動的に取得

    const totalCount = countResult?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return c.json({
      success: true,
      data: {
        invitations,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_count: totalCount,
          limit
        }
      }
    });

  } catch (error) {
    console.error('Error fetching invitations:', error);
    return c.json({
      success: false,
      error: '招待一覧の取得中にエラーが発生しました'
    }, 500);
  }
});

// 新規招待作成
invitationsApi.post('/', async (c) => {
  try {
    const { email, role, message, expires_in, organization_unit_id } = await c.req.json();

    // バリデーション
    if (!email || !role) {
      return c.json({
        success: false,
        error: 'メールアドレスと権限は必須です'
      }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({
        success: false,
        error: '有効なメールアドレスを入力してください'
      }, 400);
    }

    // 既存ユーザーチェック
    const existingUser = await c.env.DB.prepare(`
      SELECT id FROM users 
      WHERE email = ?
    `).bind(email).first();

    if (existingUser) {
      return c.json({
        success: false,
        error: 'このメールアドレスは既に登録されています'
      }, 400);
    }

    // 既存の有効な招待チェック
    const existingInvitation = await c.env.DB.prepare(`
      SELECT id FROM invitations 
      WHERE email = ? AND status = 'pending' AND expires_at > datetime('now')
    `).bind(email).first();

    if (existingInvitation) {
      return c.json({
        success: false,
        error: 'このメールアドレスには既に有効な招待が送信されています'
      }, 400);
    }

    // 権限存在チェック
    const roleResult = await c.env.DB.prepare(`
      SELECT id FROM roles WHERE name = ? AND tenant_id = '1'
    `).bind(role).first();

    if (!roleResult) {
      return c.json({
        success: false,
        error: '指定された権限が見つかりません'
      }, 400);
    }

    // 招待トークン生成
    const token = generateInvitationToken();
    const expiresHours = parseInt(expires_in || '168'); // デフォルト7日間
    const expiresAt = new Date(Date.now() + (expiresHours * 60 * 60 * 1000)).toISOString();

    // 招待データを挿入
    const invitationId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO invitations (
        id, tenant_id, inviter_id, email, role_id, organization_unit_id,
        token, expires_at, status, invitation_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      invitationId,
      1, // テナントIDは1で固定
      1, // 招待者のユーザーIDは1で固定（後でセッションから取得）
      email,
      roleResult.id,
      organization_unit_id || null,
      token,
      expiresAt,
      'pending',
      message || null,
      new Date().toISOString()
    ).run();

    // 招待メール送信（実装は後で）
    // await sendInvitationEmail(email, token, message);

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      1, // テナントIDは1で固定
      1, // 招待者のユーザーIDは1で固定（後でセッションから取得）
      'invitation_sent',
      'invitation',
      invitationId,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: '招待が正常に送信されました',
      data: {
        invitation_id: invitationId,
        email,
        expires_at: expiresAt,
        // 開発環境ではトークンも返す（本番では削除）
        invitation_url: `${new URL(c.req.url).origin}/invite/${token}`
      }
    });

  } catch (error) {
    console.error('Error creating invitation:', error);
    return c.json({
      success: false,
      error: '招待の作成中にエラーが発生しました'
    }, 500);
  }
});

// 招待受諾（トークンベース）
invitationsApi.post('/accept/:token', async (c) => {
  try {
    const token = c.req.param('token');
    const { name, password } = await c.req.json();

    // バリデーション
    if (!name || !password) {
      return c.json({
        success: false,
        error: '名前とパスワードは必須です'
      }, 400);
    }

    if (password.length < 8) {
      return c.json({
        success: false,
        error: 'パスワードは8文字以上である必要があります'
      }, 400);
    }

    // 招待情報を取得
    const invitation = await c.env.DB.prepare(`
      SELECT 
        i.id, i.tenant_id, i.email, i.role_id, i.organization_unit_id,
        i.status, i.expires_at,
        r.name as role_name
      FROM invitations i
      JOIN roles r ON i.role_id = r.id
      WHERE i.token = ? AND i.status = 'pending'
    `).bind(token).first();

    if (!invitation) {
      return c.json({
        success: false,
        error: '招待が見つかりません、または既に使用されています'
      }, 400);
    }

    // 有効期限チェック
    if (new Date(invitation.expires_at) < new Date()) {
      return c.json({
        success: false,
        error: '招待の有効期限が切れています'
      }, 400);
    }

    // 既存ユーザーチェック（二重チェック）
    const existingUser = await c.env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(invitation.email).first();

    if (existingUser) {
      return c.json({
        success: false,
        error: 'このメールアドレスは既に登録されています'
      }, 400);
    }

    // パスワードハッシュ化
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'salt_string');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // ユーザー作成
    const userId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO users (
        id, tenant_id, email, display_name, hashed_password, 
        password_algo, status, email_verified, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      1, // テナントIDは1で固定
      invitation.email,
      name,
      hashHex,
      'sha256',
      'active',
      1, // メール検証済み（招待経由のため）
      new Date().toISOString()
    ).run();

    // ユーザーロール割り当て
    await c.env.DB.prepare(`
      INSERT INTO user_roles (
        id, user_id, role_id, organization_unit_id, scope, assigned_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      invitation.role_id,
      invitation.organization_unit_id,
      invitation.organization_unit_id ? 'organization_unit' : 'tenant',
      new Date().toISOString()
    ).run();

    // 招待ステータス更新
    await c.env.DB.prepare(`
      UPDATE invitations 
      SET status = 'accepted', accepted_at = ?, accepted_by = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), userId, invitation.id).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      1, // テナントIDは1で固定
      userId,
      'invitation_accepted',
      'user',
      userId,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: 'アカウントが正常に作成されました',
      data: {
        user_id: userId,
        email: invitation.email,
        name,
        role: invitation.role_name
      }
    });

  } catch (error) {
    console.error('Error accepting invitation:', error);
    return c.json({
      success: false,
      error: '招待受諾中にエラーが発生しました'
    }, 500);
  }
});

// 招待キャンセル
invitationsApi.delete('/:id', async (c) => {
  try {
    const invitationId = c.req.param('id');

    // 招待存在チェック
    const invitation = await c.env.DB.prepare(`
      SELECT id, email, status FROM invitations 
      WHERE id = ? AND tenant_id = ?
    `).bind(invitationId, 1).first(); // TODO: テナントIDを動的に取得

    if (!invitation) {
      return c.json({
        success: false,
        error: '招待が見つかりません'
      }, 404);
    }

    if (invitation.status !== 'pending') {
      return c.json({
        success: false,
        error: 'この招待はキャンセルできません'
      }, 400);
    }

    // 招待ステータス更新
    await c.env.DB.prepare(`
      UPDATE invitations 
      SET status = 'cancelled', updated_at = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), invitationId).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      1, // TODO: テナントIDを動的に取得
      null, // TODO: 実行者のユーザーIDをセッションから取得
      'invitation_cancelled',
      'invitation',
      invitationId,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: '招待が正常にキャンセルされました'
    });

  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return c.json({
      success: false,
      error: '招待のキャンセル中にエラーが発生しました'
    }, 500);
  }
});

export default invitationsApi;