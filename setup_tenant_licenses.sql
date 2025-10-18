-- 既存テナントのライセンス情報設定

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