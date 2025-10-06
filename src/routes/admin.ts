// 管理者向けユーザー管理・権限編集API
import { Hono } from 'hono'
import { authenticateUser } from '../utils/auth'

type Bindings = {
  DB: D1Database;
}

const adminApi = new Hono<{ Bindings: Bindings }>()

// 管理者権限チェック
async function checkAdminPermission(c: any) {
  const authResult = await authenticateUser(c);
  if (!authResult.success) {
    return { success: false, error: '認証が必要です' };
  }

  const { user, tenant } = authResult;

  // ユーザーの権限を確認
  const userRoles = await c.env.DB.prepare(`
    SELECT r.name, r.permissions
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = ? AND ur.expires_at IS NULL OR ur.expires_at > datetime('now')
  `).bind(user.id).all();

  const hasAdminRole = userRoles.results.some((role: any) => 
    role.name === 'admin' || role.name === 'super_admin'
  );

  if (!hasAdminRole) {
    return { success: false, error: '管理者権限が必要です' };
  }

  return { success: true, user, tenant };
}

// テナント内ユーザー一覧取得（管理者用）
adminApi.get('/users', async (c) => {
  try {
    const adminCheck = await checkAdminPermission(c);
    if (!adminCheck.success) {
      return c.json({ 
        success: false, 
        error: adminCheck.error 
      }, 403);
    }

    const { tenant } = adminCheck;
    const { page = '1', limit = '20', search = '', role = '', status = '' } = c.req.query();
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE u.tenant_id = ?';
    let params: any[] = [tenant.id];
    
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

    // ユーザー一覧取得
    const usersQuery = `
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.status,
        u.last_login_at,
        u.created_at,
        u.phone_number,
        u.two_fa_enabled,
        u.locale,
        u.timezone,
        GROUP_CONCAT(r.display_name) as roles,
        GROUP_CONCAT(r.name) as role_names,
        COUNT(*) OVER() as total_count
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limitNum, offset);
    const users = await c.env.DB.prepare(usersQuery).bind(...params).all();

    // 利用可能ロール一覧も取得
    const roles = await c.env.DB.prepare(`
      SELECT id, name, display_name, description
      FROM roles
      WHERE tenant_id = ? AND is_system_role = 1
      ORDER BY name
    `).bind(tenant.id).all();

    return c.json({
      success: true,
      users: users.results.map((user: any) => ({
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        status: user.status,
        roles: user.roles ? user.roles.split(',') : [],
        roleNames: user.role_names ? user.role_names.split(',') : [],
        phoneNumber: user.phone_number,
        twoFaEnabled: Boolean(user.two_fa_enabled),
        locale: user.locale,
        timezone: user.timezone,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at
      })),
      pagination: {
        currentPage: pageNum,
        totalCount: users.results.length > 0 ? users.results[0].total_count : 0,
        totalPages: Math.ceil((users.results.length > 0 ? users.results[0].total_count : 0) / limitNum),
        limit: limitNum
      },
      availableRoles: roles.results
    });

  } catch (error) {
    console.error('Admin users list error:', error);
    return c.json({
      success: false,
      error: 'ユーザー一覧取得中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 特定ユーザーの詳細情報取得
adminApi.get('/users/:userId', async (c) => {
  try {
    const adminCheck = await checkAdminPermission(c);
    if (!adminCheck.success) {
      return c.json({ 
        success: false, 
        error: adminCheck.error 
      }, 403);
    }

    const { tenant } = adminCheck;
    const userId = c.req.param('userId');

    // ユーザー詳細情報取得
    const userDetail = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.status,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        u.phone_number,
        u.two_fa_enabled,
        u.locale,
        u.timezone,
        u.failed_login_count,
        u.locked_until,
        u.email_verified,
        u.must_reset_password
      FROM users u
      WHERE u.id = ? AND u.tenant_id = ?
    `).bind(userId, tenant.id).first();

    if (!userDetail) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    // ユーザーのロール情報取得
    const userRoles = await c.env.DB.prepare(`
      SELECT 
        ur.id as assignment_id,
        r.id as role_id,
        r.name as role_name,
        r.display_name as role_display_name,
        ur.scope,
        ur.organization_unit_id,
        ur.assigned_at,
        ur.expires_at,
        ou.name as organization_unit_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      LEFT JOIN organization_units ou ON ur.organization_unit_id = ou.id
      WHERE ur.user_id = ?
      ORDER BY ur.assigned_at DESC
    `).bind(userId).all();

    return c.json({
      success: true,
      user: {
        id: userDetail.id,
        email: userDetail.email,
        displayName: userDetail.display_name,
        status: userDetail.status,
        phoneNumber: userDetail.phone_number,
        twoFaEnabled: Boolean(userDetail.two_fa_enabled),
        locale: userDetail.locale,
        timezone: userDetail.timezone,
        failedLoginCount: userDetail.failed_login_count,
        lockedUntil: userDetail.locked_until,
        emailVerified: Boolean(userDetail.email_verified),
        mustResetPassword: Boolean(userDetail.must_reset_password),
        lastLoginAt: userDetail.last_login_at,
        createdAt: userDetail.created_at,
        updatedAt: userDetail.updated_at
      },
      roles: userRoles.results.map((role: any) => ({
        assignmentId: role.assignment_id,
        roleId: role.role_id,
        roleName: role.role_name,
        roleDisplayName: role.role_display_name,
        scope: role.scope,
        organizationUnitId: role.organization_unit_id,
        organizationUnitName: role.organization_unit_name,
        assignedAt: role.assigned_at,
        expiresAt: role.expires_at
      }))
    });

  } catch (error) {
    console.error('User detail error:', error);
    return c.json({
      success: false,
      error: 'ユーザー詳細取得中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ユーザー権限の追加・変更
adminApi.post('/users/:userId/roles', async (c) => {
  try {
    const adminCheck = await checkAdminPermission(c);
    if (!adminCheck.success) {
      return c.json({ 
        success: false, 
        error: adminCheck.error 
      }, 403);
    }

    const { user: adminUser, tenant } = adminCheck;
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    const { roleId, scope = 'tenant', organizationUnitId = null, expiresAt = null } = body;

    // バリデーション
    if (!roleId) {
      return c.json({
        success: false,
        error: 'ロールIDが必要です'
      }, 400);
    }

    // ユーザーの存在確認
    const targetUser = await c.env.DB.prepare(`
      SELECT id FROM users WHERE id = ? AND tenant_id = ?
    `).bind(userId, tenant.id).first();

    if (!targetUser) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    // ロールの存在確認
    const role = await c.env.DB.prepare(`
      SELECT id, name, display_name FROM roles 
      WHERE id = ? AND tenant_id = ?
    `).bind(roleId, tenant.id).first();

    if (!role) {
      return c.json({
        success: false,
        error: 'ロールが見つかりません'
      }, 404);
    }

    // 既存の同じロール割り当てをチェック
    const existingAssignment = await c.env.DB.prepare(`
      SELECT id FROM user_roles 
      WHERE user_id = ? AND role_id = ? AND organization_unit_id IS ?
    `).bind(userId, roleId, organizationUnitId).first();

    if (existingAssignment) {
      return c.json({
        success: false,
        error: 'このロールは既に割り当てられています'
      }, 400);
    }

    // ロール割り当て追加
    const assignmentId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO user_roles (
        id, user_id, role_id, organization_unit_id, scope, 
        assigned_by, assigned_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).bind(
      assignmentId,
      userId,
      roleId,
      organizationUnitId,
      scope,
      adminUser.id,
      expiresAt
    ).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        payload, ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenant.id,
      adminUser.id,
      'role_assigned',
      'user',
      userId,
      JSON.stringify({
        role_id: roleId,
        role_name: role.name,
        role_display_name: role.display_name,
        scope: scope,
        organization_unit_id: organizationUnitId,
        expires_at: expiresAt
      }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: `ロール「${role.display_name}」が正常に割り当てられました`,
      assignmentId: assignmentId
    });

  } catch (error) {
    console.error('Role assignment error:', error);
    return c.json({
      success: false,
      error: 'ロール割り当て中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ユーザー権限の削除
adminApi.delete('/users/:userId/roles/:assignmentId', async (c) => {
  try {
    const adminCheck = await checkAdminPermission(c);
    if (!adminCheck.success) {
      return c.json({ 
        success: false, 
        error: adminCheck.error 
      }, 403);
    }

    const { user: adminUser, tenant } = adminCheck;
    const userId = c.req.param('userId');
    const assignmentId = c.req.param('assignmentId');

    // 割り当て情報取得
    const assignment = await c.env.DB.prepare(`
      SELECT 
        ur.id,
        ur.user_id,
        ur.role_id,
        r.name as role_name,
        r.display_name as role_display_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.id = ? AND ur.user_id = ?
    `).bind(assignmentId, userId).first();

    if (!assignment) {
      return c.json({
        success: false,
        error: 'ロール割り当てが見つかりません'
      }, 404);
    }

    // ロール割り当て削除
    await c.env.DB.prepare(`
      DELETE FROM user_roles WHERE id = ? AND user_id = ?
    `).bind(assignmentId, userId).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        payload, ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenant.id,
      adminUser.id,
      'role_removed',
      'user',
      userId,
      JSON.stringify({
        role_id: assignment.role_id,
        role_name: assignment.role_name,
        role_display_name: assignment.role_display_name,
        assignment_id: assignmentId
      }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: `ロール「${assignment.role_display_name}」が正常に削除されました`
    });

  } catch (error) {
    console.error('Role removal error:', error);
    return c.json({
      success: false,
      error: 'ロール削除中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ユーザーステータス変更
adminApi.put('/users/:userId/status', async (c) => {
  try {
    const adminCheck = await checkAdminPermission(c);
    if (!adminCheck.success) {
      return c.json({ 
        success: false, 
        error: adminCheck.error 
      }, 403);
    }

    const { user: adminUser, tenant } = adminCheck;
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    const { status, reason } = body;

    // バリデーション
    const validStatuses = ['active', 'disabled', 'frozen', 'trial_expired'];
    if (!status || !validStatuses.includes(status)) {
      return c.json({
        success: false,
        error: '無効なステータスです'
      }, 400);
    }

    // ユーザーの存在確認
    const targetUser = await c.env.DB.prepare(`
      SELECT id, display_name, status as current_status FROM users 
      WHERE id = ? AND tenant_id = ?
    `).bind(userId, tenant.id).first();

    if (!targetUser) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    // ステータス更新
    await c.env.DB.prepare(`
      UPDATE users 
      SET 
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(status, userId, tenant.id).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        payload, ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenant.id,
      adminUser.id,
      'user_status_changed',
      'user',
      userId,
      JSON.stringify({
        from_status: targetUser.current_status,
        to_status: status,
        reason: reason || null,
        user_name: targetUser.display_name
      }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: `ユーザーステータスが${status}に変更されました`
    });

  } catch (error) {
    console.error('Status change error:', error);
    return c.json({
      success: false,
      error: 'ステータス変更中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ユーザー情報更新（スーパー管理者専用）
adminApi.put('/users/:userId', async (c) => {
  try {
    const adminCheck = await checkAdminPermission(c);
    if (!adminCheck.success) {
      return c.json({ 
        success: false, 
        error: adminCheck.error 
      }, 403);
    }

    const { user: adminUser, tenant } = adminCheck;
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    const { 
      displayName, 
      email, 
      phoneNumber, 
      locale, 
      timezone, 
      status,
      emailVerified,
      mustResetPassword,
      twoFaEnabled,
      resetFailedLogins
    } = body;

    // スーパー管理者権限チェック
    const isSuperAdmin = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ? AND r.name = 'super_admin'
      AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
    `).bind(adminUser.id).first();

    if (!isSuperAdmin || isSuperAdmin.count === 0) {
      return c.json({
        success: false,
        error: 'この操作にはスーパー管理者権限が必要です'
      }, 403);
    }

    // ユーザーの存在確認
    const targetUser = await c.env.DB.prepare(`
      SELECT id, display_name, email FROM users 
      WHERE id = ? AND tenant_id = ?
    `).bind(userId, tenant.id).first();

    if (!targetUser) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    // メールアドレス重複チェック（変更時のみ）
    if (email && email !== targetUser.email) {
      const existingUser = await c.env.DB.prepare(`
        SELECT id FROM users 
        WHERE email = ? AND tenant_id = ? AND id != ?
      `).bind(email, tenant.id, userId).first();

      if (existingUser) {
        return c.json({
          success: false,
          error: 'このメールアドレスは既に使用されています'
        }, 400);
      }
    }

    // 更新するフィールドを動的に構築
    const updateFields = [];
    const updateParams = [];

    if (displayName !== undefined) {
      updateFields.push('display_name = ?');
      updateParams.push(displayName);
    }

    if (email !== undefined) {
      updateFields.push('email = ?');
      updateParams.push(email);
    }

    if (phoneNumber !== undefined) {
      updateFields.push('phone_number = ?');
      updateParams.push(phoneNumber || null);
    }

    if (locale !== undefined) {
      updateFields.push('locale = ?');
      updateParams.push(locale);
    }

    if (timezone !== undefined) {
      updateFields.push('timezone = ?');
      updateParams.push(timezone);
    }

    if (status !== undefined) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }

    if (emailVerified !== undefined) {
      updateFields.push('email_verified = ?');
      updateParams.push(emailVerified ? 1 : 0);
    }

    if (mustResetPassword !== undefined) {
      updateFields.push('must_reset_password = ?');
      updateParams.push(mustResetPassword ? 1 : 0);
    }

    if (twoFaEnabled !== undefined) {
      updateFields.push('two_fa_enabled = ?');
      updateParams.push(twoFaEnabled ? 1 : 0);
    }

    if (resetFailedLogins) {
      updateFields.push('failed_login_count = 0');
      updateFields.push('locked_until = NULL');
    }

    // 更新するフィールドがない場合
    if (updateFields.length === 0) {
      return c.json({
        success: false,
        error: '更新する項目が指定されていません'
      }, 400);
    }

    // 更新日時を追加
    updateFields.push('updated_at = datetime(\'now\')');
    updateParams.push(userId, tenant.id);

    // ユーザー情報更新
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `;

    await c.env.DB.prepare(updateQuery).bind(...updateParams).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        payload, ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenant.id,
      adminUser.id,
      'user_updated',
      'user',
      userId,
      JSON.stringify({
        updated_fields: Object.keys(body),
        target_user_name: targetUser.display_name,
        target_user_email: targetUser.email
      }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: 'ユーザー情報が正常に更新されました'
    });

  } catch (error) {
    console.error('User update error:', error);
    return c.json({
      success: false,
      error: 'ユーザー情報更新中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// パスワードリセット（スーパー管理者専用）
adminApi.post('/users/:userId/reset-password', async (c) => {
  try {
    const adminCheck = await checkAdminPermission(c);
    if (!adminCheck.success) {
      return c.json({ 
        success: false, 
        error: adminCheck.error 
      }, 403);
    }

    const { user: adminUser, tenant } = adminCheck;
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    const { temporaryPassword, requireReset = true } = body;

    // スーパー管理者権限チェック
    const isSuperAdmin = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ? AND r.name = 'super_admin'
      AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
    `).bind(adminUser.id).first();

    if (!isSuperAdmin || isSuperAdmin.count === 0) {
      return c.json({
        success: false,
        error: 'この操作にはスーパー管理者権限が必要です'
      }, 403);
    }

    // ユーザーの存在確認
    const targetUser = await c.env.DB.prepare(`
      SELECT id, display_name, email FROM users 
      WHERE id = ? AND tenant_id = ?
    `).bind(userId, tenant.id).first();

    if (!targetUser) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    // 一時パスワードの生成（指定されていない場合）
    const newPassword = temporaryPassword || `Temp${Math.floor(Math.random() * 10000)}!`;
    
    // パスワードハッシュ化（auth.tsと同じロジック）
    const encoder = new TextEncoder();
    const data = encoder.encode(newPassword + 'salt_string');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // パスワード更新
    await c.env.DB.prepare(`
      UPDATE users 
      SET 
        hashed_password = ?,
        must_reset_password = ?,
        failed_login_count = 0,
        locked_until = NULL,
        updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `).bind(hashedPassword, requireReset ? 1 : 0, userId, tenant.id).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        payload, ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenant.id,
      adminUser.id,
      'password_reset_by_admin',
      'user',
      userId,
      JSON.stringify({
        target_user_name: targetUser.display_name,
        target_user_email: targetUser.email,
        require_reset: requireReset
      }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: 'パスワードがリセットされました',
      temporaryPassword: newPassword
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return c.json({
      success: false,
      error: 'パスワードリセット中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 利用可能ロール一覧取得
adminApi.get('/roles', async (c) => {
  try {
    const adminCheck = await checkAdminPermission(c);
    if (!adminCheck.success) {
      return c.json({ 
        success: false, 
        error: adminCheck.error 
      }, 403);
    }

    const { tenant } = adminCheck;

    const roles = await c.env.DB.prepare(`
      SELECT 
        id,
        name,
        display_name,
        description,
        is_system_role,
        permissions,
        created_at
      FROM roles
      WHERE tenant_id = ?
      ORDER BY is_system_role DESC, name ASC
    `).bind(tenant.id).all();

    return c.json({
      success: true,
      roles: roles.results.map((role: any) => ({
        id: role.id,
        name: role.name,
        displayName: role.display_name,
        description: role.description,
        isSystemRole: Boolean(role.is_system_role),
        permissions: role.permissions ? JSON.parse(role.permissions) : [],
        createdAt: role.created_at
      }))
    });

  } catch (error) {
    console.error('Roles list error:', error);
    return c.json({
      success: false,
      error: 'ロール一覧取得中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default adminApi;