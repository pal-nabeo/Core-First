-- システム全体権限の定義
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

-- 既存のシステムロールの権限を拡張（要件に合わせて更新）
UPDATE roles 
SET permissions = '["tenant.create", "tenant.update", "tenant.delete", "tenant.cross_tenant_access", "admin.manage", "system.config", "emergency.access", "billing.manage", "security.audit"]'
WHERE id = 'role_system_super_admin';

UPDATE roles 
SET 
    display_name = 'システム管理者',
    description = '技術・インフラ管理専門・パフォーマンス監視・障害対応',
    permissions = '["system.monitor", "system.backup", "system.security", "performance.manage", "infrastructure.manage", "logs.technical"]'
WHERE id = 'role_system_admin';

-- 初期サービス提供者認証設定（既存のシステム管理者用）
INSERT OR IGNORE INTO service_provider_auth (id, user_id, auth_type, auth_data) 
SELECT 
  'spa-' || u.id, 
  u.id, 
  'password', 
  '{"algorithm": "bcrypt", "requires_mfa": false, "password_policy": "strong"}'
FROM users u 
WHERE u.tenant_id = 'system';