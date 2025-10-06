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

export { tenant };