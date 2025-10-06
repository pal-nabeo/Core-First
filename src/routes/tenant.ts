// PAL物流SaaS テナント情報API ルート
import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const tenant = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * 現在のテナント情報取得
 * GET /api/tenant/info
 */
tenant.get('/info', async (c) => {
  try {
    const tenantSubdomain = c.get('tenantSubdomain') || 'demo-company';
    
    const tenantData = await c.env.DB.prepare(`
      SELECT id, name, subdomain, status FROM tenants 
      WHERE subdomain = ? AND status = 'active'
    `).bind(tenantSubdomain).first();
    
    if (!tenantData) {
      return c.json({ 
        success: false, 
        error: `テナントが見つかりません: ${tenantSubdomain}`,
        subdomain: tenantSubdomain
      }, 404);
    }

    return c.json({
      success: true,
      tenant: {
        id: tenantData.id,
        name: tenantData.name,
        subdomain: tenantData.subdomain
      },
      detectedSubdomain: tenantSubdomain
    });

  } catch (error) {
    console.error('Tenant info error:', error);
    return c.json({ 
      success: false, 
      error: 'テナント情報の取得中にエラーが発生しました。' 
    }, 500);
  }
});

/**
 * 利用可能なテナント一覧
 * GET /api/tenant/list
 */
tenant.get('/list', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, name, subdomain FROM tenants 
      WHERE status = 'active' 
      ORDER BY name
    `).all();
    
    return c.json({
      success: true,
      tenants: result.results || []
    });

  } catch (error) {
    console.error('Tenant list error:', error);
    return c.json({ 
      success: false, 
      error: 'テナント一覧の取得中にエラーが発生しました。' 
    }, 500);
  }
});

/**
 * メールアドレスからテナント検索
 * POST /api/tenant/find-by-email
 */
tenant.post('/find-by-email', async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;
    
    if (!email || !email.includes('@')) {
      return c.json({ 
        success: false, 
        error: '有効なメールアドレスを指定してください。' 
      }, 400);
    }

    const emailDomain = email.split('@')[1].toLowerCase();
    
    // ドメイン許可リストまたはメールドメインマッチからテナントを検索
    const tenantData = await c.env.DB.prepare(`
      SELECT id, name, subdomain, domain_allowlist FROM tenants 
      WHERE status = 'active' 
      AND (domain_allowlist LIKE '%"' || ? || '"%' OR domain_allowlist IS NULL)
      ORDER BY 
        CASE 
          WHEN domain_allowlist LIKE '%"' || ? || '"%' THEN 1
          ELSE 2
        END
      LIMIT 1
    `).bind(emailDomain, emailDomain).first();
    
    if (!tenantData) {
      return c.json({ 
        success: false, 
        error: `メールドメイン ${emailDomain} に対応する企業が見つかりません。`,
        emailDomain
      });
    }

    return c.json({
      success: true,
      tenant: {
        id: tenantData.id,
        name: tenantData.name,
        subdomain: tenantData.subdomain
      },
      emailDomain
    });

  } catch (error) {
    console.error('Tenant search by email error:', error);
    return c.json({ 
      success: false, 
      error: 'テナント検索中にエラーが発生しました。' 
    }, 500);
  }
});

/**
 * サブドメイン可用性確認
 * POST /api/tenant/check-subdomain
 */
tenant.post('/check-subdomain', async (c) => {
  try {
    const body = await c.req.json();
    const { subdomain } = body;
    
    if (!subdomain) {
      return c.json({ 
        success: false, 
        error: 'サブドメインを指定してください。' 
      }, 400);
    }

    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain) || subdomain.length < 3) {
      return c.json({ 
        available: false,
        error: 'サブドメインは3文字以上の英数字とハイフンで入力してください。' 
      });
    }

    // 予約語チェック
    const reservedSubdomains = [
      'www', 'api', 'admin', 'mail', 'ftp', 'blog', 'shop', 'store',
      'support', 'help', 'docs', 'cdn', 'static', 'assets', 'img',
      'system', 'root', 'test', 'demo', 'staging', 'dev'
    ];

    if (reservedSubdomains.includes(subdomain)) {
      return c.json({ 
        available: false,
        error: 'このサブドメインは予約されています。' 
      });
    }

    // データベースで重複確認
    const existingTenant = await c.env.DB.prepare(`
      SELECT id FROM tenants WHERE subdomain = ?
    `).bind(subdomain).first();
    
    return c.json({
      available: !existingTenant,
      subdomain: subdomain
    });

  } catch (error) {
    console.error('Subdomain check error:', error);
    return c.json({ 
      available: false,
      error: 'サブドメイン確認中にエラーが発生しました。' 
    });
  }
});

export { tenant };