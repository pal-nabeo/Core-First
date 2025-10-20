-- システム監視テストデータ
-- 現在時刻から過去24時間分のメトリクスデータを生成

-- APIサービスのメトリクス
INSERT INTO system_metrics (id, metric_type, service_name, value, unit, status, recorded_at) VALUES
  ('metric_api_cpu_1', 'cpu', 'api', 45.2, 'percent', 'normal', datetime('now', '-5 minutes')),
  ('metric_api_memory_1', 'memory', 'api', 62.8, 'percent', 'normal', datetime('now', '-5 minutes')),
  ('metric_api_response_1', 'response_time', 'api', 245, 'milliseconds', 'normal', datetime('now', '-5 minutes')),
  ('metric_api_error_1', 'error_rate', 'api', 0.12, 'percent', 'normal', datetime('now', '-5 minutes')),
  
  ('metric_api_cpu_2', 'cpu', 'api', 52.1, 'percent', 'normal', datetime('now', '-10 minutes')),
  ('metric_api_memory_2', 'memory', 'api', 64.3, 'percent', 'normal', datetime('now', '-10 minutes')),
  ('metric_api_response_2', 'response_time', 'api', 312, 'milliseconds', 'normal', datetime('now', '-10 minutes')),
  ('metric_api_error_2', 'error_rate', 'api', 0.18, 'percent', 'normal', datetime('now', '-10 minutes')),
  
  ('metric_api_cpu_3', 'cpu', 'api', 38.7, 'percent', 'normal', datetime('now', '-15 minutes')),
  ('metric_api_memory_3', 'memory', 'api', 61.2, 'percent', 'normal', datetime('now', '-15 minutes')),
  ('metric_api_response_3', 'response_time', 'api', 198, 'milliseconds', 'normal', datetime('now', '-15 minutes')),
  ('metric_api_error_3', 'error_rate', 'api', 0.09, 'percent', 'normal', datetime('now', '-15 minutes'));

-- データベースサービスのメトリクス
INSERT INTO system_metrics (id, metric_type, service_name, value, unit, status, recorded_at) VALUES
  ('metric_db_cpu_1', 'cpu', 'database', 28.5, 'percent', 'normal', datetime('now', '-5 minutes')),
  ('metric_db_memory_1', 'memory', 'database', 71.3, 'percent', 'normal', datetime('now', '-5 minutes')),
  ('metric_db_disk_1', 'disk', 'database', 54.8, 'percent', 'normal', datetime('now', '-5 minutes')),
  ('metric_db_response_1', 'response_time', 'database', 45, 'milliseconds', 'normal', datetime('now', '-5 minutes')),
  
  ('metric_db_cpu_2', 'cpu', 'database', 31.2, 'percent', 'normal', datetime('now', '-10 minutes')),
  ('metric_db_memory_2', 'memory', 'database', 72.1, 'percent', 'normal', datetime('now', '-10 minutes')),
  ('metric_db_disk_2', 'disk', 'database', 54.8, 'percent', 'normal', datetime('now', '-10 minutes')),
  ('metric_db_response_2', 'response_time', 'database', 52, 'milliseconds', 'normal', datetime('now', '-10 minutes'));

-- Workerサービスのメトリクス
INSERT INTO system_metrics (id, metric_type, service_name, value, unit, status, recorded_at) VALUES
  ('metric_worker_cpu_1', 'cpu', 'worker', 15.8, 'percent', 'normal', datetime('now', '-5 minutes')),
  ('metric_worker_memory_1', 'memory', 'worker', 42.3, 'percent', 'normal', datetime('now', '-5 minutes')),
  ('metric_worker_error_1', 'error_rate', 'worker', 0.05, 'percent', 'normal', datetime('now', '-5 minutes')),
  
  ('metric_worker_cpu_2', 'cpu', 'worker', 18.2, 'percent', 'normal', datetime('now', '-10 minutes')),
  ('metric_worker_memory_2', 'memory', 'worker', 44.1, 'percent', 'normal', datetime('now', '-10 minutes')),
  ('metric_worker_error_2', 'error_rate', 'worker', 0.03, 'percent', 'normal', datetime('now', '-10 minutes'));

-- ストレージサービスのメトリクス
INSERT INTO system_metrics (id, metric_type, service_name, value, unit, status, recorded_at) VALUES
  ('metric_storage_disk_1', 'disk', 'storage', 67.4, 'percent', 'warning', datetime('now', '-5 minutes')),
  ('metric_storage_network_1', 'network', 'storage', 145.2, 'mbps', 'normal', datetime('now', '-5 minutes')),
  
  ('metric_storage_disk_2', 'disk', 'storage', 67.3, 'percent', 'warning', datetime('now', '-10 minutes')),
  ('metric_storage_network_2', 'network', 'storage', 132.8, 'mbps', 'normal', datetime('now', '-10 minutes'));

-- 全体（Overall）のメトリクス
INSERT INTO system_metrics (id, metric_type, service_name, value, unit, status, recorded_at) VALUES
  ('metric_overall_uptime_1', 'uptime', 'overall', 99.97, 'percent', 'normal', datetime('now', '-5 minutes')),
  ('metric_overall_response_1', 'response_time', 'overall', 285, 'milliseconds', 'normal', datetime('now', '-5 minutes')),
  ('metric_overall_error_1', 'error_rate', 'overall', 0.11, 'percent', 'normal', datetime('now', '-5 minutes')),
  
  ('metric_overall_uptime_2', 'uptime', 'overall', 99.96, 'percent', 'normal', datetime('now', '-10 minutes')),
  ('metric_overall_response_2', 'response_time', 'overall', 312, 'milliseconds', 'normal', datetime('now', '-10 minutes')),
  ('metric_overall_error_2', 'error_rate', 'overall', 0.14, 'percent', 'normal', datetime('now', '-10 minutes'));

-- アラートデータ
INSERT INTO system_alerts (id, alert_type, severity, service_name, message, metric_type, threshold_value, actual_value, status) VALUES
  ('alert_storage_1', 'resource', 'warning', 'storage', 'ディスク使用率が警告閾値（65%）を超えています', 'disk', 65.0, 67.4, 'active'),
  ('alert_api_2', 'performance', 'info', 'api', 'レスポンス時間が通常より遅くなっています', 'response_time', 300.0, 312.0, 'active'),
  ('alert_db_3', 'resource', 'info', 'database', 'メモリ使用率が70%を超えています', 'memory', 70.0, 72.1, 'acknowledged');

-- ヘルスチェックログ
INSERT INTO system_health_logs (id, check_type, service_name, status, response_time) VALUES
  ('health_api_1', 'health_check', 'api', 'healthy', 42),
  ('health_db_1', 'database_query', 'database', 'healthy', 18),
  ('health_worker_1', 'ping', 'worker', 'healthy', 8),
  ('health_storage_1', 'health_check', 'storage', 'healthy', 25),
  ('health_overall_1', 'api_response', 'overall', 'healthy', 156);
