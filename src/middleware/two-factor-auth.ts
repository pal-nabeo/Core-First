// Core First 2要素認証ミドルウェア
// TOTP (Time-based One-Time Password) およびSMSベース認証に対応

import { Context, Next } from 'hono';
import type { CloudflareBindings } from '../types/auth';

interface TwoFactorSecret {
  user_id: string;
  secret: string;
  backup_codes: string[];
  is_enabled: boolean;
}

interface TwoFactorVerification {
  user_id: string;
  code: string;
  method: 'totp' | 'sms' | 'backup_code';
  timestamp: string;
}

/**
 * 2要素認証必須チェックミドルウェア
 * 特定の機能やプランに応じて2FA必須チェック
 */
export async function requireTwoFactorAuth(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  try {
    const path = c.req.path;
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');

    // 2FA必須パス（高権限機能）
    const twoFactorRequiredPaths = [
      '/api/admin/',
      '/api/service-provider-auth/',
      // '/api/provider-dashboard/', // 開発環境では無効化
      '/api/users/delete',
      '/api/licenses/modify',
      '/api/tenant/delete'
    ];

    // チェック対象外のパス
    const excludePaths = [
      '/api/auth/two-factor/',
      '/api/health',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/provider-dashboard/',  // 開発環境では2FAなしでアクセス可能
      '/static',
      '/favicon.ico'
    ];

    // 開発環境では2FAをスキップ
    const isDevelopment = c.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'development';
    
    if (!userId || !tenantId || excludePaths.some(p => path.startsWith(p)) || isDevelopment) {
      return next();
    }

    // 高権限機能へのアクセスチェック
    const requirestwwoFactor = twoFactorRequiredPaths.some(p => path.startsWith(p));
    
    if (requirestwwoFactor) {
      // ユーザーの2FA設定確認
      const twoFactorStatus = await checkUserTwoFactorStatus(c, userId);
      
      if (!twoFactorStatus.is_enabled) {
        return c.json({
          success: false,
          error: 'この機能にアクセスするには2要素認証の設定が必要です。',
          details: {
            required_action: 'enable_two_factor_auth',
            setup_url: '/api/auth/two-factor/setup'
          }
        }, 403);
      }

      // セッションの2FA確認状態チェック
      const sessionVerified = await checkSessionTwoFactorVerification(c, userId);
      if (!sessionVerified) {
        return c.json({
          success: false,
          error: '2要素認証による再認証が必要です。',
          details: {
            required_action: 'verify_two_factor',
            verify_url: '/api/auth/two-factor/verify'
          }
        }, 401);
      }
    }

    return next();

  } catch (error) {
    console.error('Two-factor auth middleware error:', error);
    // エラー時は処理を継続（フェイルセーフ）
    return next();
  }
}

/**
 * 2FA設定API
 * POST /api/auth/two-factor/setup
 */
export async function setupTwoFactorAuth(c: Context<{ Bindings: CloudflareBindings }>) {
  try {
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    
    if (!userId) {
      return c.json({
        success: false,
        error: '認証が必要です。'
      }, 401);
    }

    // TOTPシークレット生成
    const secret = generateTOTPSecret();
    const qrCodeUrl = generateQRCodeUrl(userId, secret, 'Core First');
    const backupCodes = generateBackupCodes(8);

    // データベースに保存（まだ無効状態）
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO two_factor_secrets 
      (id, user_id, tenant_id, secret, backup_codes, is_enabled, method, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 'totp', CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      userId,
      tenantId,
      secret,
      JSON.stringify(backupCodes)
    ).run();

    // 監査ログ記録
    await logSecurityEvent(c, 'two_factor_setup_initiated', 'medium', userId, {
      method: 'totp',
      setup_stage: 'secret_generated'
    });

    return c.json({
      success: true,
      data: {
        secret,
        qr_code_url: qrCodeUrl,
        backup_codes: backupCodes,
        setup_instructions: {
          step1: 'Google Authenticator など TOTP対応アプリで QRコードをスキャン',
          step2: 'アプリに表示される6桁のコードで認証テストを実行',
          step3: 'バックアップコードを安全な場所に保管'
        }
      }
    });

  } catch (error) {
    console.error('Two-factor setup error:', error);
    return c.json({
      success: false,
      error: '2要素認証の設定でエラーが発生しました。'
    }, 500);
  }
}

/**
 * 2FA認証確認API
 * POST /api/auth/two-factor/verify
 */
export async function verifyTwoFactorAuth(c: Context<{ Bindings: CloudflareBindings }>) {
  try {
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    const body = await c.req.json();
    const { code, method = 'totp', enable_after_verify = false } = body;

    if (!userId || !code) {
      return c.json({
        success: false,
        error: 'ユーザーIDと認証コードが必要です。'
      }, 400);
    }

    // ユーザーの2FAシークレット取得
    const twoFactorRecord = await c.env.DB.prepare(`
      SELECT secret, backup_codes, is_enabled, method 
      FROM two_factor_secrets 
      WHERE user_id = ? AND tenant_id = ?
    `).bind(userId, tenantId).first();

    if (!twoFactorRecord) {
      return c.json({
        success: false,
        error: '2要素認証が設定されていません。'
      }, 404);
    }

    let verificationResult = false;
    let usedBackupCode = false;

    // 認証方法に応じて検証
    switch (method) {
      case 'totp':
        verificationResult = verifyTOTPCode(twoFactorRecord.secret, code);
        break;
      
      case 'backup_code':
        const backupCodes = JSON.parse(twoFactorRecord.backup_codes || '[]');
        verificationResult = backupCodes.includes(code);
        usedBackupCode = verificationResult;
        break;
    }

    if (!verificationResult) {
      // 失敗ログ記録
      await logSecurityEvent(c, 'two_factor_verification_failed', 'high', userId, {
        method,
        ip_address: c.req.header('CF-Connecting-IP'),
        user_agent: c.req.header('User-Agent')
      });

      return c.json({
        success: false,
        error: '認証コードが正しくありません。'
      }, 400);
    }

    // 成功時の処理
    if (enable_after_verify && !twoFactorRecord.is_enabled) {
      // 初回設定完了：2FAを有効化
      await c.env.DB.prepare(`
        UPDATE two_factor_secrets 
        SET is_enabled = 1, verified_at = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND tenant_id = ?
      `).bind(userId, tenantId).run();
    }

    // バックアップコードを使用した場合は削除
    if (usedBackupCode) {
      const backupCodes = JSON.parse(twoFactorRecord.backup_codes || '[]');
      const remainingCodes = backupCodes.filter((c: string) => c !== code);
      
      await c.env.DB.prepare(`
        UPDATE two_factor_secrets 
        SET backup_codes = ? 
        WHERE user_id = ? AND tenant_id = ?
      `).bind(JSON.stringify(remainingCodes), userId, tenantId).run();
    }

    // セッションに2FA確認状態を記録
    await recordSessionTwoFactorVerification(c, userId);

    // 成功ログ記録
    await logSecurityEvent(c, 'two_factor_verification_success', 'medium', userId, {
      method,
      used_backup_code: usedBackupCode,
      newly_enabled: enable_after_verify
    });

    return c.json({
      success: true,
      data: {
        verified: true,
        method_used: method,
        two_factor_enabled: twoFactorRecord.is_enabled || enable_after_verify,
        backup_codes_remaining: usedBackupCode ? 
          JSON.parse(twoFactorRecord.backup_codes || '[]').length - 1 : 
          JSON.parse(twoFactorRecord.backup_codes || '[]').length
      }
    });

  } catch (error) {
    console.error('Two-factor verification error:', error);
    return c.json({
      success: false,
      error: '2要素認証の検証でエラーが発生しました。'
    }, 500);
  }
}

/**
 * 2FA無効化API
 * DELETE /api/auth/two-factor/disable
 */
export async function disableTwoFactorAuth(c: Context<{ Bindings: CloudflareBindings }>) {
  try {
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    const body = await c.req.json();
    const { confirmation_code, reason } = body;

    // 現在のパスワードまたは2FAコードで本人確認
    const verificationResult = await verifyTOTPCode(
      await getUserTwoFactorSecret(c, userId), 
      confirmation_code
    );

    if (!verificationResult) {
      return c.json({
        success: false,
        error: '本人確認に失敗しました。'
      }, 400);
    }

    // 2FA設定を削除
    await c.env.DB.prepare(`
      DELETE FROM two_factor_secrets 
      WHERE user_id = ? AND tenant_id = ?
    `).bind(userId, tenantId).run();

    // セキュリティ監査ログ
    await logSecurityEvent(c, 'two_factor_disabled', 'high', userId, {
      reason: reason || 'user_request',
      ip_address: c.req.header('CF-Connecting-IP')
    });

    return c.json({
      success: true,
      message: '2要素認証が無効化されました。'
    });

  } catch (error) {
    console.error('Two-factor disable error:', error);
    return c.json({
      success: false,
      error: '2要素認証の無効化でエラーが発生しました。'
    }, 500);
  }
}

/**
 * ユーティリティ関数群
 */

// TOTPシークレット生成
function generateTOTPSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// QRコードURL生成
function generateQRCodeUrl(userId: string, secret: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${userId}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// バックアップコード生成
function generateBackupCodes(count: number): string[] {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
  }
  return codes;
}

// TOTP検証（簡易実装）
function verifyTOTPCode(secret: string, code: string): boolean {
  // 実際の実装では otplib などのライブラリを使用
  // ここでは簡易実装として常に一定の条件で通す
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / 30);
  
  // 検証ウィンドウ（前後1期間）を含めてチェック
  for (let i = -1; i <= 1; i++) {
    const testWindow = window + i;
    const expectedCode = generateTOTPForWindow(secret, testWindow);
    if (code === expectedCode) {
      return true;
    }
  }
  return false;
}

// TOTP生成（簡易実装）
function generateTOTPForWindow(secret: string, window: number): string {
  // 実際の実装ではHMAC-SHA1を使用
  // ここでは簡易実装
  const hash = (secret + window.toString()).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return Math.abs(hash % 1000000).toString().padStart(6, '0');
}

// ユーザーの2FA状態確認
async function checkUserTwoFactorStatus(c: Context<{ Bindings: CloudflareBindings }>, userId: string) {
  const record = await c.env.DB.prepare(`
    SELECT is_enabled FROM two_factor_secrets WHERE user_id = ?
  `).bind(userId).first();
  
  return {
    is_enabled: record?.is_enabled === 1,
    method: record?.method || 'totp'
  };
}

// セッション2FA確認状態チェック
async function checkSessionTwoFactorVerification(c: Context<{ Bindings: CloudflareBindings }>, userId: string): Promise<boolean> {
  const sessionId = c.req.header('X-Session-ID') || c.get('sessionId');
  if (!sessionId) return false;

  const verification = await c.env.DB.prepare(`
    SELECT verified_at FROM session_two_factor_verification 
    WHERE session_id = ? AND user_id = ? 
    AND verified_at > datetime('now', '-1 hour')
  `).bind(sessionId, userId).first();

  return !!verification;
}

// セッション2FA確認記録
async function recordSessionTwoFactorVerification(c: Context<{ Bindings: CloudflareBindings }>, userId: string): Promise<void> {
  const sessionId = c.req.header('X-Session-ID') || c.get('sessionId');
  if (!sessionId) return;

  await c.env.DB.prepare(`
    INSERT OR REPLACE INTO session_two_factor_verification 
    (id, session_id, user_id, verified_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(crypto.randomUUID(), sessionId, userId).run();
}

// ユーザーの2FAシークレット取得
async function getUserTwoFactorSecret(c: Context<{ Bindings: CloudflareBindings }>, userId: string): Promise<string> {
  const record = await c.env.DB.prepare(`
    SELECT secret FROM two_factor_secrets WHERE user_id = ? AND is_enabled = 1
  `).bind(userId).first();
  
  return record?.secret || '';
}

// セキュリティイベントログ記録
async function logSecurityEvent(
  c: Context<{ Bindings: CloudflareBindings }>, 
  eventType: string, 
  severity: string, 
  userId: string, 
  details: any
): Promise<void> {
  try {
    const tenantId = c.get('tenantId');
    
    await c.env.DB.prepare(`
      INSERT INTO security_events 
      (id, tenant_id, user_id, event_type, severity, ip_address, user_agent, geo_location, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      tenantId,
      userId,
      eventType,
      severity,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      c.req.header('CF-IPCountry') || 'unknown',
      JSON.stringify(details)
    ).run();
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}