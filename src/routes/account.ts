// アカウント管理API - プロフィール編集とパスワード変更
import { Hono } from 'hono'
import { authenticateUser } from '../utils/auth'

type Bindings = {
  DB: D1Database;
}

const accountApi = new Hono<{ Bindings: Bindings }>()

// 現在のユーザープロフィール取得
accountApi.get('/profile', async (c) => {
  try {
    const authResult = await authenticateUser(c);
    if (!authResult.success) {
      return c.json({ 
        success: false, 
        error: '認証が必要です' 
      }, 401);
    }

    const { user, tenant } = authResult;

    // ユーザーの詳細情報を取得
    const userProfile = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.phone_number,
        u.locale,
        u.timezone,
        u.two_fa_enabled,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        t.name as tenant_name,
        GROUP_CONCAT(r.display_name) as roles
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ? AND u.tenant_id = ?
      GROUP BY u.id
    `).bind(user.id, tenant.id).first();

    if (!userProfile) {
      return c.json({
        success: false,
        error: 'ユーザー情報が見つかりません'
      }, 404);
    }

    return c.json({
      success: true,
      profile: {
        id: userProfile.id,
        email: userProfile.email,
        displayName: userProfile.display_name,
        phoneNumber: userProfile.phone_number || '',
        locale: userProfile.locale || 'ja-JP',
        timezone: userProfile.timezone || 'Asia/Tokyo',
        twoFaEnabled: Boolean(userProfile.two_fa_enabled),
        roles: userProfile.roles ? userProfile.roles.split(',') : [],
        tenantName: userProfile.tenant_name,
        lastLoginAt: userProfile.last_login_at,
        createdAt: userProfile.created_at,
        updatedAt: userProfile.updated_at
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return c.json({
      success: false,
      error: 'プロフィール取得中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// プロフィール更新
accountApi.put('/profile', async (c) => {
  try {
    const authResult = await authenticateUser(c);
    if (!authResult.success) {
      return c.json({ 
        success: false, 
        error: '認証が必要です' 
      }, 401);
    }

    const { user, tenant } = authResult;
    const body = await c.req.json();
    
    // バリデーション
    const { displayName, phoneNumber, locale, timezone } = body;
    
    if (!displayName || displayName.trim().length === 0) {
      return c.json({
        success: false,
        error: '表示名は必須です'
      }, 400);
    }

    if (displayName.length > 100) {
      return c.json({
        success: false,
        error: '表示名は100文字以内で入力してください'
      }, 400);
    }

    const validLocales = ['ja-JP', 'en-US', 'zh-CN', 'ko-KR'];
    if (locale && !validLocales.includes(locale)) {
      return c.json({
        success: false,
        error: '無効な言語設定です'
      }, 400);
    }

    const validTimezones = ['Asia/Tokyo', 'UTC', 'America/New_York', 'Europe/London'];
    if (timezone && !validTimezones.includes(timezone)) {
      return c.json({
        success: false,
        error: '無効なタイムゾーン設定です'
      }, 400);
    }

    // プロフィール更新
    await c.env.DB.prepare(`
      UPDATE users 
      SET 
        display_name = ?,
        phone_number = ?,
        locale = ?,
        timezone = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(
      displayName.trim(),
      phoneNumber || null,
      locale || 'ja-JP',
      timezone || 'Asia/Tokyo',
      user.id,
      tenant.id
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
      user.id,
      'profile_updated',
      'user',
      user.id,
      JSON.stringify({
        display_name: displayName.trim(),
        phone_number: phoneNumber || null,
        locale: locale || 'ja-JP',
        timezone: timezone || 'Asia/Tokyo'
      }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: 'プロフィールが正常に更新されました'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({
      success: false,
      error: 'プロフィール更新中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// パスワード変更
accountApi.put('/password', async (c) => {
  try {
    const authResult = await authenticateUser(c);
    if (!authResult.success) {
      return c.json({ 
        success: false, 
        error: '認証が必要です' 
      }, 401);
    }

    const { user, tenant } = authResult;
    const body = await c.req.json();
    
    const { currentPassword, newPassword, confirmPassword } = body;

    // バリデーション
    if (!currentPassword || !newPassword || !confirmPassword) {
      return c.json({
        success: false,
        error: '全ての項目を入力してください'
      }, 400);
    }

    if (newPassword !== confirmPassword) {
      return c.json({
        success: false,
        error: '新しいパスワードが一致しません'
      }, 400);
    }

    if (newPassword.length < 8) {
      return c.json({
        success: false,
        error: 'パスワードは8文字以上で入力してください'
      }, 400);
    }

    // パスワード強度チェック
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasSymbols = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    
    const strengthCount = [hasUppercase, hasLowercase, hasNumbers, hasSymbols].filter(Boolean).length;
    
    if (strengthCount < 3) {
      return c.json({
        success: false,
        error: 'パスワードは大文字・小文字・数字・記号のうち3種類以上を含む必要があります'
      }, 400);
    }

    // 現在のパスワードを確認
    const currentUser = await c.env.DB.prepare(`
      SELECT hashed_password FROM users 
      WHERE id = ? AND tenant_id = ?
    `).bind(user.id, tenant.id).first();

    if (!currentUser) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    // 現在のパスワードをハッシュ化して比較
    const encoder = new TextEncoder();
    const currentPasswordData = encoder.encode(currentPassword);
    const currentHashBuffer = await crypto.subtle.digest('SHA-256', currentPasswordData);
    const currentHashArray = Array.from(new Uint8Array(currentHashBuffer));
    const currentHashHex = currentHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (currentHashHex !== currentUser.hashed_password) {
      return c.json({
        success: false,
        error: '現在のパスワードが正しくありません'
      }, 400);
    }

    // 新しいパスワードをハッシュ化
    const newPasswordData = encoder.encode(newPassword);
    const newHashBuffer = await crypto.subtle.digest('SHA-256', newPasswordData);
    const newHashArray = Array.from(new Uint8Array(newHashBuffer));
    const newHashHex = newHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // パスワード更新
    await c.env.DB.prepare(`
      UPDATE users 
      SET 
        hashed_password = ?,
        must_reset_password = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(newHashHex, user.id, tenant.id).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        payload, ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenant.id,
      user.id,
      'password_changed',
      'user',
      user.id,
      JSON.stringify({ timestamp: new Date().toISOString() }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: 'パスワードが正常に変更されました'
    });

  } catch (error) {
    console.error('Password change error:', error);
    return c.json({
      success: false,
      error: 'パスワード変更中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 2要素認証設定
accountApi.post('/2fa/enable', async (c) => {
  try {
    const authResult = await authenticateUser(c);
    if (!authResult.success) {
      return c.json({ 
        success: false, 
        error: '認証が必要です' 
      }, 401);
    }

    const { user, tenant } = authResult;

    // 2要素認証を有効化
    await c.env.DB.prepare(`
      UPDATE users 
      SET 
        two_fa_enabled = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(user.id, tenant.id).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        payload, ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenant.id,
      user.id,
      '2fa_enabled',
      'user',
      user.id,
      JSON.stringify({ timestamp: new Date().toISOString() }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: '2要素認証が有効になりました'
    });

  } catch (error) {
    console.error('2FA enable error:', error);
    return c.json({
      success: false,
      error: '2要素認証設定中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 2要素認証無効化
accountApi.post('/2fa/disable', async (c) => {
  try {
    const authResult = await authenticateUser(c);
    if (!authResult.success) {
      return c.json({ 
        success: false, 
        error: '認証が必要です' 
      }, 401);
    }

    const { user, tenant } = authResult;

    // 2要素認証を無効化
    await c.env.DB.prepare(`
      UPDATE users 
      SET 
        two_fa_enabled = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(user.id, tenant.id).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        payload, ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenant.id,
      user.id,
      '2fa_disabled',
      'user',
      user.id,
      JSON.stringify({ timestamp: new Date().toISOString() }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: '2要素認証が無効になりました'
    });

  } catch (error) {
    console.error('2FA disable error:', error);
    return c.json({
      success: false,
      error: '2要素認証設定中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default accountApi;