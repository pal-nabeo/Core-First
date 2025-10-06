-- PAL物流SaaS ログイン管理システム - 初期スキーマ
-- マルチテナント対応のユーザー認証・管理機能

-- 1. テナント（物流企業）管理
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, -- 物流企業名 (例: ○○運輸株式会社)
  subdomain TEXT UNIQUE NOT NULL, -- サブドメイン識別用 (例: abc-logistics)
  domain_allowlist TEXT, -- 許可ドメインリスト (JSON配列)
  plan_id TEXT NOT NULL DEFAULT 'free', -- プラン: free, standard, plus, pro
  status TEXT NOT NULL DEFAULT 'active', -- active, disabled, trial_expired
  region TEXT DEFAULT 'asia-pacific',
  company_type TEXT, -- 物流業種: general_cargo, delivery, warehouse, international
  company_size TEXT DEFAULT 'small', -- small, medium, large, enterprise
  trial_expires_at DATETIME, -- 無料トライアル期限
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 事業所・組織階層管理
CREATE TABLE IF NOT EXISTS organization_units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, -- 事業所名 (例: 東京営業所、大阪配送センター)
  code TEXT, -- 事業所コード (例: TKY001, OSK001)
  unit_type TEXT NOT NULL DEFAULT 'office', -- head_office, branch, office, warehouse, distribution_center
  parent_id TEXT, -- 親事業所ID（階層構造）
  address TEXT,
  phone TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES organization_units(id) ON DELETE SET NULL
);

-- 3. ロール（権限）定義
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, -- super_admin, admin, site_manager, user
  display_name TEXT NOT NULL, -- 表示名（日本語）
  description TEXT,
  is_system_role INTEGER DEFAULT 0, -- システム標準ロールかどうか
  permissions TEXT, -- 権限リスト (JSON配列)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 4. ユーザー管理
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL, -- ユーザー表示名
  hashed_password TEXT NOT NULL, -- bcrypt or Argon2
  password_algo TEXT DEFAULT 'bcrypt', -- ハッシュアルゴリズム
  status TEXT NOT NULL DEFAULT 'active', -- active, disabled, frozen, trial_expired
  last_login_at DATETIME,
  last_login_ip TEXT,
  must_reset_password INTEGER DEFAULT 0, -- パスワード強制リセットフラグ
  password_expires_at DATETIME, -- パスワード有効期限
  phone_number TEXT, -- 2FA用電話番号
  locale TEXT DEFAULT 'ja-JP',
  timezone TEXT DEFAULT 'Asia/Tokyo',
  failed_login_count INTEGER DEFAULT 0, -- ログイン失敗回数
  locked_until DATETIME, -- アカウントロック期限
  email_verified INTEGER DEFAULT 0, -- メールアドレス確認済みフラグ
  two_fa_enabled INTEGER DEFAULT 0, -- 2FA有効フラグ
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, email) -- テナント内でメールアドレスはユニーク
);

-- 5. ユーザーロール割り当て
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  organization_unit_id TEXT, -- 事業所レベル権限の場合
  scope TEXT DEFAULT 'tenant', -- tenant, organization_unit
  assigned_by TEXT, -- 割り当て実行者のユーザーID
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME, -- 権限有効期限（一時権限用）
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_unit_id) REFERENCES organization_units(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, role_id, organization_unit_id) -- 重複割り当て防止
);

-- 6. 招待管理
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  inviter_id TEXT NOT NULL, -- 招待者のユーザーID
  email TEXT NOT NULL,
  role_id TEXT NOT NULL, -- 招待時の権限
  organization_unit_id TEXT, -- 招待先事業所
  token TEXT UNIQUE NOT NULL, -- 招待トークン
  expires_at DATETIME NOT NULL, -- 招待有効期限 (7日間)
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, expired, cancelled
  invitation_message TEXT, -- カスタム招待メッセージ
  accepted_at DATETIME,
  accepted_by TEXT, -- 招待受諾時のユーザーID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_unit_id) REFERENCES organization_units(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, email, status) -- 同一テナント内で同一メールアドレスの有効招待は1つのみ
);

-- 7. パスワードリセット管理
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL, -- 1時間の有効期限
  used_at DATETIME, -- 利用済み時刻
  ip_address TEXT, -- リクエスト元IP
  user_agent TEXT, -- リクエスト元ユーザーエージェント
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. セッション管理
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  csrf_token TEXT,
  expires_at DATETIME NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT, -- デバイス識別用
  is_remember_me INTEGER DEFAULT 0, -- ログイン状態保持
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 9. ログイン失敗ログ（セキュリティ監視用）
CREATE TABLE IF NOT EXISTS failed_logins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT, -- 存在する場合のみ
  email TEXT NOT NULL, -- 入力されたメールアドレス
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  failure_reason TEXT NOT NULL, -- wrong_password, account_locked, account_disabled, etc.
  attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 10. アカウントロックアウト管理
CREATE TABLE IF NOT EXISTS account_lockouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  lock_type TEXT NOT NULL, -- temporary, permanent, security_review
  locked_until DATETIME, -- NULL = 無期限ロック
  lock_reason TEXT NOT NULL,
  locked_by TEXT, -- ロック実行者（システム or 管理者ID）
  unlock_token TEXT, -- 管理者用アンロックトークン
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unlocked_at DATETIME,
  unlocked_by TEXT, -- アンロック実行者
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (unlocked_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 11. 2要素認証管理
CREATE TABLE IF NOT EXISTS two_factor_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  method_type TEXT NOT NULL, -- sms, totp, backup_codes
  secret_data TEXT, -- 暗号化された秘密鍵/電話番号
  is_verified INTEGER DEFAULT 0,
  is_primary INTEGER DEFAULT 0, -- 主要認証方法
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 12. バックアップコード管理
CREATE TABLE IF NOT EXISTS backup_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL, -- ハッシュ化されたバックアップコード
  used_at DATETIME, -- NULL = 未使用
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 13. 監査ログ
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor_user_id TEXT, -- 操作実行者
  action_type TEXT NOT NULL, -- login, logout, user_create, user_update, permission_change, etc.
  target_type TEXT, -- user, tenant, role, invitation, etc.
  target_id TEXT, -- 対象オブジェクトのID
  ip_address TEXT,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT,
  payload TEXT, -- 追加情報 (JSON)
  result TEXT NOT NULL, -- success, failure, error
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 14. IP許可リスト
CREATE TABLE IF NOT EXISTS ip_allowlists (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  cidr_range TEXT NOT NULL, -- CIDR記法のIPアドレス範囲
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_by TEXT, -- 作成者のユーザーID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- インデックス作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_failed_logins_ip ON failed_logins(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_logins_email ON failed_logins(email);
CREATE INDEX IF NOT EXISTS idx_failed_logins_attempt_at ON failed_logins(attempt_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_organization_units_tenant_id ON organization_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_organization_units_parent_id ON organization_units(parent_id);