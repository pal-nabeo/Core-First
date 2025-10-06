-- テストデータ挿入用SQL

-- テナントデータ
INSERT OR IGNORE INTO tenants (id, subdomain, name, domain_allowlist, max_users, license_type, status)
VALUES 
  ('1', 'test-company', 'テスト企業株式会社', '["test.com", "example.com"]', 100, 'trial', 'active');

-- 役割データ
INSERT OR IGNORE INTO roles (id, tenant_id, name, display_name, description, is_system_role)
VALUES 
  ('1', '1', 'super_admin', 'スーパー管理者', '全ての権限を持つ管理者', 1),
  ('2', '1', 'admin', '管理者', 'テナント管理権限を持つ管理者', 1),
  ('3', '1', 'site_manager', 'サイト管理者', 'サイト管理権限を持つユーザー', 1),
  ('4', '1', 'user', '一般ユーザー', '基本的な機能のみ利用できるユーザー', 1);

-- テストユーザー（パスワードは 'password123' のハッシュ）
INSERT OR IGNORE INTO users (id, tenant_id, email, display_name, hashed_password, password_algo, status)
VALUES 
  ('1', '1', 'admin@test.com', '管理者ユーザー', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'bcrypt', 'active'),
  ('2', '1', 'user1@test.com', 'テストユーザー1', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'bcrypt', 'active'),
  ('3', '1', 'user2@test.com', 'テストユーザー2', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'bcrypt', 'inactive');

-- ユーザー権限
INSERT OR IGNORE INTO user_roles (user_id, role_id)
VALUES 
  ('1', '1'),
  ('2', '4'),
  ('3', '4');

-- テスト用監査ログ
INSERT OR IGNORE INTO audit_logs (actor_user_id, tenant_id, action_type, target_type, target_id, ip_address, user_agent, result)
VALUES 
  ('1', '1', 'login', 'user', '1', '192.168.1.100', 'Mozilla/5.0...', 'success'),
  ('2', '1', 'login', 'user', '2', '192.168.1.101', 'Mozilla/5.0...', 'success'),
  ('1', '1', 'user_created', 'user', '3', '192.168.1.100', 'Mozilla/5.0...', 'success');