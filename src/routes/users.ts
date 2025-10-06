// ユーザー管理API
import { Hono } from 'hono'

type Bindings = {
  DB: D1Database;
}

const usersApi = new Hono<{ Bindings: Bindings }>()

// ユーザー一覧取得
usersApi.get('/', async (c) => {
  try {
    const { page = '1', limit = '20', search = '', role = '', status = '' } = c.req.query();
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE u.tenant_id = ?';
    let params: any[] = ['tenant_abc_logistics']; // TODO: テナントIDを動的に取得
    
    // 検索条件
    if (search) {
      whereClause += ' AND (u.display_name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (role) {
      whereClause += ' AND r.name = ?';
      params.push(role);
    }
    
    if (status) {
      whereClause += ' AND u.status = ?';
      params.push(status);
    }

    // ユーザー一覧取得（ページング付き）
    const usersQuery = `
      SELECT 
        u.id,
        u.email,
        u.display_name as name,
        u.status,
        u.last_login_at,
        u.created_at,
        r.name as role,
        COUNT(*) OVER() as total_count
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limitNum, offset);
    
    const result = await c.env.DB.prepare(usersQuery).bind(...params).all();
    
    const users = result.results || [];
    const totalCount = users.length > 0 ? users[0].total_count : 0;
    const totalPages = Math.ceil(totalCount / limitNum);

    // 各ユーザーの詳細情報を取得
    const enrichedUsers = await Promise.all(users.map(async (user: any) => {
      // 最後のログイン情報を取得
      const lastLoginResult = await c.env.DB.prepare(`
        SELECT created_at as login_at, ip_address 
        FROM audit_logs 
        WHERE actor_user_id = ? AND action_type = 'login' 
        ORDER BY created_at DESC 
        LIMIT 1
      `).bind(user.id).first();

      return {
        ...user,
        last_login: lastLoginResult ? {
          date: lastLoginResult.login_at,
          ip: lastLoginResult.ip_address
        } : null,
        total_count: undefined // レスポンスから除外
      };
    }));

    return c.json({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: {
          current_page: pageNum,
          total_pages: totalPages,
          total_count: totalCount,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({
      success: false,
      error: 'ユーザー一覧の取得に失敗しました'
    }, 500);
  }
});

// ユーザー詳細取得
usersApi.get('/:id', async (c) => {
  try {
    const userId = c.req.param('id');
    
    const userResult = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.display_name as name,
        u.status,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        r.name as role,
        t.name as tenant_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = ? AND u.tenant_id = ?
    `).bind(userId, 1).first(); // TODO: テナントIDを動的に取得

    if (!userResult) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    // ユーザーのアクティビティログを取得
    const activityResult = await c.env.DB.prepare(`
      SELECT action, ip_address, user_agent, created_at
      FROM audit_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(userId).all();

    return c.json({
      success: true,
      data: {
        user: userResult,
        recent_activities: activityResult.results || []
      }
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    return c.json({
      success: false,
      error: 'ユーザー詳細の取得に失敗しました'
    }, 500);
  }
});

// ユーザー追加
usersApi.post('/', async (c) => {
  try {
    const { name, email, role = 'user', password } = await c.req.json();
    
    // バリデーション
    if (!name || !email || !password) {
      return c.json({
        success: false,
        error: '必須項目が不足しています'
      }, 400);
    }

    // メールアドレス重複チェック
    const existingUser = await c.env.DB.prepare(`
      SELECT id FROM users WHERE email = ? AND tenant_id = ?
    `).bind(email, 1).first(); // TODO: テナントIDを動的に取得

    if (existingUser) {
      return c.json({
        success: false,
        error: 'このメールアドレスは既に使用されています'
      }, 400);
    }

    // パスワードハッシュ化（Web Crypto API使用）
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordData = encoder.encode(password);
    const saltedPassword = new Uint8Array(passwordData.length + salt.length);
    saltedPassword.set(passwordData);
    saltedPassword.set(salt, passwordData.length);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', saltedPassword);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    // トランザクション開始
    const userInsertResult = await c.env.DB.prepare(`
      INSERT INTO users (tenant_id, email, display_name, hashed_password, password_algo, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(1, email, name, hashHex, 'sha256', 'active').run(); // TODO: テナントIDを動的に取得

    if (!userInsertResult.success) {
      return c.json({
        success: false,
        error: 'ユーザーの作成に失敗しました'
      }, 500);
    }

    const userId = userInsertResult.meta.last_row_id;

    // 権限設定
    const roleResult = await c.env.DB.prepare(`
      SELECT id FROM roles WHERE name = ? AND tenant_id = ?
    `).bind(role, 1).first();
    
    if (roleResult) {
      await c.env.DB.prepare(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, ?)
      `).bind(userId, roleResult.id).run();
    }

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (user_id, tenant_id, action, details, ip_address, user_agent)
      VALUES (?, ?, 'user_created', ?, ?, ?)
    `).bind(
      null, // 作成者のユーザーID（TODO: セッションから取得）
      1, // TODO: テナントIDを動的に取得
      `New user created: ${email}`,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown'
    ).run();

    // 作成されたユーザー情報を返す
    const newUser = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.display_name as name,
        u.status,
        u.created_at,
        r.name as role
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ?
    `).bind(userId).first();

    return c.json({
      success: true,
      message: 'ユーザーが正常に作成されました',
      data: newUser
    }, 201);

  } catch (error) {
    console.error('Error creating user:', error);
    return c.json({
      success: false,
      error: 'ユーザーの作成中にエラーが発生しました'
    }, 500);
  }
});

// ユーザー更新
usersApi.put('/:id', async (c) => {
  try {
    const userId = c.req.param('id');
    const { display_name, email, role, status } = await c.req.json();

    // 現在のユーザー情報を取得
    const currentUser = await c.env.DB.prepare(`
      SELECT id, email, display_name, status FROM users 
      WHERE id = ? AND tenant_id = ?
    `).bind(userId, 1).first(); // TODO: テナントIDを動的に取得

    if (!currentUser) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    // メールアドレス重複チェック（自分以外）
    if (email && email !== currentUser.email) {
      const existingUser = await c.env.DB.prepare(`
        SELECT id FROM users 
        WHERE email = ? AND tenant_id = ? AND id != ?
      `).bind(email, 1, userId).first();

      if (existingUser) {
        return c.json({
          success: false,
          error: 'このメールアドレスは既に使用されています'
        }, 400);
      }
    }

    // ユーザー基本情報更新
    await c.env.DB.prepare(`
      UPDATE users 
      SET display_name = COALESCE(?, display_name),
          email = COALESCE(?, email),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(display_name || null, email || null, status || null, userId, 1).run();

    // 権限更新
    if (role) {
      // まず現在のロールを取得
      const currentRoleResult = await c.env.DB.prepare(`
        SELECT r.id FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
      `).bind(userId).first();

      // 新しいロールIDを取得
      const newRoleResult = await c.env.DB.prepare(`
        SELECT id FROM roles WHERE name = ? AND tenant_id = ?
      `).bind(role, 1).first();

      if (newRoleResult) {
        if (currentRoleResult) {
          // 既存のロールを更新
          await c.env.DB.prepare(`
            UPDATE user_roles 
            SET role_id = ?, assigned_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `).bind(newRoleResult.id, userId).run();
        } else {
          // 新しいロールを挿入
          await c.env.DB.prepare(`
            INSERT INTO user_roles (id, user_id, role_id, assigned_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(crypto.randomUUID(), userId, newRoleResult.id).run();
        }
      }
    }

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (id, tenant_id, actor_user_id, action_type, target_type, target_id, ip_address, user_agent, result)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      1, // TODO: テナントIDを動的に取得
      null, // 更新者のユーザーID（TODO: セッションから取得）
      'user_update',
      'user',
      userId,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    // 更新されたユーザー情報を返す
    const updatedUser = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.status,
        u.updated_at,
        r.name as role
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ?
    `).bind(userId).first();

    return c.json({
      success: true,
      message: 'ユーザー情報が正常に更新されました',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return c.json({
      success: false,
      error: 'ユーザー情報の更新中にエラーが発生しました'
    }, 500);
  }
});

// 個別ユーザー取得
usersApi.get('/:id', async (c) => {
  try {
    const userId = c.req.param('id');

    const user = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.status,
        u.created_at,
        u.updated_at,
        r.name as role
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ? AND u.tenant_id = ?
    `).bind(userId, 1).first(); // TODO: テナントIDを動的に取得

    if (!user) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    // 最後のログイン情報を取得
    const lastLoginResult = await c.env.DB.prepare(`
      SELECT created_at as login_at, ip_address 
      FROM audit_logs 
      WHERE actor_user_id = ? AND action_type = 'login' 
      ORDER BY created_at DESC 
      LIMIT 1
    `).bind(user.id).first();

    const userData = {
      ...user,
      last_login: lastLoginResult ? {
        date: lastLoginResult.login_at,
        ip: lastLoginResult.ip_address
      } : null
    };

    return c.json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({
      success: false,
      error: 'ユーザー情報の取得中にエラーが発生しました'
    }, 500);
  }
});

// ユーザー削除（論理削除）
usersApi.delete('/:id', async (c) => {
  try {
    const userId = c.req.param('id');

    // ユーザー存在チェック
    const user = await c.env.DB.prepare(`
      SELECT id, email, status FROM users 
      WHERE id = ? AND tenant_id = ?
    `).bind(userId, 1).first(); // TODO: テナントIDを動的に取得

    if (!user) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    if (user.status === 'deleted') {
      return c.json({
        success: false,
        error: 'このユーザーは既に削除されています'
      }, 400);
    }

    // 論理削除実行
    await c.env.DB.prepare(`
      UPDATE users 
      SET status = 'deleted', 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(userId, 1).run();

    // セッション削除
    await c.env.DB.prepare(`
      DELETE FROM user_sessions WHERE user_id = ?
    `).bind(userId).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (user_id, tenant_id, action, details, ip_address, user_agent)
      VALUES (?, ?, 'user_deleted', ?, ?, ?)
    `).bind(
      null, // 削除者のユーザーID（TODO: セッションから取得）
      1, // TODO: テナントIDを動的に取得
      `User deleted: ${user.email}`,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown'
    ).run();

    return c.json({
      success: true,
      message: 'ユーザーが正常に削除されました'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({
      success: false,
      error: 'ユーザーの削除中にエラーが発生しました'
    }, 500);
  }
});

// パスワードリセット
usersApi.post('/:id/reset-password', async (c) => {
  try {
    const userId = c.req.param('id');
    const { new_password } = await c.req.json();

    if (!new_password || new_password.length < 8) {
      return c.json({
        success: false,
        error: 'パスワードは8文字以上である必要があります'
      }, 400);
    }

    // ユーザー存在チェック
    const user = await c.env.DB.prepare(`
      SELECT id, email FROM users 
      WHERE id = ? AND tenant_id = ? AND status != 'deleted'
    `).bind(userId, 1).first();

    if (!user) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    // 新しいパスワードをハッシュ化
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordData = encoder.encode(new_password);
    const saltedPassword = new Uint8Array(passwordData.length + salt.length);
    saltedPassword.set(passwordData);
    saltedPassword.set(salt, passwordData.length);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', saltedPassword);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    // パスワード更新
    await c.env.DB.prepare(`
      UPDATE users 
      SET password_hash = ?, 
          salt = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(hashHex, saltHex, userId).run();

    // 既存セッションを無効化
    await c.env.DB.prepare(`
      DELETE FROM user_sessions WHERE user_id = ?
    `).bind(userId).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (user_id, tenant_id, action, details, ip_address, user_agent)
      VALUES (?, ?, 'password_reset', ?, ?, ?)
    `).bind(
      null, // 実行者のユーザーID（TODO: セッションから取得）
      1,
      `Password reset for user: ${user.email}`,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown'
    ).run();

    return c.json({
      success: true,
      message: 'パスワードが正常にリセットされました'
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    return c.json({
      success: false,
      error: 'パスワードリセット中にエラーが発生しました'
    }, 500);
  }
});

// ユーザー統計情報取得
usersApi.get('/stats/summary', async (c) => {
  try {
    // 基本統計（テスト用にテナントIDをハードコード）
    const testTenantId = 'tenant_abc_logistics';
    
    const totalUsersResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE tenant_id = ? AND status != 'inactive'
    `).bind(testTenantId).first();

    const activeUsersResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE tenant_id = ? AND status = 'active'
    `).bind(testTenantId).first();

    const recentLoginsResult = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT actor_user_id) as count FROM audit_logs 
      WHERE tenant_id = ? AND action_type = 'login' 
      AND created_at > datetime('now', '-24 hours')
    `).bind(testTenantId).first();

    // 今月の新規登録数
    const newUsersThisMonthResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE tenant_id = ? AND status != 'inactive'
      AND DATE(created_at) >= DATE('now', 'start of month')
    `).bind(testTenantId).first();

    // 役割別統計
    const roleStatsResult = await c.env.DB.prepare(`
      SELECT r.name as role_name, COUNT(*) as count
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.tenant_id = ? AND u.status != 'inactive'
      GROUP BY r.name
    `).bind(testTenantId).all();

    return c.json({
      success: true,
      data: {
        total_users: totalUsersResult?.count || 0,
        active_users: activeUsersResult?.count || 0,
        recent_logins_24h: recentLoginsResult?.count || 0,
        new_users_this_month: newUsersThisMonthResult?.count || 0,
        role_distribution: roleStatsResult.results || []
      }
    });

  } catch (error) {
    console.error('Error fetching user statistics:', error);
    return c.json({
      success: false,
      error: 'ユーザー統計の取得に失敗しました'
    }, 500);
  }
});

export default usersApi;