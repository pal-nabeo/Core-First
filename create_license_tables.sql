-- Core First ライセンス管理機能の基本テーブル作成

-- 1. テナントライセンステーブル
CREATE TABLE IF NOT EXISTS tenant_licenses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at DATETIME NOT NULL,
  expires_at DATETIME,
  auto_renew INTEGER DEFAULT 1,
  billing_cycle TEXT DEFAULT 'monthly',
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 2. プラン制限定義テーブル
CREATE TABLE IF NOT EXISTS plan_limits (
  id TEXT PRIMARY KEY,
  plan_type TEXT NOT NULL,
  limit_type TEXT NOT NULL,
  limit_value INTEGER NOT NULL,
  period TEXT DEFAULT 'monthly',
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_type, limit_type, period)
);

-- 3. 使用量メトリクステーブル
CREATE TABLE IF NOT EXISTS usage_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  metadata TEXT,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_tenant_licenses_tenant_id ON tenant_licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_licenses_status ON tenant_licenses(status);
CREATE INDEX IF NOT EXISTS idx_plan_limits_plan_type ON plan_limits(plan_type);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_tenant_id ON usage_metrics(tenant_id);