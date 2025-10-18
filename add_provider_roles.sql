-- サービス提供者専用ロール追加
INSERT OR IGNORE INTO roles (id, tenant_id, name, display_name, description, is_system_role, permissions) VALUES 
  ('role_system_operation_admin', 'system', 'operation_admin', '運用管理者', '日常運用・アラート対応・定型作業・ユーザーサポート', 1,
   '["operation.daily", "alert.respond", "user.support", "reports.create", "logs.operation"]'),
   
  ('role_system_customer_success', 'system', 'customer_success', 'カスタマーサクセス', 'テナントサポート・問い合わせ対応・利用分析', 1,
   '["tenant.support", "analytics.view", "tickets.manage", "health.monitor", "communication.send"]'),
   
  ('role_system_finance_admin', 'system', 'finance_admin', '経理担当者', '請求管理・売上分析・支払い管理・財務レポート', 1,
   '["billing.manage", "revenue.analyze", "payment.manage", "finance.reports"]'),
   
  ('role_system_auditor', 'system', 'auditor', '監査担当者', 'ログ閲覧・監査レポート・コンプライアンス確認（閲覧専用）', 1,
   '["audit.view", "logs.view", "compliance.check", "reports.audit"]');