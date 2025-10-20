-- システム監視機能 - メトリクステーブル
-- 要件定義書 9.3 システム監視画面に基づく実装

-- 1. システムメトリクステーブル
CREATE TABLE IF NOT EXISTS system_metrics (
  id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL,  -- 'cpu', 'memory', 'disk', 'network', 'response_time', 'error_rate', 'uptime'
  service_name TEXT NOT NULL, -- 'api', 'database', 'worker', 'storage', 'overall'
  value REAL NOT NULL,        -- メトリクスの値
  unit TEXT NOT NULL,         -- 'percent', 'milliseconds', 'bytes', 'requests_per_sec'
  status TEXT DEFAULT 'normal', -- 'normal', 'warning', 'critical'
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. システムアラートテーブル
CREATE TABLE IF NOT EXISTS system_alerts (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL,    -- 'performance', 'availability', 'resource', 'error'
  severity TEXT NOT NULL,      -- 'info', 'warning', 'critical'
  service_name TEXT NOT NULL,
  message TEXT NOT NULL,
  metric_type TEXT,
  threshold_value REAL,
  actual_value REAL,
  status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
  acknowledged_by TEXT,         -- ユーザーID
  acknowledged_at DATETIME,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. システムヘルスログテーブル
CREATE TABLE IF NOT EXISTS system_health_logs (
  id TEXT PRIMARY KEY,
  check_type TEXT NOT NULL,     -- 'health_check', 'ping', 'database_query', 'api_response'
  service_name TEXT NOT NULL,
  status TEXT NOT NULL,         -- 'healthy', 'degraded', 'down'
  response_time INTEGER,        -- ミリ秒
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_service ON system_metrics(service_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON system_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_system_metrics_status ON system_metrics(status);

CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_status ON system_alerts(status);
CREATE INDEX IF NOT EXISTS idx_system_alerts_service ON system_alerts(service_name);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_system_health_logs_service ON system_health_logs(service_name);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_status ON system_health_logs(status);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_created_at ON system_health_logs(created_at);

-- ビュー: 最新メトリクス（サービス別・メトリクスタイプ別の最新値）
CREATE VIEW IF NOT EXISTS latest_system_metrics AS
SELECT 
  sm.*
FROM system_metrics sm
INNER JOIN (
  SELECT 
    service_name,
    metric_type,
    MAX(recorded_at) as max_recorded_at
  FROM system_metrics
  GROUP BY service_name, metric_type
) latest ON sm.service_name = latest.service_name 
        AND sm.metric_type = latest.metric_type 
        AND sm.recorded_at = latest.max_recorded_at;

-- ビュー: アクティブアラート
CREATE VIEW IF NOT EXISTS active_system_alerts AS
SELECT 
  *
FROM system_alerts
WHERE status = 'active'
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    WHEN 'info' THEN 3
  END,
  created_at DESC;

-- トリガー: 古いメトリクスデータの自動削除（7日以上前のデータ）
CREATE TRIGGER IF NOT EXISTS cleanup_old_system_metrics
AFTER INSERT ON system_metrics
BEGIN
  DELETE FROM system_metrics 
  WHERE recorded_at < datetime('now', '-7 days');
END;

-- トリガー: 古いヘルスログの自動削除（30日以上前のデータ）
CREATE TRIGGER IF NOT EXISTS cleanup_old_health_logs
AFTER INSERT ON system_health_logs
BEGIN
  DELETE FROM system_health_logs 
  WHERE created_at < datetime('now', '-30 days');
END;
