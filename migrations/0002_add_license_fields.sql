-- ライセンス管理用のカラムを追加

-- tenantsテーブルにライセンス関連カラムを追加
ALTER TABLE tenants ADD COLUMN max_users INTEGER DEFAULT 100;
ALTER TABLE tenants ADD COLUMN license_type TEXT DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN license_expires_at DATETIME DEFAULT NULL;

-- 既存のテナントのmax_usersを更新
UPDATE tenants SET max_users = 100 WHERE max_users IS NULL;