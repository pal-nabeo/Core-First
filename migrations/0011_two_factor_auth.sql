-- Core First 2要素認証機能テーブル
-- TOTP (Time-based One-Time Password) および SMS ベース認証に対応

-- 1. 2要素認証シークレットテーブル
CREATE TABLE IF NOT EXISTS two_factor_secrets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  secret TEXT NOT NULL,
  backup_codes TEXT, -- JSON配列
  method TEXT DEFAULT 'totp', -- 'totp', 'sms', 'email'
  phone_number TEXT, -- SMS用電話番号
  is_enabled INTEGER DEFAULT 0,
  verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(user_id, tenant_id)
);

-- 2. セッション2要素認証確認テーブル
CREATE TABLE IF NOT EXISTS session_two_factor_verification (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT (datetime('now', '+1 hour')),
  method_used TEXT DEFAULT 'totp',
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(session_id, user_id)
);

-- 3. 2要素認証ログテーブル（監査用）
CREATE TABLE IF NOT EXISTS two_factor_auth_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'setup', 'verify', 'disable', 'backup_code_used'
  method TEXT NOT NULL, -- 'totp', 'sms', 'backup_code'
  result TEXT NOT NULL, -- 'success', 'failure'
  ip_address TEXT,
  user_agent TEXT,
  details TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 4. SMS認証コードテーブル（SMS認証時のコード管理）
CREATE TABLE IF NOT EXISTS sms_verification_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  purpose TEXT DEFAULT 'two_factor', -- 'two_factor', 'password_reset', 'phone_verification'
  attempts INTEGER DEFAULT 0,
  is_used INTEGER DEFAULT 0,
  expires_at DATETIME DEFAULT (datetime('now', '+10 minutes')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_two_factor_secrets_user_id ON two_factor_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_secrets_tenant_id ON two_factor_secrets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_secrets_enabled ON two_factor_secrets(is_enabled);

CREATE INDEX IF NOT EXISTS idx_session_two_factor_session_id ON session_two_factor_verification(session_id);
CREATE INDEX IF NOT EXISTS idx_session_two_factor_user_id ON session_two_factor_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_session_two_factor_expires_at ON session_two_factor_verification(expires_at);

CREATE INDEX IF NOT EXISTS idx_two_factor_auth_logs_user_id ON two_factor_auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_auth_logs_action ON two_factor_auth_logs(action);
CREATE INDEX IF NOT EXISTS idx_two_factor_auth_logs_created_at ON two_factor_auth_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_sms_verification_codes_user_id ON sms_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_verification_codes_phone ON sms_verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_verification_codes_expires_at ON sms_verification_codes(expires_at);

-- クリーンアップ用トリガー（期限切れレコード自動削除）
CREATE TRIGGER IF NOT EXISTS cleanup_expired_session_2fa
AFTER INSERT ON session_two_factor_verification
BEGIN
  DELETE FROM session_two_factor_verification 
  WHERE expires_at < datetime('now');
END;

CREATE TRIGGER IF NOT EXISTS cleanup_expired_sms_codes
AFTER INSERT ON sms_verification_codes
BEGIN
  DELETE FROM sms_verification_codes 
  WHERE expires_at < datetime('now');
END;