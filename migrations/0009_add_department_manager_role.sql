-- 部門管理者ロールの追加
-- 要件定義書「3.3 テナント内ユーザー権限管理」に基づく実装

-- 1. role-template テナントに部門管理者ロールを追加
INSERT OR IGNORE INTO roles (id, tenant_id, name, display_name, description, is_system_role, permissions) VALUES 
  ('template-department-manager', 'role-template', 'department_manager', '部門管理者', 
   '部門・支店・営業所単位での管理権限。担当部門内ユーザーのみ管理可能、部門データ管理。他部門への影響なし、全社設定変更不可。', 1,
   '["user.view_department", "user.create_department", "user.update_department", "user.delete_department", "data.view_department", "data.create_department", "data.update_department", "data.delete_department", "report.view_department", "report.create_department", "organization_unit.view_department"]');

-- 2. permission_scopes テーブルに部門管理者用の権限スコープを追加
INSERT OR IGNORE INTO permission_scopes (id, scope_type, scope_id, permission, resource_type, resource_pattern, description) VALUES 
  -- 部門管理者権限
  ('perm-dept-001', 'organization_unit', '*', 'user.view_department', 'user', 'department:.*', '部門内ユーザー閲覧権限'),
  ('perm-dept-002', 'organization_unit', '*', 'user.create_department', 'user', 'department:.*', '部門内ユーザー作成権限'),
  ('perm-dept-003', 'organization_unit', '*', 'user.update_department', 'user', 'department:.*', '部門内ユーザー更新権限'),
  ('perm-dept-004', 'organization_unit', '*', 'user.delete_department', 'user', 'department:.*', '部門内ユーザー削除権限'),
  ('perm-dept-005', 'organization_unit', '*', 'data.view_department', 'data', 'department:.*', '部門内データ閲覧権限'),
  ('perm-dept-006', 'organization_unit', '*', 'data.create_department', 'data', 'department:.*', '部門内データ作成権限'),
  ('perm-dept-007', 'organization_unit', '*', 'data.update_department', 'data', 'department:.*', '部門内データ更新権限'),
  ('perm-dept-008', 'organization_unit', '*', 'data.delete_department', 'data', 'department:.*', '部門内データ削除権限'),
  ('perm-dept-009', 'organization_unit', '*', 'report.view_department', 'report', 'department:.*', '部門内レポート閲覧権限'),
  ('perm-dept-010', 'organization_unit', '*', 'report.create_department', 'report', 'department:.*', '部門内レポート作成権限'),
  ('perm-dept-011', 'organization_unit', '*', 'organization_unit.view_department', 'organization_unit', 'department:.*', '部門情報閲覧権限');

-- 3. 権限階層の明確化のためのコメント
-- 
-- テナント内権限階層（上位から下位）:
-- 1. テナント管理者（スーパー管理者） - template-tenant-owner
--    → テナント内全権限、他管理者の任命・解任、プラン変更・課金管理
-- 
-- 2. テナント副管理者（管理者） - template-tenant-admin  
--    → テナント内ユーザー管理、基本設定変更、データ管理
-- 
-- 3. 部門管理者 - template-department-manager （本マイグレーションで追加）
--    → 部門・支店・営業所単位での管理権限
-- 
-- 4. 一般ユーザー - template-user
--    → CLO向けサイト基本機能利用のみ
-- 
-- 5. ゲストユーザー - template-guest
--    → 閲覧専用・制限された機能のみアクセス
