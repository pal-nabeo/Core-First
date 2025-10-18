// Core First サービス提供者側認証API
// テナント認証とは分離された独立した認証システム

import { Hono } from 'hono';
import { verify } from 'hono/jwt';

interface ServiceProviderLoginRequest {
  email: string;
  password: string;
}

interface ServiceProviderLoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    displayName: string;
    roles: string[];
    permissions: string[];
  };
  error?: string;
}

const serviceProviderAuth = new Hono();

// サービス提供者専用ログイン（systemテナント）
serviceProviderAuth.post('/login', async (c) => {
  try {
    const { email, password }: ServiceProviderLoginRequest = await c.req.json();
    
    if (!email || !password) {
      return c.json<ServiceProviderLoginResponse>({
        success: false,
        error: 'メールアドレスとパスワードを入力してください。'
      }, 400);
    }

    // systemテナントのユーザーのみ対象
    const user = await c.env.DB.prepare(`
      SELECT u.*, GROUP_CONCAT(r.name, ',') as role_names,
             GROUP_CONCAT(r.display_name, ',') as role_display_names,
             GROUP_CONCAT(r.permissions, '|') as all_permissions
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.email = ? AND u.tenant_id = 'system' AND u.status = 'active'
      GROUP BY u.id
    `).bind(email).first();

    if (!user) {
      // 監査ログ記録
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (id, tenant_id, action_type, target_type, ip_address, user_agent, result, error_message)
        VALUES (?, 'system', 'service_provider_login_failed', 'user', ?, ?, 'failure', 'User not found or inactive')
      `).bind(
        crypto.randomUUID(),
        c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        c.req.header('User-Agent')
      ).run();
      
      return c.json<ServiceProviderLoginResponse>({
        success: false,
        error: 'メールアドレスまたはパスワードが間違っています。'
      }, 401);
    }

    // パスワード検証
    const isValidPassword = await verifyPassword(password, user.hashed_password);
    if (!isValidPassword) {
      // 監査ログ記録
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (id, tenant_id, actor_user_id, action_type, target_type, ip_address, user_agent, result, error_message)
        VALUES (?, 'system', ?, 'service_provider_login_failed', 'user', ?, ?, 'failure', 'Invalid password')
      `).bind(
        crypto.randomUUID(),
        user.id,
        c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        c.req.header('User-Agent')
      ).run();
      
      return c.json<ServiceProviderLoginResponse>({
        success: false,
        error: 'メールアドレスまたはパスワードが間違っています。'
      }, 401);
    }

    // 権限情報解析
    const roles = user.role_names ? user.role_names.split(',') : [];
    const roleDisplayNames = user.role_display_names ? user.role_display_names.split(',') : [];
    const allPermissions = user.all_permissions ? user.all_permissions.split('|') : [];
    
    // 重複排除した権限リスト
    const permissions = Array.from(new Set(
      allPermissions.flatMap(perms => perms ? JSON.parse(perms) : [])
    ));

    // JWTトークン生成（サービス提供者専用）
    const payload = {
      userId: user.id,
      tenantId: 'system',
      email: user.email,
      roles: roles,
      permissions: permissions,
      userType: 'service_provider',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) // 8時間
    };

    const token = await generateJWT(payload, c.env.JWT_SECRET || 'corefirst-service-provider-secret-2024');

    // 最終ログイン時刻更新
    await c.env.DB.prepare(`
      UPDATE users 
      SET last_login_at = datetime('now'), last_login_ip = ?
      WHERE id = ?
    `).bind(
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      user.id
    ).run();

    // 成功ログ記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (id, tenant_id, actor_user_id, action_type, target_type, ip_address, user_agent, result, payload)
      VALUES (?, 'system', ?, 'service_provider_login_success', 'user', ?, ?, 'success', ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      c.req.header('User-Agent'),
      JSON.stringify({ roles: roles, permissions: permissions })
    ).run();

    return c.json<ServiceProviderLoginResponse>({
      success: true,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        roles: roleDisplayNames,
        permissions: permissions
      }
    });

  } catch (error) {
    console.error('Service provider login error:', error);
    return c.json<ServiceProviderLoginResponse>({
      success: false,
      error: 'システムエラーが発生しました。管理者にお問い合わせください。'
    }, 500);
  }
});

// サービス提供者認証確認
serviceProviderAuth.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Not authenticated' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = await verify(token, c.env.JWT_SECRET || 'corefirst-service-provider-secret-2024');

    // サービス提供者トークンチェック
    if (payload.tenantId !== 'system' || payload.userType !== 'service_provider') {
      return c.json({ success: false, error: 'Invalid service provider token' }, 401);
    }

    // ユーザー情報取得
    const user = await c.env.DB.prepare(`
      SELECT u.*, GROUP_CONCAT(r.display_name, ',') as role_display_names
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ? AND u.tenant_id = 'system' AND u.status = 'active'
      GROUP BY u.id
    `).bind(payload.userId).first();

    if (!user) {
      return c.json({ success: false, error: 'User not found or inactive' }, 401);
    }

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        roles: user.role_display_names ? user.role_display_names.split(',') : [],
        permissions: payload.permissions || []
      }
    });

  } catch (error) {
    console.error('Service provider auth check error:', error);
    return c.json({ success: false, error: 'Authentication failed' }, 401);
  }
});

// ログアウト
serviceProviderAuth.post('/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = await verify(token, c.env.JWT_SECRET || 'corefirst-service-provider-secret-2024');
      
      // ログアウトログ記録
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (id, tenant_id, actor_user_id, action_type, target_type, ip_address, user_agent, result)
        VALUES (?, 'system', ?, 'service_provider_logout', 'user', ?, ?, 'success')
      `).bind(
        crypto.randomUUID(),
        payload.userId,
        c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        c.req.header('User-Agent')
      ).run();
    }

    return c.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    // エラーでもログアウトは成功として扱う
    return c.json({ success: true, message: 'Logged out' });
  }
});

// パスワード検証ヘルパー関数
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  // bcryptライブラリが利用できないため、簡易実装
  // 実際の実装では適切なパスワードハッシュ検証を行う
  return hashedPassword === await hashPassword(password);
}

// JWTトークン生成ヘルパー関数
async function generateJWT(payload: any, secret: string): Promise<string> {
  // 実際の実装ではhono/jwtのsign関数を使用
  const encoder = new TextEncoder();
  // JWT秘密鍵のデフォルト値を設定
  const jwtSecret = secret || 'corefirst-service-provider-secret-2024';
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(jwtSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// パスワードハッシュヘルパー関数
async function hashPassword(password: string): Promise<string> {
  // 簡易実装 - 実際にはbcryptを使用
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default serviceProviderAuth;