-- テナントテーブルにプラン管理用のカラムを追加

-- プラン開始日
ALTER TABLE tenants ADD COLUMN plan_started_at DATETIME DEFAULT NULL;

-- プラン有効期限
ALTER TABLE tenants ADD COLUMN plan_expires_at DATETIME DEFAULT NULL;

-- 既存テナントのプラン開始日を作成日に設定
UPDATE tenants SET plan_started_at = created_at WHERE plan_started_at IS NULL;

-- フリープランテナントの有効期限を30日後に設定
UPDATE tenants 
SET plan_expires_at = datetime(created_at, '+30 days') 
WHERE plan_id = 'free' AND plan_expires_at IS NULL;