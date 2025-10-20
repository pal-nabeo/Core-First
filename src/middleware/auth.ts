// PAL物流SaaS 認証ミドルウェア
import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { validateSession } from '../utils/auth';
import type { CloudflareBindings, AuthContext } from '../types/auth';

/**
 * 認証が必要なルート用ミドルウェア
 */
export async function requireAuth(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  const path = c.req.path;
  
  // 認証不要パス
  const publicPaths = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/signup',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/test',
    '/signup',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/static',
    '/favicon.ico'
  ];
  
  // 公開パスの場合はスキップ
  if (publicPaths.some(p => path.startsWith(p))) {
    return next();
  }
  
  const sessionToken = getCookie(c, 'session_token') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!sessionToken) {
    // API以外のパスの場合はログインページにリダイレクト
    if (!path.startsWith('/api/')) {
      return c.redirect('/login');
    }
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const authContext = await validateSession(c.env.DB, sessionToken);
    
    if (!authContext) {
      if (!path.startsWith('/api/')) {
        return c.redirect('/login');
      }
      return c.json({ error: 'Invalid or expired session' }, 401);
    }

    // コンテキストに認証情報を設定
    c.set('auth', authContext);
    c.set('userId', authContext.user.id);
    c.set('tenantId', authContext.user.tenant_id);
    
    await next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (!path.startsWith('/api/')) {
      return c.redirect('/login');
    }
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

/**
 * 管理者権限が必要なルート用ミドルウェア
 */
export async function requireAdmin(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  const auth: AuthContext = c.get('auth');
  
  if (!auth) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // 管理者権限チェック
  const isAdmin = auth.roles.some(role => 
    role.name === 'super_admin' || role.name === 'admin'
  );

  if (!isAdmin) {
    return c.json({ error: 'Administrator privileges required' }, 403);
  }

  await next();
}

/**
 * スーパー管理者権限が必要なルート用ミドルウェア
 */
export async function requireSuperAdmin(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  const auth: AuthContext = c.get('auth');
  
  if (!auth) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // スーパー管理者権限チェック
  const isSuperAdmin = auth.roles.some(role => role.name === 'super_admin');

  if (!isSuperAdmin) {
    return c.json({ error: 'Super administrator privileges required' }, 403);
  }

  await next();
}

/**
 * テナント分離ミドルウェア
 * URLからテナントを抽出し、リクエストコンテキストに設定
 */
export async function tenantMiddleware(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  const url = new URL(c.req.url);
  let tenantSubdomain = 'demo-company'; // デフォルト

  // 本番環境: サブドメインから判定
  if (url.hostname.includes('.pages.dev') || url.hostname.includes('.workers.dev')) {
    const subdomain = url.hostname.split('.')[0];
    tenantSubdomain = subdomain;
  }
  // 開発環境: 複数の方法でテナント判定
  else if (url.hostname === 'localhost' || url.hostname.includes('127.0.0.1') || url.hostname.includes('.e2b.dev')) {
    // 1. URLパスからテナント判定 (/tenant/demo-company/login)
    const pathMatch = url.pathname.match(/^\/tenant\/([^\/]+)/);
    if (pathMatch) {
      tenantSubdomain = pathMatch[1];
    }
    // 2. クエリパラメータから判定 (?tenant=demo-company)
    else if (c.req.query('tenant')) {
      tenantSubdomain = c.req.query('tenant');
    }
    // 3. ヘッダーから判定
    else if (c.req.header('X-Tenant-Subdomain')) {
      tenantSubdomain = c.req.header('X-Tenant-Subdomain');
    }
    // 4. デフォルト値を使用
  }
  // その他の環境: サブドメインから判定
  else {
    const subdomain = url.hostname.split('.')[0];
    if (subdomain && subdomain !== 'www') {
      tenantSubdomain = subdomain;
    }
  }

  c.set('tenantSubdomain', tenantSubdomain);

  // セッション検証とユーザー情報の設定
  const sessionToken = getCookie(c, 'auth_session') || getCookie(c, 'session_token') || c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (sessionToken) {
    try {
      // セッション検証とユーザー情報取得
      const session = await c.env.DB.prepare(`
        SELECT s.*, u.id as user_id, u.tenant_id, u.email, u.status
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.expires_at > datetime('now')
      `).bind(sessionToken).first();

      if (session && session.user_id) {
        // ユーザー情報をコンテキストに設定
        c.set('userId', session.user_id);
        c.set('tenantId', session.tenant_id);
        c.set('userEmail', session.email);
        
        // セッション最終アクセス時刻を更新
        await c.env.DB.prepare(`
          UPDATE sessions 
          SET last_activity_at = CURRENT_TIMESTAMP 
          WHERE session_token = ?
        `).bind(sessionToken).run();
      }
    } catch (error) {
      console.error('Session validation error:', error);
    }
  }

  await next();
}

/**
 * CORS設定ミドルウェア
 */
export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('Origin');
  
  // 開発環境では全てのオリジンを許可
  if (c.env?.NODE_ENV === 'development') {
    c.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    // 本番環境では特定のオリジンのみ許可
    const allowedOrigins = [
      'https://*.pages.dev',
      'https://*.your-domain.com'
    ];
    
    if (origin && allowedOrigins.some(allowed => origin.match(allowed))) {
      c.header('Access-Control-Allow-Origin', origin);
    }
  }

  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-Subdomain');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  await next();
}

/**
 * セキュリティヘッダー設定ミドルウェア
 */
export async function securityHeaders(c: Context, next: Next) {
  await next();

  // セキュリティヘッダーの設定
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), location=()');
  
  // HTTPS環境でのみSecureヘッダーを設定
  if (c.req.url.startsWith('https://')) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

/**
 * レート制限ミドルウェア（簡易版）
 */
export async function rateLimit(options: { requests: number; windowMs: number }) {
  return async (c: Context<{ Bindings: CloudflareBindings }>, next: Next) => {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const key = `rate_limit:${ip}`;
    
    try {
      // KVを使ったレート制限（KV Namespace が利用可能な場合）
      if (c.env.KV) {
        const current = await c.env.KV.get(key);
        const count = current ? parseInt(current) : 0;
        
        if (count >= options.requests) {
          return c.json({ error: 'Rate limit exceeded' }, 429);
        }
        
        await c.env.KV.put(key, (count + 1).toString(), { expirationTtl: Math.floor(options.windowMs / 1000) });
      }
    } catch (error) {
      console.warn('Rate limiting unavailable:', error);
    }
    
    await next();
  };
}

/**
 * IP制限ミドルウェア
 */
export async function ipRestriction(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  const auth: AuthContext | undefined = c.get('auth');
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  
  // 認証済みユーザーのテナントでIP制限が有効かチェック
  if (auth?.tenant) {
    try {
      const allowedIPs = await c.env.DB.prepare(`
        SELECT cidr_range FROM ip_allowlists 
        WHERE tenant_id = ? AND is_active = 1
      `).bind(auth.tenant.id).all();

      if (allowedIPs.results && allowedIPs.results.length > 0) {
        // 簡易的なCIDRチェック（本格的な実装では適切なライブラリを使用）
        const isAllowed = allowedIPs.results.some((row: any) => {
          const cidr = row.cidr_range as string;
          // 簡単な実装：完全一致または前方一致のみ
          return ip === cidr || cidr.includes('/24') && ip.startsWith(cidr.split('/')[0].split('.').slice(0, 3).join('.'));
        });

        if (!isAllowed) {
          return c.json({ error: 'Access denied: IP not allowed' }, 403);
        }
      }
    } catch (error) {
      console.error('IP restriction check failed:', error);
    }
  }

  await next();
}