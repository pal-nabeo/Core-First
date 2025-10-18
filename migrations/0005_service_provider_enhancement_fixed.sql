-- Core First サービス提供者側機能強化（修正版）
-- 要件定義書 v2.0 に基づくサービス提供者とテナント管理者の明確分離

-- 1. 既存のsystemテナント情報を更新（安全に）
UPDATE tenants 
SET 
    name = 'Core First サービス提供者', 
    plan_id = 'unlimited', 
    company_type = 'service_provider',
    company_size = 'enterprise'
WHERE id = 'system';

-- 2. テンプレートロール用の特別なテナント作成
INSERT OR IGNORE INTO tenants (
  id, name, plan_id, company_type, company_size, status, created_at
) VALUES (
  'role-template', 'ロールテンプレート', 'template', 'template', 'template', 'active', datetime('now')
);

-- 3. 既存のシステムロールを維持しつつ、新しいサービス提供者ロールを追加
INSERT OR IGNORE INTO roles (id, tenant_id, name, display_name, description, is_system_role, permissions) VALUES 
  -- 新しいサービス提供者専用ロール
  ('role_system_operation_admin', 'system', 'operation_admin', '運用管理者', '日常運用・アラート対応・定型作業・ユーザーサポート', 1,
   '["operation.daily", "alert.respond", "user.support", "reports.create", "logs.operation"]'),
   
  ('role_system_customer_success', 'system', 'customer_success', 'カスタマーサクセス', 'テナントサポート・問い合わせ対応・利用分析', 1,
   '["tenant.support", "analytics.view", "tickets.manage", "health.monitor", "communication.send"]'),
   
  ('role_system_finance_admin', 'system', 'finance_admin', '経理担当者', '請求管理・売上分析・支払い管理・財務レポート', 1,
   '["billing.manage", "revenue.analyze", "payment.manage", "finance.reports"]'),
   
  ('role_system_auditor', 'system', 'auditor', '監査担当者', 'ログ閲覧・監査レポート・コンプライアンス確認（閲覧専用）', 1,
   '["audit.view", "logs.view", "compliance.check", "reports.audit"]');

-- 4. 既存のシステムロールの権限を拡張（要件に合わせて更新）
UPDATE roles 
SET permissions = '["tenant.create", "tenant.update", "tenant.delete", "tenant.cross_tenant_access", "admin.manage", "system.config", "emergency.access", "billing.manage", "security.audit"]'
WHERE id = 'role_system_super_admin';

UPDATE roles 
SET 
    display_name = 'システム管理者',
    description = '技術・インフラ管理専門・パフォーマンス監視・障害対応',
    permissions = '["system.monitor", "system.backup", "system.security", "performance.manage", "infrastructure.manage", "logs.technical"]'
WHERE id = 'role_system_admin';

-- 5. テナント管理者側ロールテンプレート（role-templateテナント使用）
INSERT OR IGNORE INTO roles (id, tenant_id, name, display_name, description, is_system_role, permissions) VALUES 
  ('template-tenant-owner', 'role-template', 'tenant_owner', 'テナントオーナー', 'テナント内最高権限・請求管理・全機能アクセス', 1,
   '["user.create", "user.update", "user.delete", "role.assign", "tenant.config", "billing.view", "analytics.view"]'),
   
  ('template-tenant-admin', 'role-template', 'tenant_admin', 'テナント管理者', 'テナント内管理権限・ユーザー管理・権限設定・部門管理', 1,
   '["user.create", "user.update", "role.assign", "department.manage", "analytics.view"]'),
   
  ('template-user', 'role-template', 'user', '一般ユーザー', '基本業務機能のみ使用可能', 1,
   '["data.read", "data.create", "data.update", "profile.edit"]'),
   
  ('template-guest', 'role-template', 'guest', 'ゲストユーザー', '閲覧専用・制限された機能のみアクセス', 1,
   '["data.read", "profile.view"]');

-- 6. 権限スコープ管理テーブル追加
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

-- 7. システム全体権限の定義
INSERT OR IGNORE INTO permission_scopes (id, scope_type, scope_id, permission, resource_type, resource_pattern, description) VALUES 
  -- スーパー管理者権限
  ('perm-sys-001', 'system', 'system', 'tenant.create', 'tenant', '.*', '全テナント作成権限'),
  ('perm-sys-002', 'system', 'system', 'tenant.update', 'tenant', '.*', '全テナント更新権限'),  
  ('perm-sys-003', 'system', 'system', 'tenant.delete', 'tenant', '.*', '全テナント削除権限'),
  ('perm-sys-004', 'system', 'system', 'tenant.cross_tenant_access', 'user', '.*', 'テナント横断アクセス権限'),
  ('perm-sys-005', 'system', 'system', 'admin.manage', 'user', 'system:.*', 'システム管理者管理権限'),
  ('perm-sys-006', 'system', 'system', 'system.config', 'config', '.*', 'システム全体設定権限'),
  ('perm-sys-007', 'system', 'system', 'emergency.access', '.*', '.*', '緊急対応権限'),
  ('perm-sys-008', 'system', 'system', 'billing.manage', 'billing', '.*', '請求管理権限'),
  ('perm-sys-009', 'system', 'system', 'security.audit', 'audit', '.*', 'セキュリティ監査権限'),
  
  -- システム管理者権限
  ('perm-sys-101', 'system', 'system', 'system.monitor', 'system', '.*', 'システム監視権限'),
  ('perm-sys-102', 'system', 'system', 'system.backup', 'backup', '.*', 'バックアップ管理権限'),
  ('perm-sys-103', 'system', 'system', 'system.security', 'security', '.*', 'セキュリティ管理権限'),
  ('perm-sys-104', 'system', 'system', 'performance.manage', 'performance', '.*', 'パフォーマンス管理権限'),
  ('perm-sys-105', 'system', 'system', 'infrastructure.manage', 'infrastructure', '.*', 'インフラ管理権限'),
  
  -- 運用管理者権限  
  ('perm-sys-201', 'system', 'system', 'operation.daily', 'operation', '.*', '日常運用権限'),
  ('perm-sys-202', 'system', 'system', 'alert.respond', 'alert', '.*', 'アラート対応権限'),
  ('perm-sys-203', 'system', 'system', 'user.support', 'user', 'tenant:.*', 'ユーザーサポート権限'),
  ('perm-sys-204', 'system', 'system', 'reports.create', 'report', '.*', 'レポート作成権限'),
  
  -- カスタマーサクセス権限
  ('perm-sys-301', 'system', 'system', 'tenant.support', 'tenant', '.*', 'テナントサポート権限'),
  ('perm-sys-302', 'system', 'system', 'analytics.view', 'analytics', '.*', '分析閲覧権限'),
  ('perm-sys-303', 'system', 'system', 'tickets.manage', 'ticket', '.*', 'チケット管理権限'),
  ('perm-sys-304', 'system', 'system', 'health.monitor', 'health', '.*', 'ヘルス監視権限'),
  ('perm-sys-305', 'system', 'system', 'communication.send', 'communication', '.*', '通信送信権限'),
  
  -- 経理担当者権限
  ('perm-sys-401', 'system', 'system', 'revenue.analyze', 'revenue', '.*', '売上分析権限'),
  ('perm-sys-402', 'system', 'system', 'payment.manage', 'payment', '.*', '支払い管理権限'),
  ('perm-sys-403', 'system', 'system', 'finance.reports', 'finance', '.*', '財務レポート権限'),
  
  -- 監査担当者権限
  ('perm-sys-501', 'system', 'system', 'audit.view', 'audit', '.*', '監査閲覧権限'),
  ('perm-sys-502', 'system', 'system', 'logs.view', 'logs', '.*', 'ログ閲覧権限'),
  ('perm-sys-503', 'system', 'system', 'compliance.check', 'compliance', '.*', 'コンプライアンス確認権限'),
  ('perm-sys-504', 'system', 'system', 'reports.audit', 'report', 'audit:.*', '監査レポート権限');

-- 8. テナント管理強化テーブル
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

-- 9. クロステナントユーザー管理ビュー（サービス提供者側専用）
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

-- 10. サービス提供者認証情報テーブル（システムユーザー専用認証情報）
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

-- 11. インデックス追加
CREATE INDEX IF NOT EXISTS idx_permission_scopes_scope ON permission_scopes(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_permission_scopes_permission ON permission_scopes(permission);
CREATE INDEX IF NOT EXISTS idx_tenant_management_logs_tenant_id ON tenant_management_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_management_logs_performed_by ON tenant_management_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_tenant_management_logs_action_type ON tenant_management_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_service_provider_auth_user_id ON service_provider_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_service_provider_auth_type ON service_provider_auth(auth_type);

-- 12. 初期サービス提供者認証設定（既存のシステム管理者用）
INSERT OR IGNORE INTO service_provider_auth (id, user_id, auth_type, auth_data) 
SELECT 
  'spa-' || u.id, 
  u.id, 
  'password', 
  '{"algorithm": "bcrypt", "requires_mfa": false, "password_policy": "strong"}'
FROM users u 
WHERE u.tenant_id = 'system';