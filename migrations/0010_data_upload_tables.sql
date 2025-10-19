-- データアップロード・マッピング機能用テーブル
-- 要件定義書「3.2 CLO向けサイト機能 - データアップロード・マッピング機能」に基づく実装

-- 1. データアップロード履歴テーブル
CREATE TABLE IF NOT EXISTS data_uploads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL, -- ユーザーID
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL, -- バイト単位
  file_type TEXT NOT NULL, -- 'csv', 'excel', 'json', 'xml', 'pdf', 'image'
  mime_type TEXT,
  storage_path TEXT NOT NULL, -- R2/ストレージパス
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0, -- 0-100
  total_records INTEGER,
  processed_records INTEGER DEFAULT 0,
  error_records INTEGER DEFAULT 0,
  error_details TEXT, -- JSON: エラー詳細
  template_id TEXT, -- 使用したテンプレートID
  mapping_config TEXT, -- JSON: マッピング設定
  validation_result TEXT, -- JSON: バリデーション結果
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (template_id) REFERENCES mapping_templates(id) ON DELETE SET NULL
);

-- 2. マッピングテンプレートテーブル
CREATE TABLE IF NOT EXISTS mapping_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT, -- NULLの場合はグローバルテンプレート
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'delivery', 'inventory', 'customer', 'custom'
  is_global INTEGER DEFAULT 0, -- 0: テナント専用, 1: グローバル（サービス提供者提供）
  is_active INTEGER DEFAULT 1,
  template_version TEXT DEFAULT '1.0',
  field_mappings TEXT NOT NULL, -- JSON: フィールドマッピング定義
  validation_rules TEXT, -- JSON: バリデーションルール
  sample_data TEXT, -- JSON: サンプルデータ
  usage_count INTEGER DEFAULT 0, -- 使用回数
  created_by TEXT, -- 作成者ユーザーID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. マッピングテンプレートフィールド定義テーブル
CREATE TABLE IF NOT EXISTS template_fields (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  field_name TEXT NOT NULL, -- フィールド名
  display_name TEXT NOT NULL, -- 表示名（日本語）
  field_type TEXT NOT NULL, -- 'string', 'number', 'date', 'boolean', 'json'
  is_required INTEGER DEFAULT 0,
  default_value TEXT,
  validation_pattern TEXT, -- 正規表現パターン
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES mapping_templates(id) ON DELETE CASCADE,
  UNIQUE(template_id, field_name)
);

-- 4. AI分析結果テーブル
CREATE TABLE IF NOT EXISTS ai_analysis_results (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  upload_id TEXT, -- 関連するアップロードID
  analysis_type TEXT NOT NULL, -- 'loading_efficiency', 'warehouse_optimization', 'waiting_time', 'route_optimization', 'demand_forecast'
  analysis_category TEXT NOT NULL, -- 'delivery', 'inventory', 'route', 'forecast'
  requested_by TEXT NOT NULL, -- リクエストユーザーID
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0,
  input_data TEXT, -- JSON: 入力データ
  result_data TEXT, -- JSON: 分析結果
  insights TEXT, -- JSON: インサイト・提案
  confidence_score REAL, -- 信頼度スコア（0.0-1.0）
  execution_time_ms INTEGER, -- 実行時間（ミリ秒）
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (upload_id) REFERENCES data_uploads(id) ON DELETE SET NULL,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. チャット履歴テーブル
CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL, -- チャットセッションID
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  message TEXT NOT NULL,
  context_data TEXT, -- JSON: コンテキストデータ（参照データなど）
  tokens_used INTEGER, -- 使用トークン数
  response_time_ms INTEGER, -- レスポンス時間
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. レポートテーブル
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- 'auto', 'custom', 'scheduled'
  category TEXT, -- 'executive', 'operational', 'analytical'
  template_id TEXT, -- レポートテンプレートID
  analysis_ids TEXT, -- JSON: 関連するAI分析結果ID
  content TEXT, -- JSON: レポート内容
  format TEXT DEFAULT 'json', -- 'json', 'pdf', 'excel'
  is_scheduled INTEGER DEFAULT 0,
  schedule_config TEXT, -- JSON: スケジュール設定
  share_config TEXT, -- JSON: 共有設定
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_generated_at DATETIME,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 7. レポート配信履歴テーブル
CREATE TABLE IF NOT EXISTS report_deliveries (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  delivered_to TEXT NOT NULL, -- メールアドレスまたはユーザーID
  delivery_method TEXT NOT NULL, -- 'email', 'download', 'api'
  status TEXT NOT NULL, -- 'pending', 'sent', 'failed'
  error_message TEXT,
  delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_data_uploads_tenant ON data_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_uploads_status ON data_uploads(status);
CREATE INDEX IF NOT EXISTS idx_data_uploads_uploaded_by ON data_uploads(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_mapping_templates_tenant ON mapping_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_category ON mapping_templates(category);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_global ON mapping_templates(is_global);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_tenant ON ai_analysis_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_type ON ai_analysis_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_status ON ai_analysis_results(status);

CREATE INDEX IF NOT EXISTS idx_chat_history_tenant ON chat_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id);

CREATE INDEX IF NOT EXISTS idx_reports_tenant ON reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);

-- グローバルテンプレートの初期データ
INSERT OR IGNORE INTO mapping_templates (id, tenant_id, name, description, category, is_global, field_mappings, validation_rules) VALUES 
  ('global-template-delivery', NULL, '配送データ標準テンプレート', 'Core First提供の配送データ標準テンプレート', 'delivery', 1,
   '{"delivery_date":"配送日","delivery_time":"配送時刻","origin":"発地","destination":"着地","weight":"重量","volume":"容積","driver":"ドライバー"}',
   '{"delivery_date":{"required":true,"type":"date"},"weight":{"required":true,"type":"number","min":0}}'),
   
  ('global-template-inventory', NULL, '在庫データ標準テンプレート', 'Core First提供の在庫データ標準テンプレート', 'inventory', 1,
   '{"product_code":"商品コード","product_name":"商品名","quantity":"数量","location":"保管場所","last_updated":"最終更新日"}',
   '{"product_code":{"required":true,"type":"string"},"quantity":{"required":true,"type":"number","min":0}}'),
   
  ('global-template-customer', NULL, '顧客マスタ標準テンプレート', 'Core First提供の顧客マスタ標準テンプレート', 'customer', 1,
   '{"customer_code":"顧客コード","customer_name":"顧客名","address":"住所","phone":"電話番号","email":"メールアドレス"}',
   '{"customer_code":{"required":true,"type":"string"},"customer_name":{"required":true,"type":"string"}}');
