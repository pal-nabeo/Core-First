// PAL物流SaaS テスト API ルート
import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const test = new Hono<{ Bindings: CloudflareBindings }>();

// ヘルスチェック
test.get('/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'Core First 統合管理システム is running',
    timestamp: new Date().toISOString()
  });
});

// 基本テスト
test.get('/hello', (c) => {
  return c.json({
    message: 'Hello from PAL物流SaaS!',
    timestamp: new Date().toISOString(),
    tenant: c.get('tenantSubdomain') || 'unknown'
  });
});

// データベース接続テスト
test.get('/db', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tenants').first();
    return c.json({
      success: true,
      database: 'connected',
      tenantCount: result?.count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// テナント一覧取得
test.get('/tenants', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, name, subdomain, plan_id, status, created_at 
      FROM tenants 
      ORDER BY created_at DESC
    `).all();
    
    return c.json({
      success: true,
      tenants: result.results || [],
      count: result.results?.length || 0
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ユーザー一覧取得（テナント別）
test.get('/users/:tenantId', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    
    const result = await c.env.DB.prepare(`
      SELECT u.id, u.email, u.display_name, u.status, u.created_at, t.name as tenant_name
      FROM users u
      INNER JOIN tenants t ON u.tenant_id = t.id
      WHERE u.tenant_id = ?
      ORDER BY u.created_at DESC
    `).bind(tenantId).all();
    
    return c.json({
      success: true,
      users: result.results || [],
      count: result.results?.length || 0,
      tenantId
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// シンプルなログインテスト（認証なし）
test.post('/login-test', async (c) => {
  try {
    const body = await c.req.json();
    const { email, tenant_subdomain } = body;
    
    if (!email) {
      return c.json({ success: false, error: 'Email is required' }, 400);
    }
    
    // テナント取得テスト
    const tenant = await c.env.DB.prepare(`
      SELECT * FROM tenants WHERE subdomain = ? AND status = 'active'
    `).bind(tenant_subdomain || 'demo-company').first();
    
    if (!tenant) {
      return c.json({ 
        success: false, 
        error: `Tenant not found: ${tenant_subdomain || 'demo-company'}` 
      }, 400);
    }
    
    // ユーザー取得テスト
    const user = await c.env.DB.prepare(`
      SELECT * FROM users WHERE email = ? AND tenant_id = ?
    `).bind(email, tenant.id).first();
    
    if (!user) {
      return c.json({ 
        success: false, 
        error: `User not found: ${email}` 
      }, 400);
    }
    
    return c.json({
      success: true,
      message: 'Login test successful',
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain
      },
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        status: user.status
      }
    });
    
  } catch (error) {
    console.error('Login test error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

export { test };