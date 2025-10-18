-- テナント管理者側ロールテンプレート追加
INSERT OR IGNORE INTO roles (id, tenant_id, name, display_name, description, is_system_role, permissions) VALUES 
  ('template-tenant-owner', 'role-template', 'tenant_owner', 'テナントオーナー', 'テナント内最高権限・請求管理・全機能アクセス', 1,
   '["user.create", "user.update", "user.delete", "role.assign", "tenant.config", "billing.view", "analytics.view"]'),
   
  ('template-tenant-admin', 'role-template', 'tenant_admin', 'テナント管理者', 'テナント内管理権限・ユーザー管理・権限設定・部門管理', 1,
   '["user.create", "user.update", "role.assign", "department.manage", "analytics.view"]'),
   
  ('template-user', 'role-template', 'user', '一般ユーザー', '基本業務機能のみ使用可能', 1,
   '["data.read", "data.create", "data.update", "profile.edit"]'),
   
  ('template-guest', 'role-template', 'guest', 'ゲストユーザー', '閲覧専用・制限された機能のみアクセス', 1,
   '["data.read", "profile.view"]');