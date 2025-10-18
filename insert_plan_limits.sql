-- プラン制限の初期データ挿入

-- Free プラン
INSERT OR IGNORE INTO plan_limits (id, plan_type, limit_type, limit_value, period, description) VALUES 
('pl-free-users', 'free', 'users', 10, 'total', 'ユーザー数上限'),
('pl-free-storage', 'free', 'storage_gb', 1, 'total', 'ストレージ容量上限'),
('pl-free-api', 'free', 'api_calls', 0, 'monthly', 'API呼び出し上限（無し）'),
('pl-free-locations', 'free', 'locations', 1, 'total', '事業所数上限');

-- Standard プラン
INSERT OR IGNORE INTO plan_limits (id, plan_type, limit_type, limit_value, period, description) VALUES 
('pl-std-users', 'standard', 'users', 50, 'total', 'ユーザー数上限'),
('pl-std-storage', 'standard', 'storage_gb', 50, 'total', 'ストレージ容量上限'),
('pl-std-api', 'standard', 'api_calls', 1000, 'monthly', 'API呼び出し上限'),
('pl-std-locations', 'standard', 'locations', 5, 'total', '事業所数上限');

-- Plus プラン
INSERT OR IGNORE INTO plan_limits (id, plan_type, limit_type, limit_value, period, description) VALUES 
('pl-plus-users', 'plus', 'users', 200, 'total', 'ユーザー数上限'),
('pl-plus-storage', 'plus', 'storage_gb', 500, 'total', 'ストレージ容量上限'),
('pl-plus-api', 'plus', 'api_calls', 10000, 'monthly', 'API呼び出し上限'),
('pl-plus-locations', 'plus', 'locations', 20, 'total', '事業所数上限');

-- Pro プラン
INSERT OR IGNORE INTO plan_limits (id, plan_type, limit_type, limit_value, period, description) VALUES 
('pl-pro-users', 'pro', 'users', -1, 'total', 'ユーザー数無制限'),
('pl-pro-storage', 'pro', 'storage_gb', -1, 'total', 'ストレージ容量無制限'),
('pl-pro-api', 'pro', 'api_calls', -1, 'monthly', 'API呼び出し無制限'),
('pl-pro-locations', 'pro', 'locations', -1, 'total', '事業所数無制限');