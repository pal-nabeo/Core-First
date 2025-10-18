-- PAL物流SaaS - テストデータ投入
-- 初期セットアップとデモデータ

-- 最初にシステムテナントを作成
INSERT OR IGNORE INTO tenants (id, name, subdomain, domain_allowlist, plan_id, status, company_type, company_size) VALUES 
  ('system', 'System Tenant', 'system', '[]', 'enterprise', 'active', 'system', 'enterprise');

-- 1. システム標準ロールの作成
INSERT OR IGNORE INTO roles (id, tenant_id, name, display_name, description, is_system_role, permissions) VALUES 
  ('role_system_super_admin', 'system', 'super_admin', 'スーパー管理者', '全権限を持つ最高管理者', 1, '["all"]'),
  ('role_system_admin', 'system', 'admin', '管理者', 'ユーザー管理・基本設定変更権限', 1, '["user_management", "basic_settings", "audit_view"]'),
  ('role_system_site_manager', 'system', 'site_manager', '事業所管理者', '担当事業所内のユーザー管理権限', 1, '["site_user_management"]'),
  ('role_system_user', 'system', 'user', '一般ユーザー', '基本機能の利用権限', 1, '["basic_access"]');

-- 2. デモテナント（物流企業）の作成
INSERT OR IGNORE INTO tenants (id, name, subdomain, domain_allowlist, plan_id, status, company_type, company_size, trial_expires_at) VALUES 
  ('tenant_abc_logistics', 'ABC物流株式会社', 'abc-logistics', '["abc-logistics.co.jp", "abc-transport.com"]', 'standard', 'active', 'general_cargo', 'medium', '2024-12-31 23:59:59'),
  ('tenant_xyz_delivery', 'XYZ配送サービス', 'xyz-delivery', '["xyz-delivery.jp"]', 'free', 'active', 'delivery', 'small', '2024-12-31 23:59:59'),
  ('tenant_demo_company', 'デモ物流企業', 'demo-company', '["demo-logistics.com"]', 'plus', 'active', 'warehouse', 'large', NULL);

-- 3. テナント別ロールの作成
INSERT OR IGNORE INTO roles (id, tenant_id, name, display_name, description, is_system_role, permissions) VALUES 
  -- ABC物流のロール
  ('role_abc_super_admin', 'tenant_abc_logistics', 'super_admin', 'スーパー管理者', 'ABC物流の最高管理者', 0, '["all"]'),
  ('role_abc_admin', 'tenant_abc_logistics', 'admin', '管理者', 'ABC物流の一般管理者', 0, '["user_management", "basic_settings"]'),
  ('role_abc_user', 'tenant_abc_logistics', 'user', '一般ユーザー', 'ABC物流の一般ユーザー', 0, '["basic_access"]'),
  
  -- XYZ配送のロール
  ('role_xyz_super_admin', 'tenant_xyz_delivery', 'super_admin', 'スーパー管理者', 'XYZ配送の最高管理者', 0, '["all"]'),
  ('role_xyz_admin', 'tenant_xyz_delivery', 'admin', '管理者', 'XYZ配送の一般管理者', 0, '["user_management", "basic_settings"]'),
  ('role_xyz_user', 'tenant_xyz_delivery', 'user', '一般ユーザー', 'XYZ配送の一般ユーザー', 0, '["basic_access"]'),
  
  -- デモ企業のロール
  ('role_demo_super_admin', 'tenant_demo_company', 'super_admin', 'スーパー管理者', 'デモ企業の最高管理者', 0, '["all"]'),
  ('role_demo_admin', 'tenant_demo_company', 'admin', '管理者', 'デモ企業の一般管理者', 0, '["user_management", "basic_settings"]'),
  ('role_demo_user', 'tenant_demo_company', 'user', '一般ユーザー', 'デモ企業の一般ユーザー', 0, '["basic_access"]');

-- 4. 事業所・組織階層の作成
INSERT OR IGNORE INTO organization_units (id, tenant_id, name, code, unit_type, parent_id, address, phone, is_active) VALUES 
  -- ABC物流の事業所
  ('org_abc_head_office', 'tenant_abc_logistics', 'ABC物流本社', 'HEAD001', 'head_office', NULL, '東京都港区虎ノ門1-1-1', '03-1234-5678', 1),
  ('org_abc_tokyo_branch', 'tenant_abc_logistics', '東京支店', 'TKY001', 'branch', 'org_abc_head_office', '東京都江東区豊洲2-2-2', '03-2345-6789', 1),
  ('org_abc_osaka_branch', 'tenant_abc_logistics', '大阪支店', 'OSK001', 'branch', 'org_abc_head_office', '大阪府大阪市北区梅田3-3-3', '06-3456-7890', 1),
  ('org_abc_tokyo_warehouse', 'tenant_abc_logistics', '東京配送センター', 'TKYW001', 'warehouse', 'org_abc_tokyo_branch', '東京都江戸川区臨海町4-4-4', '03-4567-8901', 1),
  
  -- XYZ配送の事業所
  ('org_xyz_head_office', 'tenant_xyz_delivery', 'XYZ配送本社', 'XYZ001', 'head_office', NULL, '神奈川県横浜市中区みなとみらい1-1-1', '045-1234-5678', 1),
  ('org_xyz_kanagawa_office', 'tenant_xyz_delivery', '神奈川営業所', 'KNG001', 'office', 'org_xyz_head_office', '神奈川県川崎市川崎区東田町2-2-2', '044-2345-6789', 1),
  
  -- デモ企業の事業所
  ('org_demo_head_office', 'tenant_demo_company', 'デモ本社', 'DEMO001', 'head_office', NULL, '愛知県名古屋市中村区名駅1-1-1', '052-1234-5678', 1);

-- 5. テストユーザーの作成
-- パスワードは全て "password123" のbcryptハッシュ: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewMLaACl3PGec4Zy
INSERT OR IGNORE INTO users (id, tenant_id, email, display_name, hashed_password, password_algo, status, email_verified, created_at) VALUES 
  -- システム統合管理者
  ('user_system_admin', 'system', 'system@corefirst.com', 'システム統合管理者', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewMLaACl3PGec4Zy', 'bcrypt', 'active', 1, '2024-01-01 09:00:00'),
  
  -- ABC物流のユーザー
  ('user_abc_admin', 'tenant_abc_logistics', 'admin@abc-logistics.co.jp', '田中 太郎', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewMLaACl3PGec4Zy', 'bcrypt', 'active', 1, '2024-01-01 10:00:00'),
  ('user_abc_manager', 'tenant_abc_logistics', 'manager@abc-logistics.co.jp', '佐藤 花子', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewMLaACl3PGec4Zy', 'bcrypt', 'active', 1, '2024-01-02 11:00:00'),
  ('user_abc_staff1', 'tenant_abc_logistics', 'staff1@abc-logistics.co.jp', '鈴木 次郎', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewMLaACl3PGec4Zy', 'bcrypt', 'active', 1, '2024-01-03 12:00:00'),
  
  -- XYZ配送のユーザー
  ('user_xyz_admin', 'tenant_xyz_delivery', 'admin@xyz-delivery.jp', '山田 一郎', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewMLaACl3PGec4Zy', 'bcrypt', 'active', 1, '2024-01-01 10:00:00'),
  ('user_xyz_driver1', 'tenant_xyz_delivery', 'driver1@xyz-delivery.jp', '高橋 三郎', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewMLaACl3PGec4Zy', 'bcrypt', 'active', 1, '2024-01-04 13:00:00'),
  
  -- デモ企業のユーザー
  ('user_demo_admin', 'tenant_demo_company', 'admin@demo-logistics.com', 'デモ管理者', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewMLaACl3PGec4Zy', 'bcrypt', 'active', 1, '2024-01-01 10:00:00'),
  ('user_demo_user1', 'tenant_demo_company', 'user1@demo-logistics.com', 'デモユーザー1', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewMLaACl3PGec4Zy', 'bcrypt', 'active', 1, '2024-01-05 14:00:00');

-- 6. ユーザーロール割り当て
INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope, assigned_by, assigned_at) VALUES 
  -- システム統合管理者のロール割り当て
  ('ur_system_admin_super', 'user_system_admin', 'role_system_super_admin', 'system', NULL, '2024-01-01 09:00:00'),
  
  -- ABC物流のロール割り当て
  ('ur_abc_admin_super', 'user_abc_admin', 'role_abc_super_admin', 'tenant', NULL, '2024-01-01 10:00:00'),
  ('ur_abc_manager_admin', 'user_abc_manager', 'role_abc_admin', 'tenant', 'user_abc_admin', '2024-01-02 11:00:00'),
  ('ur_abc_staff1_user', 'user_abc_staff1', 'role_abc_user', 'tenant', 'user_abc_admin', '2024-01-03 12:00:00'),
  
  -- XYZ配送のロール割り当て
  ('ur_xyz_admin_super', 'user_xyz_admin', 'role_xyz_super_admin', 'tenant', NULL, '2024-01-01 10:00:00'),
  ('ur_xyz_driver1_user', 'user_xyz_driver1', 'role_xyz_user', 'tenant', 'user_xyz_admin', '2024-01-04 13:00:00'),
  
  -- デモ企業のロール割り当て
  ('ur_demo_admin_super', 'user_demo_admin', 'role_demo_super_admin', 'tenant', NULL, '2024-01-01 10:00:00'),
  ('ur_demo_user1_user', 'user_demo_user1', 'role_demo_user', 'tenant', 'user_demo_admin', '2024-01-05 14:00:00');

-- 7. サンプル招待レコード（期限切れも含む）
INSERT OR IGNORE INTO invitations (id, tenant_id, inviter_id, email, role_id, token, expires_at, status, invitation_message) VALUES 
  ('inv_abc_newuser', 'tenant_abc_logistics', 'user_abc_admin', 'newuser@abc-logistics.co.jp', 'role_abc_user', 'token_abc_newuser_123', '2024-12-31 23:59:59', 'pending', 'ABC物流へようこそ！'),
  ('inv_xyz_expired', 'tenant_xyz_delivery', 'user_xyz_admin', 'expired@xyz-delivery.jp', 'role_xyz_user', 'token_xyz_expired_456', '2024-01-01 00:00:00', 'expired', '期限切れ招待のテスト');

-- 8. 監査ログのサンプル
INSERT OR IGNORE INTO audit_logs (id, tenant_id, actor_user_id, action_type, target_type, target_id, ip_address, result, created_at) VALUES 
  ('audit_001', 'tenant_abc_logistics', 'user_abc_admin', 'user_login', 'user', 'user_abc_admin', '192.168.1.100', 'success', '2024-01-01 10:00:00'),
  ('audit_002', 'tenant_abc_logistics', 'user_abc_admin', 'user_create', 'user', 'user_abc_staff1', '192.168.1.100', 'success', '2024-01-03 12:00:00'),
  ('audit_003', 'tenant_xyz_delivery', 'user_xyz_admin', 'user_login', 'user', 'user_xyz_admin', '10.0.1.50', 'success', '2024-01-01 10:00:00');

-- 9. IP許可リストのサンプル
INSERT OR IGNORE INTO ip_allowlists (id, tenant_id, cidr_range, description, is_active, created_by) VALUES 
  ('ip_abc_office', 'tenant_abc_logistics', '192.168.1.0/24', 'ABC物流本社ネットワーク', 1, 'user_abc_admin'),
  ('ip_abc_branch', 'tenant_abc_logistics', '192.168.2.0/24', 'ABC物流支店ネットワーク', 1, 'user_abc_admin'),
  ('ip_xyz_office', 'tenant_xyz_delivery', '10.0.1.0/24', 'XYZ配送本社ネットワーク', 1, 'user_xyz_admin');