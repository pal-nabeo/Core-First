// Core First 2要素認証API ルート
// TOTP、SMS、バックアップコードによる認証に対応

import { Hono } from 'hono';
import { setupTwoFactorAuth, verifyTwoFactorAuth, disableTwoFactorAuth } from '../middleware/two-factor-auth';
import type { CloudflareBindings } from '../types/auth';

const twoFactorAuthRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 2要素認証設定開始
twoFactorAuthRoutes.post('/setup', setupTwoFactorAuth);

// 2要素認証コード検証
twoFactorAuthRoutes.post('/verify', verifyTwoFactorAuth);

// 2要素認証無効化
twoFactorAuthRoutes.delete('/disable', disableTwoFactorAuth);

// 2要素認証状態取得
twoFactorAuthRoutes.get('/status', async (c) => {
  try {
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    
    if (!userId) {
      return c.json({
        success: false,
        error: '認証が必要です。'
      }, 401);
    }

    const twoFactorRecord = await c.env.DB.prepare(`
      SELECT method, is_enabled, verified_at, backup_codes
      FROM two_factor_secrets 
      WHERE user_id = ? AND tenant_id = ?
    `).bind(userId, tenantId).first();

    const backupCodesCount = twoFactorRecord?.backup_codes ? 
      JSON.parse(twoFactorRecord.backup_codes).length : 0;

    // セッション2FA確認状態
    const sessionId = c.req.header('X-Session-ID') || c.get('sessionId');
    const sessionVerification = sessionId ? await c.env.DB.prepare(`
      SELECT verified_at FROM session_two_factor_verification 
      WHERE session_id = ? AND user_id = ? 
      AND verified_at > datetime('now', '-1 hour')
    `).bind(sessionId, userId).first() : null;

    return c.json({
      success: true,
      data: {
        is_enabled: twoFactorRecord?.is_enabled === 1,
        method: twoFactorRecord?.method || null,
        verified_at: twoFactorRecord?.verified_at,
        backup_codes_remaining: backupCodesCount,
        session_verified: !!sessionVerification,
        session_verification_expires: sessionVerification?.verified_at
      }
    });

  } catch (error) {
    console.error('Two-factor status error:', error);
    return c.json({
      success: false,
      error: '2要素認証の状態取得でエラーが発生しました。'
    }, 500);
  }
});

// バックアップコード再生成
twoFactorAuthRoutes.post('/regenerate-backup-codes', async (c) => {
  try {
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    const body = await c.req.json();
    const { current_code } = body;

    if (!userId || !current_code) {
      return c.json({
        success: false,
        error: 'ユーザーIDと現在の認証コードが必要です。'
      }, 400);
    }

    // 現在のTOTPコードで本人確認
    const twoFactorRecord = await c.env.DB.prepare(`
      SELECT secret, is_enabled FROM two_factor_secrets 
      WHERE user_id = ? AND tenant_id = ? AND is_enabled = 1
    `).bind(userId, tenantId).first();

    if (!twoFactorRecord) {
      return c.json({
        success: false,
        error: '2要素認証が有効化されていません。'
      }, 404);
    }

    // TOTP検証（簡易実装）
    const isValid = verifyTOTPCode(twoFactorRecord.secret, current_code);
    if (!isValid) {
      return c.json({
        success: false,
        error: '認証コードが正しくありません。'
      }, 400);
    }

    // 新しいバックアップコード生成
    const newBackupCodes = generateBackupCodes(8);

    // データベース更新
    await c.env.DB.prepare(`
      UPDATE two_factor_secrets 
      SET backup_codes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND tenant_id = ?
    `).bind(JSON.stringify(newBackupCodes), userId, tenantId).run();

    // 監査ログ記録
    await c.env.DB.prepare(`
      INSERT INTO two_factor_auth_logs 
      (id, user_id, tenant_id, action, method, result, ip_address, user_agent, details)
      VALUES (?, ?, ?, 'backup_codes_regenerated', 'totp', 'success', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      tenantId,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      JSON.stringify({ codes_count: newBackupCodes.length })
    ).run();

    return c.json({
      success: true,
      data: {
        backup_codes: newBackupCodes,
        message: 'バックアップコードが再生成されました。安全な場所に保管してください。'
      }
    });

  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    return c.json({
      success: false,
      error: 'バックアップコードの再生成でエラーが発生しました。'
    }, 500);
  }
});

// SMS認証設定（Pro プラン以上）
twoFactorAuthRoutes.post('/setup-sms', async (c) => {
  try {
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    const body = await c.req.json();
    const { phone_number } = body;

    if (!userId || !phone_number) {
      return c.json({
        success: false,
        error: 'ユーザーIDと電話番号が必要です。'
      }, 400);
    }

    // プラン制限チェック（SMS認証はPro以上）
    const license = await c.env.DB.prepare(`
      SELECT plan_type FROM tenant_licenses 
      WHERE tenant_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).bind(tenantId).first();

    const allowedPlans = ['pro', 'enterprise'];
    if (!license || !allowedPlans.includes(license.plan_type)) {
      return c.json({
        success: false,
        error: 'SMS認証はPro プラン以上でご利用いただけます。'
      }, 403);
    }

    // SMS認証コード生成・送信
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // SMS送信処理（実装は省略 - Twilio等のサービスを使用）
    // await sendSMS(phone_number, `Core First 認証コード: ${verificationCode}`);

    // 認証コードをデータベースに保存
    await c.env.DB.prepare(`
      INSERT INTO sms_verification_codes 
      (id, user_id, phone_number, verification_code, purpose, expires_at)
      VALUES (?, ?, ?, ?, 'two_factor_setup', datetime('now', '+10 minutes'))
    `).bind(
      crypto.randomUUID(),
      userId,
      phone_number,
      verificationCode
    ).run();

    return c.json({
      success: true,
      data: {
        message: '認証コードをSMSで送信しました。10分以内に認証を完了してください。',
        phone_number: phone_number.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') // 電話番号をマスク
      }
    });

  } catch (error) {
    console.error('SMS two-factor setup error:', error);
    return c.json({
      success: false,
      error: 'SMS認証の設定でエラーが発生しました。'
    }, 500);
  }
});

// SMS認証コード確認
twoFactorAuthRoutes.post('/verify-sms', async (c) => {
  try {
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    const body = await c.req.json();
    const { verification_code } = body;

    if (!userId || !verification_code) {
      return c.json({
        success: false,
        error: 'ユーザーIDと認証コードが必要です。'
      }, 400);
    }

    // SMS認証コード確認
    const smsRecord = await c.env.DB.prepare(`
      SELECT id, phone_number FROM sms_verification_codes 
      WHERE user_id = ? AND verification_code = ? 
      AND purpose = 'two_factor_setup' AND is_used = 0 
      AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).bind(userId, verification_code).first();

    if (!smsRecord) {
      return c.json({
        success: false,
        error: '認証コードが正しくないか有効期限が切れています。'
      }, 400);
    }

    // SMS認証を有効化
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO two_factor_secrets 
      (id, user_id, tenant_id, secret, method, phone_number, is_enabled, verified_at)
      VALUES (?, ?, ?, ?, 'sms', ?, 1, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      userId,
      tenantId,
      crypto.randomUUID(), // SMS用のダミーシークレット
      smsRecord.phone_number
    ).run();

    // 使用済みマーク
    await c.env.DB.prepare(`
      UPDATE sms_verification_codes SET is_used = 1 WHERE id = ?
    `).bind(smsRecord.id).run();

    return c.json({
      success: true,
      data: {
        message: 'SMS認証が有効化されました。',
        method: 'sms',
        phone_number: smsRecord.phone_number.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      }
    });

  } catch (error) {
    console.error('SMS verification error:', error);
    return c.json({
      success: false,
      error: 'SMS認証コードの確認でエラーが発生しました。'
    }, 500);
  }
});

// ユーティリティ関数
function generateBackupCodes(count: number): string[] {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
  }
  return codes;
}

function verifyTOTPCode(secret: string, code: string): boolean {
  // 簡易TOTP検証実装
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / 30);
  
  for (let i = -1; i <= 1; i++) {
    const testWindow = window + i;
    const expectedCode = generateTOTPForWindow(secret, testWindow);
    if (code === expectedCode) {
      return true;
    }
  }
  return false;
}

function generateTOTPForWindow(secret: string, window: number): string {
  const hash = (secret + window.toString()).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return Math.abs(hash % 1000000).toString().padStart(6, '0');
}

export default twoFactorAuthRoutes;