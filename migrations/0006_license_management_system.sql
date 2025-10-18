-- Core First ライセンス管理機能 要件定義書準拠のテーブル作成
-- 要件定義書v2.0に基づく包括的なライセンス管理システム実装

-- 1. テナントライセンステーブル
CREATE TABLE IF NOT EXISTS tenant_licenses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_type TEXT NOT NULL, -- 'free', 'standard', 'plus', 'pro', 'enterprise'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'suspended', 'cancelled'
  started_at DATETIME NOT NULL,
  expires_at DATETIME,
  auto_renew INTEGER DEFAULT 1, -- 0: 無効, 1: 有効
  billing_cycle TEXT DEFAULT 'monthly', -- 'monthly', 'yearly', 'custom'
  metadata TEXT, -- プラン特定の設定（JSON）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 2. プラン制限定義テーブル
CREATE TABLE IF NOT EXISTS plan_limits (
  id TEXT PRIMARY KEY,
  plan_type TEXT NOT NULL, -- 'free', 'standard', 'plus', 'pro', 'enterprise'
  limit_type TEXT NOT NULL, -- 'users', 'storage_gb', 'api_calls', 'locations', 'data_processing_gb', 'mapping_templates', 'concurrent_sessions'
  limit_value INTEGER NOT NULL, -- 制限値（-1は無制限）
  period TEXT DEFAULT 'monthly', -- 'daily', 'monthly', 'total'
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_type, limit_type, period)
);

-- 3. 使用量メトリクステーブル
CREATE TABLE IF NOT EXISTS usage_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- 'api_calls', 'storage_gb', 'data_processing_gb', 'active_users', 'mapping_executions', 'concurrent_sessions'
  value INTEGER NOT NULL DEFAULT 0,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  metadata TEXT, -- 追加メタデータ（JSON）
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 4. 請求履歴テーブル
CREATE TABLE IF NOT EXISTS billing_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'JPY',
  billing_period_start DATETIME NOT NULL,
  billing_period_end DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
  payment_method TEXT, -- 'stripe', 'bank_transfer', 'paypal'
  stripe_invoice_id TEXT,
  invoice_pdf_url TEXT,
  tax_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  metadata TEXT, -- 請求詳細（JSON）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 5. 使用量アラートテーブル
CREATE TABLE IF NOT EXISTS usage_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  threshold_percentage INTEGER NOT NULL, -- 70, 85, 95, 100
  alert_level TEXT NOT NULL, -- 'info', 'warning', 'critical', 'emergency'
  notification_channels TEXT NOT NULL, -- JSON配列: ["email", "dashboard", "slack", "sms", "phone"]
  is_active INTEGER DEFAULT 1,
  last_triggered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, metric_type, threshold_percentage)
);

-- 6. 支払い方法テーブル
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  method_type TEXT NOT NULL, -- 'stripe', 'bank_transfer', 'paypal'
  is_default INTEGER DEFAULT 0,
  stripe_payment_method_id TEXT,
  last_four_digits TEXT,
  card_brand TEXT,
  expires_at DATETIME,
  metadata TEXT, -- 支払い方法詳細（JSON）
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 7. ライセンスチェックログテーブル（パフォーマンス監視・デバッグ用）
CREATE TABLE IF NOT EXISTS license_check_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  check_type TEXT NOT NULL, -- 'feature_access', 'usage_limit', 'api_quota'
  feature_name TEXT,
  result TEXT NOT NULL, -- 'allowed', 'denied', 'warning'
  reason TEXT,
  current_usage INTEGER,
  limit_value INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 8. プラン変更履歴テーブル
CREATE TABLE IF NOT EXISTS plan_change_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  from_plan TEXT,
  to_plan TEXT NOT NULL,
  change_type TEXT NOT NULL, -- 'upgrade', 'downgrade', 'renewal', 'cancellation'
  effective_date DATETIME NOT NULL,
  reason TEXT,
  performed_by TEXT, -- ユーザーIDまたはシステム
  approval_required INTEGER DEFAULT 0,
  approved_by TEXT,
  approved_at DATETIME,
  metadata TEXT, -- 変更詳細（JSON）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- インデックス作成（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_tenant_licenses_tenant_id ON tenant_licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_licenses_status ON tenant_licenses(status);
CREATE INDEX IF NOT EXISTS idx_tenant_licenses_expires_at ON tenant_licenses(expires_at);

CREATE INDEX IF NOT EXISTS idx_plan_limits_plan_type ON plan_limits(plan_type);
CREATE INDEX IF NOT EXISTS idx_plan_limits_limit_type ON plan_limits(limit_type);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_tenant_id ON usage_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_metric_type ON usage_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_period ON usage_metrics(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_billing_history_tenant_id ON billing_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_status ON billing_history(status);
CREATE INDEX IF NOT EXISTS idx_billing_history_period ON billing_history(billing_period_start, billing_period_end);

CREATE INDEX IF NOT EXISTS idx_usage_alerts_tenant_id ON usage_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_alerts_metric_type ON usage_alerts(metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_alerts_active ON usage_alerts(is_active);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_id ON payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(tenant_id, is_default);

CREATE INDEX IF NOT EXISTS idx_license_check_logs_tenant_id ON license_check_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_license_check_logs_created_at ON license_check_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_plan_change_history_tenant_id ON plan_change_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plan_change_history_effective_date ON plan_change_history(effective_date);

-- 初期プラン制限データの挿入
INSERT OR IGNORE INTO plan_limits (id, plan_type, limit_type, limit_value, period, description) VALUES 
-- Free プラン
('pl-free-users', 'free', 'users', 10, 'total', 'ユーザー数上限'),
('pl-free-storage', 'free', 'storage_gb', 1, 'total', 'ストレージ容量上限'),
('pl-free-api', 'free', 'api_calls', 0, 'monthly', 'API呼び出し上限（無し）'),
('pl-free-locations', 'free', 'locations', 1, 'total', '事業所数上限'),
('pl-free-concurrent', 'free', 'concurrent_sessions', 3, 'total', '同時接続数上限'),

-- Standard プラン
('pl-std-users', 'standard', 'users', 50, 'total', 'ユーザー数上限'),
('pl-std-storage', 'standard', 'storage_gb', 50, 'total', 'ストレージ容量上限'),
('pl-std-api', 'standard', 'api_calls', 1000, 'monthly', 'API呼び出し上限'),
('pl-std-locations', 'standard', 'locations', 5, 'total', '事業所数上限'),
('pl-std-concurrent', 'standard', 'concurrent_sessions', 10, 'total', '同時接続数上限'),
('pl-std-mapping', 'standard', 'mapping_templates', 10, 'total', 'マッピングテンプレート上限'),

-- Plus プラン
('pl-plus-users', 'plus', 'users', 200, 'total', 'ユーザー数上限'),
('pl-plus-storage', 'plus', 'storage_gb', 500, 'total', 'ストレージ容量上限'),
('pl-plus-api', 'plus', 'api_calls', 10000, 'monthly', 'API呼び出し上限'),
('pl-plus-locations', 'plus', 'locations', 20, 'total', '事業所数上限'),
('pl-plus-concurrent', 'plus', 'concurrent_sessions', 50, 'total', '同時接続数上限'),
('pl-plus-mapping', 'plus', 'mapping_templates', 50, 'total', 'マッピングテンプレート上限'),
('pl-plus-processing', 'plus', 'data_processing_gb', 100, 'monthly', 'データ処理容量上限'),

-- Pro プラン
('pl-pro-users', 'pro', 'users', -1, 'total', 'ユーザー数無制限'),
('pl-pro-storage', 'pro', 'storage_gb', -1, 'total', 'ストレージ容量無制限'),
('pl-pro-api', 'pro', 'api_calls', -1, 'monthly', 'API呼び出し無制限'),
('pl-pro-locations', 'pro', 'locations', -1, 'total', '事業所数無制限'),
('pl-pro-concurrent', 'pro', 'concurrent_sessions', 200, 'total', '同時接続数上限'),
('pl-pro-mapping', 'pro', 'mapping_templates', -1, 'total', 'マッピングテンプレート無制限'),
('pl-pro-processing', 'pro', 'data_processing_gb', -1, 'monthly', 'データ処理容量無制限'),

-- Enterprise プラン（カスタム設定）
('pl-ent-users', 'enterprise', 'users', -1, 'total', 'ユーザー数無制限'),
('pl-ent-storage', 'enterprise', 'storage_gb', -1, 'total', 'ストレージ容量無制限'),
('pl-ent-api', 'enterprise', 'api_calls', -1, 'monthly', 'API呼び出し無制限'),
('pl-ent-locations', 'enterprise', 'locations', -1, 'total', '事業所数無制限'),
('pl-ent-concurrent', 'enterprise', 'concurrent_sessions', -1, 'total', '同時接続数無制限'),
('pl-ent-mapping', 'enterprise', 'mapping_templates', -1, 'total', 'マッピングテンプレート無制限'),
('pl-ent-processing', 'enterprise', 'data_processing_gb', -1, 'monthly', 'データ処理容量無制限');

-- 初期テナントライセンス設定（既存テナント用）
INSERT OR IGNORE INTO tenant_licenses (id, tenant_id, plan_type, status, started_at, expires_at, auto_renew) 
SELECT 
  'tl-' || t.id,
  t.id,
  CASE 
    WHEN t.plan_id = 'free' THEN 'free'
    WHEN t.plan_id = 'standard' THEN 'standard'
    WHEN t.plan_id = 'plus' THEN 'plus'
    WHEN t.plan_id = 'pro' THEN 'pro'
    WHEN t.plan_id = 'enterprise' THEN 'enterprise'
    ELSE 'free'
  END,
  'active',
  COALESCE(t.plan_started_at, t.created_at),
  t.plan_expires_at,
  1
FROM tenants t 
WHERE t.id NOT IN ('system', 'role-template');

-- 使用量アラート初期設定（全テナント共通）
INSERT OR IGNORE INTO usage_alerts (id, tenant_id, metric_type, threshold_percentage, alert_level, notification_channels) 
SELECT 
  'ua-' || t.id || '-' || m.metric_type || '-' || th.threshold,
  t.id,
  m.metric_type,
  th.threshold,
  th.alert_level,
  '["email", "dashboard"]'
FROM tenants t
CROSS JOIN (
  VALUES 
    ('users'), ('storage_gb'), ('api_calls'), ('data_processing_gb')
) AS m(metric_type)
CROSS JOIN (
  VALUES 
    (70, 'info'),
    (85, 'warning'), 
    (95, 'critical'),
    (100, 'emergency')
) AS th(threshold, alert_level)
WHERE t.id NOT IN ('system', 'role-template');