-- 権限スコープ管理テーブル追加
CREATE TABLE IF NOT EXISTS permission_scopes (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL, -- 'system', 'tenant', 'organization_unit'
  scope_id TEXT NOT NULL, -- システム全体='system', テナントID, 事業所ID
  permission TEXT NOT NULL, -- 権限名
  resource_type TEXT, -- 対象リソースタイプ
  resource_pattern TEXT, -- リソースパターン（正規表現）
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope_type, scope_id, permission, resource_type)
);

-- テナント管理強化テーブル
CREATE TABLE IF NOT EXISTS tenant_management_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'created', 'updated', 'suspended', 'deleted', 'plan_changed'
  performed_by TEXT NOT NULL, -- 操作実行者（サービス提供者側ユーザーID）
  old_values TEXT, -- 変更前の値（JSON）
  new_values TEXT, -- 変更後の値（JSON）
  reason TEXT, -- 操作理由
  approval_required INTEGER DEFAULT 0, -- 承認が必要な操作かどうか
  approved_by TEXT, -- 承認者のユーザーID
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- サービス提供者認証情報テーブル（システムユーザー専用認証情報）
CREATE TABLE IF NOT EXISTS service_provider_auth (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  auth_type TEXT NOT NULL, -- 'password', 'mfa', 'sso'
  auth_data TEXT NOT NULL, -- 認証データ（JSON）
  is_active INTEGER DEFAULT 1,
  expires_at DATETIME,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, auth_type)
);

-- クロステナントユーザー管理ビュー（サービス提供者側専用）
CREATE VIEW IF NOT EXISTS cross_tenant_users AS
SELECT 
  u.id,
  u.tenant_id,
  t.name as tenant_name,
  u.email,
  u.display_name,
  u.status,
  u.last_login_at,
  GROUP_CONCAT(r.display_name, ', ') as roles,
  u.created_at
FROM users u
JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE t.id NOT IN ('system', 'role-template') -- システムユーザーとテンプレートは除外
GROUP BY u.id, u.tenant_id, t.name, u.email, u.display_name, u.status, u.last_login_at, u.created_at;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_permission_scopes_scope ON permission_scopes(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_permission_scopes_permission ON permission_scopes(permission);
CREATE INDEX IF NOT EXISTS idx_tenant_management_logs_tenant_id ON tenant_management_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_management_logs_performed_by ON tenant_management_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_tenant_management_logs_action_type ON tenant_management_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_service_provider_auth_user_id ON service_provider_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_service_provider_auth_type ON service_provider_auth(auth_type);