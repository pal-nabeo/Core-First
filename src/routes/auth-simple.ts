// PAL物流SaaS シンプル認証API ルート
import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import type { CloudflareBindings } from '../types/auth';

const auth = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * シンプルなパスワードハッシュ化（Web Crypto API使用）
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'pal_logistics_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * パスワード検証
 */
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hashedPassword;
}

/**
 * セッショントークン生成
 */
function generateSessionToken(): string {
  return crypto.randomUUID();
}

/**
 * ログイン処理
 * POST /api/auth/login
 */
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, remember_me, tenant_subdomain } = body;
    
    // 基本バリデーション
    if (!email || !password) {
      return c.json({ 
        success: false, 
        error: 'メールアドレスとパスワードを入力してください。' 
      }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ 
        success: false, 
        error: '有効なメールアドレスを入力してください。' 
      }, 400);
    }

    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const userAgent = c.req.header('User-Agent') || 'unknown';

    // テナント取得
    let subdomain = tenant_subdomain || c.get('tenantSubdomain') || 'demo-company';
    
    const tenant = await c.env.DB.prepare(`
      SELECT * FROM tenants WHERE subdomain = ? AND status = 'active'
    `).bind(subdomain).first();
    
    if (!tenant) {
      return c.json({ 
        success: false, 
        error: `ログインに失敗しました。企業情報が見つかりません。(サブドメイン: ${subdomain})` 
      }, 400);
    }

    // ユーザー取得
    const user = await c.env.DB.prepare(`
      SELECT * FROM users WHERE email = ? AND tenant_id = ?
    `).bind(email, tenant.id).first();
    
    if (!user) {
      return c.json({ 
        success: false, 
        error: 'メールアドレスまたはパスワードが間違っています。' 
      }, 401);
    }

    // アカウント状態確認
    if (user.status !== 'active') {
      return c.json({ 
        success: false, 
        error: 'アカウントが無効になっています。管理者にお問い合わせください。' 
      }, 401);
    }

    // アカウントロック確認
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      if (lockedUntil > new Date()) {
        const unlockTime = lockedUntil.getTime() === new Date('9999-12-31').getTime() 
          ? '管理者による解除が必要です' 
          : lockedUntil.toLocaleString('ja-JP');
        
        return c.json({ 
          success: false, 
          error: `アカウントがロックされています。解除時刻: ${unlockTime}` 
        }, 423);
      }
    }

    // パスワード検証
    const passwordValid = await verifyPassword(password, user.hashed_password);
    if (!passwordValid) {
      // 失敗回数増加
      await c.env.DB.prepare(`
        UPDATE users SET 
          failed_login_count = failed_login_count + 1,
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(user.id).run();
      
      return c.json({ 
        success: false, 
        error: 'メールアドレスまたはパスワードが間違っています。' 
      }, 401);
    }

    // セッション作成
    const sessionToken = generateSessionToken();
    const expiryHours = remember_me ? (30 * 24) : 24; // 30日 or 1日
    const expiresAt = new Date(Date.now() + (expiryHours * 60 * 60 * 1000)).toISOString();

    await c.env.DB.prepare(`
      INSERT INTO sessions (id, user_id, tenant_id, session_token, expires_at, ip_address, user_agent, is_remember_me)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      tenant.id,
      sessionToken,
      expiresAt,
      ip,
      userAgent,
      remember_me ? 1 : 0
    ).run();

    // ログイン成功時の更新
    await c.env.DB.prepare(`
      UPDATE users SET 
        failed_login_count = 0,
        locked_until = NULL,
        last_login_at = datetime('now'),
        last_login_ip = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(ip, user.id).run();

    // セッションクッキー設定
    const cookieOptions = {
      httpOnly: true,
      secure: c.req.url.startsWith('https://'),
      sameSite: 'Lax' as const,
      maxAge: remember_me ? (30 * 24 * 60 * 60) : (24 * 60 * 60),
      path: '/'
    };
    
    setCookie(c, 'session_token', sessionToken, cookieOptions);

    // レスポンス用にパスワードを除外
    const { hashed_password, ...userInfo } = user;

    return c.json({
      success: true,
      session_token: sessionToken,
      user: userInfo,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain
      },
      redirect_url: '/dashboard'
    });

  } catch (error) {
    console.error('Login error:', error);
    return c.json({ 
      success: false, 
      error: 'ログイン処理中にエラーが発生しました。しばらくしてから再度お試しください。' 
    }, 500);
  }
});

/**
 * ログアウト処理
 * POST /api/auth/logout
 */
auth.post('/logout', async (c) => {
  try {
    const sessionToken = getCookie(c, 'session_token');
    
    if (sessionToken) {
      // セッション削除
      await c.env.DB.prepare(`
        DELETE FROM sessions WHERE session_token = ?
      `).bind(sessionToken).run();
    }

    // クッキー削除
    deleteCookie(c, 'session_token', { path: '/' });

    return c.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ 
      success: false, 
      error: 'ログアウト処理中にエラーが発生しました。' 
    }, 500);
  }
});

/**
 * セッション確認
 * GET /api/auth/me
 */
auth.get('/me', async (c) => {
  try {
    const sessionToken = getCookie(c, 'session_token') || c.req.header('Authorization')?.replace('Bearer ', '');

    if (!sessionToken) {
      return c.json({ success: false, error: 'Not authenticated' }, 401);
    }

    const sessionResult = await c.env.DB.prepare(`
      SELECT s.*, u.*, t.name as tenant_name, t.subdomain as tenant_subdomain
      FROM sessions s
      INNER JOIN users u ON s.user_id = u.id
      INNER JOIN tenants t ON s.tenant_id = t.id
      WHERE s.session_token = ? 
      AND s.expires_at > datetime('now')
      AND u.status = 'active'
      AND t.status = 'active'
    `).bind(sessionToken).first();

    if (!sessionResult) {
      return c.json({ success: false, error: 'Invalid or expired session' }, 401);
    }

    // セッションの最終アクティビティを更新
    await c.env.DB.prepare(`
      UPDATE sessions SET last_activity_at = datetime('now') 
      WHERE session_token = ?
    `).bind(sessionToken).run();

    // パスワードを除外してレスポンス
    const { hashed_password, ...userInfo } = sessionResult;

    return c.json({
      success: true,
      user: {
        id: userInfo.user_id,
        tenant_id: userInfo.tenant_id,
        email: userInfo.email,
        display_name: userInfo.display_name,
        status: userInfo.status,
        last_login_at: userInfo.last_login_at
      },
      tenant: {
        id: userInfo.tenant_id,
        name: userInfo.tenant_name,
        subdomain: userInfo.tenant_subdomain
      }
    });

  } catch (error) {
    console.error('Session validation error:', error);
    return c.json({ 
      success: false, 
      error: 'セッション確認中にエラーが発生しました。' 
    }, 500);
  }
});

export { auth };