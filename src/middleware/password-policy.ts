// Core First パスワードポリシー強化ミドルウェア
// テナント・プラン別のパスワード要件と履歴管理

import { Context } from 'hono';
import type { CloudflareBindings } from '../types/auth';

interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_symbols: boolean;
  min_character_types: number;
  password_expiry_days: number;
  password_history_count: number;
  prohibit_common_passwords: boolean;
  prohibit_personal_info: boolean;
  max_login_attempts: number;
  lockout_duration_minutes: number;
}

interface PasswordValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  strength_score: number; // 0-100
  policy_met: boolean;
}

/**
 * パスワード強度検証
 */
export async function validatePasswordStrength(
  c: Context<{ Bindings: CloudflareBindings }>, 
  password: string, 
  tenantId: string, 
  userInfo?: { email: string; name: string }
): Promise<PasswordValidationResult> {
  
  const result: PasswordValidationResult = {
    is_valid: false,
    errors: [],
    warnings: [],
    strength_score: 0,
    policy_met: false
  };

  try {
    // テナントのパスワードポリシー取得
    const policy = await getPasswordPolicy(c, tenantId);
    
    // 基本的な長さチェック
    if (password.length < policy.min_length) {
      result.errors.push(`パスワードは${policy.min_length}文字以上で入力してください。`);
    }

    // 文字種別チェック
    const charTypes = getCharacterTypes(password);
    const metCharTypes = Object.values(charTypes).filter(Boolean).length;

    if (policy.require_uppercase && !charTypes.hasUppercase) {
      result.errors.push('大文字を含む必要があります。');
    }
    if (policy.require_lowercase && !charTypes.hasLowercase) {
      result.errors.push('小文字を含む必要があります。');
    }
    if (policy.require_numbers && !charTypes.hasNumbers) {
      result.errors.push('数字を含む必要があります。');
    }
    if (policy.require_symbols && !charTypes.hasSymbols) {
      result.errors.push('記号を含む必要があります。');
    }
    if (metCharTypes < policy.min_character_types) {
      result.errors.push(`${policy.min_character_types}種類以上の文字種別が必要です。`);
    }

    // 共通パスワードチェック
    if (policy.prohibit_common_passwords && await isCommonPassword(c, password)) {
      result.errors.push('よく使用される危険なパスワードです。別のパスワードをお選びください。');
    }

    // 個人情報チェック
    if (policy.prohibit_personal_info && userInfo && containsPersonalInfo(password, userInfo)) {
      result.errors.push('パスワードに個人情報（名前、メールアドレスの一部）を含めることはできません。');
    }

    // パスワード強度スコア計算
    result.strength_score = calculatePasswordScore(password, charTypes);

    // 警告メッセージ
    if (result.strength_score < 60) {
      result.warnings.push('パスワード強度が低いです。より複雑なパスワードを推奨します。');
    }
    if (isSequentialPattern(password)) {
      result.warnings.push('連続した文字や数字のパターンが検出されました。');
    }
    if (isRepeatingPattern(password)) {
      result.warnings.push('繰り返しパターンが検出されました。');
    }

    // 全体的な妥当性判定
    result.policy_met = result.errors.length === 0;
    result.is_valid = result.policy_met && result.strength_score >= 40;

  } catch (error) {
    console.error('Password validation error:', error);
    result.errors.push('パスワード検証中にエラーが発生しました。');
  }

  return result;
}

/**
 * パスワード履歴チェック
 */
export async function checkPasswordHistory(
  c: Context<{ Bindings: CloudflareBindings }>, 
  userId: string, 
  newPassword: string, 
  tenantId: string
): Promise<{ is_duplicate: boolean; message?: string }> {
  
  try {
    const policy = await getPasswordPolicy(c, tenantId);
    
    if (policy.password_history_count === 0) {
      return { is_duplicate: false };
    }

    // 過去のパスワードハッシュ取得
    const passwordHistory = await c.env.DB.prepare(`
      SELECT hashed_password FROM password_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).bind(userId, policy.password_history_count).all();

    // 新しいパスワードのハッシュ生成（bcryptを想定）
    const newPasswordHash = await hashPassword(newPassword);

    // 過去のパスワードとの重複チェック
    for (const record of passwordHistory.results || []) {
      if (await comparePasswords(newPassword, record.hashed_password)) {
        return { 
          is_duplicate: true, 
          message: `過去${policy.password_history_count}回のパスワードは使用できません。` 
        };
      }
    }

    return { is_duplicate: false };

  } catch (error) {
    console.error('Password history check error:', error);
    return { is_duplicate: false }; // エラー時は制限しない
  }
}

/**
 * パスワード履歴保存
 */
export async function savePasswordHistory(
  c: Context<{ Bindings: CloudflareBindings }>, 
  userId: string, 
  passwordHash: string
): Promise<void> {
  
  try {
    const tenantId = c.get('tenantId');
    const policy = await getPasswordPolicy(c, tenantId);

    if (policy.password_history_count === 0) {
      return;
    }

    // 新しい履歴を追加
    await c.env.DB.prepare(`
      INSERT INTO password_history (id, user_id, hashed_password, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(crypto.randomUUID(), userId, passwordHash).run();

    // 古い履歴を削除（制限数を超えた分）
    await c.env.DB.prepare(`
      DELETE FROM password_history 
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM password_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      )
    `).bind(userId, userId, policy.password_history_count).run();

  } catch (error) {
    console.error('Save password history error:', error);
  }
}

/**
 * パスワード期限チェック
 */
export async function checkPasswordExpiry(
  c: Context<{ Bindings: CloudflareBindings }>, 
  userId: string, 
  tenantId: string
): Promise<{ is_expired: boolean; days_until_expiry: number; message?: string }> {
  
  try {
    const policy = await getPasswordPolicy(c, tenantId);
    
    if (policy.password_expiry_days === 0) {
      return { is_expired: false, days_until_expiry: -1 };
    }

    // 最新のパスワード変更日取得
    const lastPasswordChange = await c.env.DB.prepare(`
      SELECT created_at FROM password_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).bind(userId).first();

    if (!lastPasswordChange) {
      // 履歴がない場合はユーザー作成日を使用
      const user = await c.env.DB.prepare(`
        SELECT created_at FROM users WHERE id = ?
      `).bind(userId).first();
      
      if (!user) {
        return { is_expired: false, days_until_expiry: -1 };
      }
      
      const daysSinceCreation = Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysUntilExpiry = policy.password_expiry_days - daysSinceCreation;
      
      return {
        is_expired: daysUntilExpiry <= 0,
        days_until_expiry: daysUntilExpiry,
        message: daysUntilExpiry <= 7 ? `パスワードの有効期限まで${daysUntilExpiry}日です。` : undefined
      };
    }

    const daysSinceChange = Math.floor(
      (Date.now() - new Date(lastPasswordChange.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysUntilExpiry = policy.password_expiry_days - daysSinceChange;

    return {
      is_expired: daysUntilExpiry <= 0,
      days_until_expiry: daysUntilExpiry,
      message: daysUntilExpiry <= 7 && daysUntilExpiry > 0 ? 
        `パスワードの有効期限まで${daysUntilExpiry}日です。` : undefined
    };

  } catch (error) {
    console.error('Password expiry check error:', error);
    return { is_expired: false, days_until_expiry: -1 };
  }
}

/**
 * テナントのパスワードポリシー取得
 */
async function getPasswordPolicy(c: Context<{ Bindings: CloudflareBindings }>, tenantId: string): Promise<PasswordPolicy> {
  const policy = await c.env.DB.prepare(`
    SELECT * FROM password_policies WHERE tenant_id = ? AND is_active = 1
  `).bind(tenantId).first();

  if (policy) {
    return {
      min_length: policy.min_length,
      require_uppercase: policy.require_uppercase === 1,
      require_lowercase: policy.require_lowercase === 1,
      require_numbers: policy.require_numbers === 1,
      require_symbols: policy.require_symbols === 1,
      min_character_types: policy.min_character_types,
      password_expiry_days: policy.password_expiry_days,
      password_history_count: policy.password_history_count,
      prohibit_common_passwords: policy.prohibit_common_passwords === 1,
      prohibit_personal_info: policy.prohibit_personal_info === 1,
      max_login_attempts: policy.max_login_attempts,
      lockout_duration_minutes: policy.lockout_duration_minutes
    };
  }

  // デフォルトポリシー
  return {
    min_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_symbols: false,
    min_character_types: 3,
    password_expiry_days: 90,
    password_history_count: 12,
    prohibit_common_passwords: true,
    prohibit_personal_info: true,
    max_login_attempts: 5,
    lockout_duration_minutes: 15
  };
}

/**
 * 文字種別分析
 */
function getCharacterTypes(password: string) {
  return {
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumbers: /[0-9]/.test(password),
    hasSymbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };
}

/**
 * パスワード強度スコア計算
 */
function calculatePasswordScore(password: string, charTypes: any): number {
  let score = 0;

  // 長さによるスコア
  score += Math.min(password.length * 2, 20);

  // 文字種別によるスコア
  if (charTypes.hasUppercase) score += 10;
  if (charTypes.hasLowercase) score += 10;
  if (charTypes.hasNumbers) score += 10;
  if (charTypes.hasSymbols) score += 15;

  // 複雑性ボーナス
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // ペナルティ
  if (isSequentialPattern(password)) score -= 15;
  if (isRepeatingPattern(password)) score -= 15;
  if (isDictionaryWord(password)) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * 共通パスワードチェック
 */
async function isCommonPassword(c: Context<{ Bindings: CloudflareBindings }>, password: string): Promise<boolean> {
  const commonPassword = await c.env.DB.prepare(`
    SELECT 1 FROM common_passwords WHERE password = ?
  `).bind(password.toLowerCase()).first();

  return !!commonPassword;
}

/**
 * 個人情報含有チェック
 */
function containsPersonalInfo(password: string, userInfo: { email: string; name: string }): boolean {
  const lowerPassword = password.toLowerCase();
  
  // 名前の一部をチェック
  const nameParts = userInfo.name.toLowerCase().split(/\s+/);
  for (const part of nameParts) {
    if (part.length >= 3 && lowerPassword.includes(part)) {
      return true;
    }
  }

  // メールアドレスのローカル部分をチェック
  const emailLocal = userInfo.email.split('@')[0].toLowerCase();
  if (emailLocal.length >= 3 && lowerPassword.includes(emailLocal)) {
    return true;
  }

  return false;
}

/**
 * 連続パターンチェック
 */
function isSequentialPattern(password: string): boolean {
  const sequences = ['123456', 'abcdef', 'qwerty', '987654', 'fedcba'];
  const lowerPassword = password.toLowerCase();
  
  return sequences.some(seq => lowerPassword.includes(seq));
}

/**
 * 繰り返しパターンチェック
 */
function isRepeatingPattern(password: string): boolean {
  // 同じ文字が4回以上連続
  if (/(.)\1{3,}/.test(password)) {
    return true;
  }
  
  // 短いパターンの繰り返し
  for (let i = 1; i <= password.length / 2; i++) {
    const pattern = password.substring(0, i);
    if (password.startsWith(pattern.repeat(Math.floor(password.length / i)))) {
      if (pattern.length >= 2 && Math.floor(password.length / i) >= 3) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 辞書単語チェック（簡易実装）
 */
function isDictionaryWord(password: string): boolean {
  const commonWords = ['password', 'admin', 'user', 'login', 'welcome', 'secret'];
  const lowerPassword = password.toLowerCase();
  
  return commonWords.some(word => lowerPassword.includes(word));
}

/**
 * パスワードハッシュ化（簡易実装）
 */
async function hashPassword(password: string): Promise<string> {
  // 実際の実装ではbcryptを使用
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * パスワード比較（簡易実装）
 */
async function comparePasswords(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}