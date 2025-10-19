// PAL物流SaaS 認証ユーティリティ
import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken';
// import { v4 as uuidv4 } from 'uuid';
import type { User, Tenant, AuthContext, CloudflareBindings } from '../types/auth';

// JWT秘密鍵（本来は環境変数から取得）
const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
const SESSION_EXPIRY_HOURS = 24;
const REMEMBER_ME_EXPIRY_DAYS = 30;

/**
 * パスワードハッシュ化（bcrypt使用）
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * パスワード検証（bcrypt使用）
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * JWTトークン生成（簡易実装）
 */
export function generateToken(payload: any, expiresIn: string = '24h'): string {
  // 簡易実装：本番環境では適切なJWTライブラリを使用する
  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'none' }));
  const payloadWithExp = { ...payload, exp: Date.now() + (24 * 60 * 60 * 1000) };
  const payloadEncoded = btoa(JSON.stringify(payloadWithExp));
  return `${header}.${payloadEncoded}.signature`;
}

/**
 * JWTトークン検証（簡易実装）
 */
export function verifyToken(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Date.now()) {
      throw new Error('Token expired');
    }
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * セッショントークン生成（簡易実装）
 */
export function generateSessionToken(): string {
  return crypto.randomUUID();
}

/**
 * 招待トークン生成
 */
export function generateInvitationToken(): string {
  return crypto.randomUUID() + '-' + Date.now().toString(36);
}

/**
 * パスワードリセットトークン生成
 */
export function generatePasswordResetToken(): string {
  return crypto.randomUUID();
}

/**
 * サブドメインからテナント取得
 */
export async function getTenantBySubdomain(db: D1Database, subdomain: string): Promise<Tenant | null> {
  const result = await db.prepare(`
    SELECT * FROM tenants 
    WHERE subdomain = ? AND status = 'active'
  `).bind(subdomain).first();

  if (!result) return null;

  return {
    ...result,
    domain_allowlist: result.domain_allowlist ? JSON.parse(result.domain_allowlist) : []
  } as Tenant;
}

/**
 * メールアドレスとテナントIDでユーザー取得
 */
export async function getUserByEmail(db: D1Database, email: string, tenantId: string): Promise<User | null> {
  const result = await db.prepare(`
    SELECT * FROM users 
    WHERE email = ? AND tenant_id = ?
  `).bind(email, tenantId).first();

  return result as User | null;
}

/**
 * ユーザーのロール取得
 */
export async function getUserRoles(db: D1Database, userId: string) {
  const result = await db.prepare(`
    SELECT r.* FROM roles r
    INNER JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = ? AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
  `).bind(userId).all();

  return result.results || [];
}

/**
 * セッション作成
 */
export async function createSession(
  db: D1Database,
  userId: string,
  tenantId: string,
  ipAddress?: string,
  userAgent?: string,
  rememberMe: boolean = false
): Promise<string> {
  const sessionToken = generateSessionToken();
  const expiryHours = rememberMe ? (REMEMBER_ME_EXPIRY_DAYS * 24) : SESSION_EXPIRY_HOURS;
  const expiresAt = new Date(Date.now() + (expiryHours * 60 * 60 * 1000)).toISOString();

  await db.prepare(`
    INSERT INTO sessions (id, user_id, tenant_id, session_token, expires_at, ip_address, user_agent, is_remember_me)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    userId,
    tenantId,
    sessionToken,
    expiresAt,
    ipAddress || null,
    userAgent || null,
    rememberMe ? 1 : 0
  ).run();

  return sessionToken;
}

/**
 * セッション検証
 */
export async function validateSession(db: D1Database, sessionToken: string): Promise<AuthContext | null> {
  const sessionResult = await db.prepare(`
    SELECT s.*, u.*, t.* FROM sessions s
    INNER JOIN users u ON s.user_id = u.id
    INNER JOIN tenants t ON s.tenant_id = t.id
    WHERE s.session_token = ? 
    AND s.expires_at > datetime('now')
    AND u.status = 'active'
    AND t.status = 'active'
  `).bind(sessionToken).first();

  if (!sessionResult) return null;

  // ユーザーのロールを取得
  const roles = await getUserRoles(db, sessionResult.user_id);

  // セッションの最終アクティビティを更新
  await db.prepare(`
    UPDATE sessions SET last_activity_at = datetime('now') 
    WHERE session_token = ?
  `).bind(sessionToken).run();

  return {
    user: {
      id: sessionResult.user_id,
      tenant_id: sessionResult.tenant_id,
      email: sessionResult.email,
      display_name: sessionResult.display_name,
      status: sessionResult.status,
      last_login_at: sessionResult.last_login_at,
      last_login_ip: sessionResult.last_login_ip,
      phone_number: sessionResult.phone_number,
      locale: sessionResult.locale || 'ja-JP',
      timezone: sessionResult.timezone || 'Asia/Tokyo',
      failed_login_count: sessionResult.failed_login_count || 0,
      locked_until: sessionResult.locked_until,
      email_verified: Boolean(sessionResult.email_verified),
      two_fa_enabled: Boolean(sessionResult.two_fa_enabled),
      created_at: sessionResult.created_at,
      updated_at: sessionResult.updated_at
    },
    tenant: {
      id: sessionResult.tenant_id,
      name: sessionResult.name,
      subdomain: sessionResult.subdomain,
      domain_allowlist: sessionResult.domain_allowlist ? JSON.parse(sessionResult.domain_allowlist) : [],
      plan_id: sessionResult.plan_id,
      status: sessionResult.status,
      company_type: sessionResult.company_type,
      company_size: sessionResult.company_size,
      trial_expires_at: sessionResult.trial_expires_at,
      created_at: sessionResult.created_at,
      updated_at: sessionResult.updated_at
    },
    roles: roles as any[],
    session: {
      id: sessionResult.id,
      user_id: sessionResult.user_id,
      tenant_id: sessionResult.tenant_id,
      session_token: sessionResult.session_token,
      expires_at: sessionResult.expires_at,
      ip_address: sessionResult.ip_address,
      user_agent: sessionResult.user_agent,
      is_remember_me: Boolean(sessionResult.is_remember_me),
      last_activity_at: sessionResult.last_activity_at,
      created_at: sessionResult.created_at
    }
  };
}

/**
 * セッション削除（ログアウト）
 */
export async function destroySession(db: D1Database, sessionToken: string): Promise<void> {
  await db.prepare(`
    DELETE FROM sessions WHERE session_token = ?
  `).bind(sessionToken).run();
}

/**
 * ログイン失敗ログ記録
 */
export async function logFailedLogin(
  db: D1Database,
  email: string,
  tenantId: string | null,
  userId: string | null,
  ipAddress: string,
  userAgent: string | null,
  reason: string
): Promise<void> {
  await db.prepare(`
    INSERT INTO failed_logins (id, tenant_id, user_id, email, ip_address, user_agent, failure_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    tenantId,
    userId,
    email,
    ipAddress,
    userAgent,
    reason
  ).run();
}

/**
 * アカウントロックチェック・実行
 */
export async function checkAndLockAccount(db: D1Database, userId: string): Promise<boolean> {
  const user = await db.prepare(`
    SELECT failed_login_count, locked_until FROM users WHERE id = ?
  `).bind(userId).first();

  if (!user) return false;

  const failedCount = user.failed_login_count || 0;
  let lockDuration = 0;

  // ロック期間の判定
  if (failedCount >= 15) {
    // 15回以上：無期限ロック
    lockDuration = 0;
  } else if (failedCount >= 10) {
    // 10回以上：24時間ロック
    lockDuration = 24 * 60 * 60 * 1000;
  } else if (failedCount >= 5) {
    // 5回以上：15分ロック
    lockDuration = 15 * 60 * 1000;
  } else if (failedCount >= 3) {
    // 3回以上：5分ロック
    lockDuration = 5 * 60 * 1000;
  }

  if (lockDuration > 0) {
    const lockedUntil = new Date(Date.now() + lockDuration).toISOString();
    await db.prepare(`
      UPDATE users SET locked_until = ? WHERE id = ?
    `).bind(lockedUntil, userId).run();
    return true;
  } else if (failedCount >= 15) {
    // 無期限ロック
    await db.prepare(`
      UPDATE users SET locked_until = '9999-12-31 23:59:59' WHERE id = ?
    `).bind(userId).run();
    return true;
  }

  return false;
}

/**
 * 失敗回数増加
 */
export async function incrementFailedLoginCount(db: D1Database, userId: string): Promise<void> {
  await db.prepare(`
    UPDATE users SET 
      failed_login_count = failed_login_count + 1,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(userId).run();
}

/**
 * ログイン成功時のユーザー情報更新
 */
export async function updateLoginSuccess(
  db: D1Database,
  userId: string,
  ipAddress?: string
): Promise<void> {
  await db.prepare(`
    UPDATE users SET 
      failed_login_count = 0,
      locked_until = NULL,
      last_login_at = datetime('now'),
      last_login_ip = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(ipAddress || null, userId).run();
}

/**
 * リクエストからユーザー認証情報を取得
 */
export async function authenticateUser(c: any): Promise<{ success: true; user: any; tenant: any } | { success: false; error: string }> {
  try {
    // セッションCookieから認証情報を取得
    const sessionToken = c.req.header('Cookie')?.match(/session_token=([^;]+)/)?.[1];
    
    if (!sessionToken) {
      return { success: false, error: '認証が必要です' };
    }

    // セッション検証
    const authContext = await validateSession(c.env.DB, sessionToken);
    
    if (!authContext) {
      return { success: false, error: '無効なセッションです' };
    }

    return { 
      success: true, 
      user: authContext.user, 
      tenant: authContext.tenant 
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: '認証エラーが発生しました' };
  }
}

/**
 * 監査ログ記録
 */
export async function logAuditEvent(
  db: D1Database,
  tenantId: string,
  actorUserId: string | null,
  actionType: string,
  targetType: string,
  targetId: string,
  ipAddress?: string,
  userAgent?: string,
  result: 'success' | 'failure' | 'error' = 'success',
  errorMessage?: string
): Promise<void> {
  await db.prepare(`
    INSERT INTO audit_logs (
      id, tenant_id, actor_user_id, action_type, target_type, target_id,
      ip_address, user_agent, result, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    tenantId,
    actorUserId,
    actionType,
    targetType,
    targetId,
    ipAddress || null,
    userAgent || null,
    result,
    errorMessage || null
  ).run();
}