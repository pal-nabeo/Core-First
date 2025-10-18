-- Core First セキュリティ機能強化
-- ログイン管理機能 要件定義書準拠のセキュリティテーブル

-- 1. パスワード履歴テーブル（過去12回分の履歴管理）
CREATE TABLE IF NOT EXISTS password_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  hashed_password TEXT NOT NULL,
  password_algo TEXT DEFAULT 'bcrypt',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. パスワードポリシーテーブル（テナント・プラン別設定）
CREATE TABLE IF NOT EXISTS password_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  min_length INTEGER DEFAULT 8,
  require_uppercase INTEGER DEFAULT 1,
  require_lowercase INTEGER DEFAULT 1,
  require_numbers INTEGER DEFAULT 1,
  require_symbols INTEGER DEFAULT 0,
  min_character_types INTEGER DEFAULT 3, -- 必要な文字種別数
  password_expiry_days INTEGER DEFAULT 90, -- パスワード有効期限
  password_history_count INTEGER DEFAULT 12, -- 履歴保存数
  prohibit_common_passwords INTEGER DEFAULT 1,
  prohibit_personal_info INTEGER DEFAULT 1,
  max_login_attempts INTEGER DEFAULT 5,
  lockout_duration_minutes INTEGER DEFAULT 15,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id)
);

-- 3. SSO設定テーブル
CREATE TABLE IF NOT EXISTS sso_configurations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider_type TEXT NOT NULL, -- 'google', 'azure', 'okta', 'saml'
  provider_name TEXT NOT NULL,
  client_id TEXT,
  client_secret TEXT,
  issuer_url TEXT,
  authorization_endpoint TEXT,
  token_endpoint TEXT,
  userinfo_endpoint TEXT,
  saml_metadata_url TEXT,
  saml_certificate TEXT,
  domain_restriction TEXT, -- 許可ドメイン（JSON配列）
  attribute_mapping TEXT, -- 属性マッピング（JSON）
  is_active INTEGER DEFAULT 1,
  auto_provisioning INTEGER DEFAULT 0,
  default_role_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (default_role_id) REFERENCES roles(id) ON DELETE SET NULL
);

-- 4. セキュリティイベントテーブル（不正アクセス検知・監視）
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL, -- 'suspicious_login', 'brute_force', 'account_locked', 'password_changed', 'unauthorized_access'
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  ip_address TEXT,
  user_agent TEXT,
  geo_location TEXT,
  details TEXT, -- イベント詳細（JSON）
  is_resolved INTEGER DEFAULT 0,
  resolved_by TEXT,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. API キー管理テーブル
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  key_name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  api_secret TEXT,
  permissions TEXT, -- 権限（JSON配列）
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 1000,
  is_active INTEGER DEFAULT 1,
  expires_at DATETIME,
  last_used_at DATETIME,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. セッション詳細管理テーブル（既存sessionsテーブルの拡張）
CREATE TABLE IF NOT EXISTS session_details (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  device_fingerprint TEXT,
  browser_name TEXT,
  browser_version TEXT,
  os_name TEXT,
  os_version TEXT,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  screen_resolution TEXT,
  timezone TEXT,
  language TEXT,
  is_mobile INTEGER DEFAULT 0,
  is_bot INTEGER DEFAULT 0,
  risk_score INTEGER DEFAULT 0, -- 0-100のリスクスコア
  geo_country TEXT,
  geo_city TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 7. 地理的制限テーブル（Pro プラン以上）
CREATE TABLE IF NOT EXISTS geo_restrictions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restriction_type TEXT NOT NULL, -- 'allow', 'deny'
  country_codes TEXT NOT NULL, -- JSON配列 ["JP", "US", "GB"]
  ip_ranges TEXT, -- JSON配列 ["192.168.1.0/24"]
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 8. 緊急アクセス履歴テーブル
CREATE TABLE IF NOT EXISTS emergency_access_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  performed_by TEXT NOT NULL, -- サービス提供者ユーザーID
  target_user_id TEXT,
  access_type TEXT NOT NULL, -- 'password_reset', 'account_unlock', 'emergency_login', 'data_access'
  reason TEXT NOT NULL,
  approval_required INTEGER DEFAULT 1,
  approved_by TEXT,
  approved_at DATETIME,
  ip_address TEXT,
  user_agent TEXT,
  session_duration_minutes INTEGER,
  actions_performed TEXT, -- 実行した操作（JSON）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);

CREATE INDEX IF NOT EXISTS idx_password_policies_tenant_id ON password_policies(tenant_id);

CREATE INDEX IF NOT EXISTS idx_sso_configurations_tenant_id ON sso_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sso_configurations_provider ON sso_configurations(provider_type);

CREATE INDEX IF NOT EXISTS idx_security_events_tenant_id ON security_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

CREATE INDEX IF NOT EXISTS idx_session_details_session_id ON session_details(session_id);

CREATE INDEX IF NOT EXISTS idx_geo_restrictions_tenant_id ON geo_restrictions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_emergency_access_logs_tenant_id ON emergency_access_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_logs_performed_by ON emergency_access_logs(performed_by);

-- 初期パスワードポリシー設定（既存テナント用）
INSERT OR IGNORE INTO password_policies (
  id, tenant_id, min_length, require_uppercase, require_lowercase, require_numbers, require_symbols, 
  min_character_types, password_expiry_days, password_history_count, 
  prohibit_common_passwords, prohibit_personal_info, max_login_attempts, lockout_duration_minutes
) 
SELECT 
  'pp-' || t.id,
  t.id,
  CASE 
    WHEN t.plan_id IN ('free') THEN 8
    WHEN t.plan_id IN ('standard', 'plus') THEN 8
    WHEN t.plan_id IN ('pro', 'enterprise') THEN 12
    ELSE 8
  END, -- min_length
  1, -- require_uppercase
  1, -- require_lowercase  
  1, -- require_numbers
  CASE 
    WHEN t.plan_id IN ('pro', 'enterprise') THEN 1 
    ELSE 0 
  END, -- require_symbols (Pro以上で必須)
  3, -- min_character_types
  CASE 
    WHEN t.plan_id IN ('free') THEN 0 -- パスワード期限なし
    WHEN t.plan_id IN ('standard', 'plus') THEN 90
    WHEN t.plan_id IN ('pro', 'enterprise') THEN 90
    ELSE 90
  END, -- password_expiry_days
  CASE 
    WHEN t.plan_id IN ('free') THEN 0 -- 履歴管理なし
    WHEN t.plan_id IN ('standard', 'plus') THEN 12
    WHEN t.plan_id IN ('pro', 'enterprise') THEN 12
    ELSE 12
  END, -- password_history_count
  1, -- prohibit_common_passwords
  1, -- prohibit_personal_info
  5, -- max_login_attempts
  15 -- lockout_duration_minutes
FROM tenants t 
WHERE t.id NOT IN ('system', 'role-template');

-- よく使用される危険なパスワード一覧（禁止リスト）
CREATE TABLE IF NOT EXISTS common_passwords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  password TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 一般的な危険パスワードの初期データ
INSERT OR IGNORE INTO common_passwords (password) VALUES 
('password'), ('123456'), ('password123'), ('admin'), ('qwerty'), ('letmein'),
('welcome'), ('monkey'), ('1234567890'), ('abc123'), ('password1'), ('123456789'),
('welcome123'), ('admin123'), ('root'), ('toor'), ('pass'), ('test'), ('guest'),
('user'), ('demo'), ('sample'), ('temp'), ('default'), ('changeme'), ('secret');

-- システムテナント用の強化されたパスワードポリシー
UPDATE password_policies 
SET 
  min_length = 16,
  require_symbols = 1,
  min_character_types = 4,
  password_expiry_days = 60,
  password_history_count = 20,
  max_login_attempts = 3,
  lockout_duration_minutes = 30
WHERE tenant_id = 'system';