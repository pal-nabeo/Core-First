-- サービス提供者ドメインを pal-style.co.jp に変更
-- システム管理者のドメインを Core First から PAL Style に統一

-- 1. systemテナントのsubdomainを更新
UPDATE tenants 
SET 
  subdomain = 'pal-style',
  name = 'PAL Style サービス提供者'
WHERE id = 'system';

-- 2. システム管理者ユーザーのメールアドレスドメインを更新
UPDATE users 
SET 
  email = REPLACE(email, '@corefirst.com', '@pal-style.co.jp')
WHERE tenant_id = 'system' AND email LIKE '%@corefirst.com';

-- 3. 既存のシステム管理者のメールアドレスを確認・更新（seed.sqlから作成されたユーザー）
UPDATE users
SET email = 'system@pal-style.co.jp'
WHERE id = 'user_system_admin' AND tenant_id = 'system';
