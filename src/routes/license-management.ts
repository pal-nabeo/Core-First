// Core First ライセンス管理API
// 要件定義書v2.0準拠の包括的ライセンス管理機能

import { Hono } from 'hono';
import { licenseCheckAPI, usageRecordAPI } from '../middleware/license';
import type { CloudflareBindings } from '../types/auth';

const licenseManagement = new Hono<{ Bindings: CloudflareBindings }>();

// ライセンスチェックAPI（要件定義書準拠）
licenseManagement.get('/v1/license/check', licenseCheckAPI);

// 使用量記録API（要件定義書準拠）
licenseManagement.post('/v1/usage/record', usageRecordAPI);

// プラン情報取得
licenseManagement.get('/plans', async (c) => {
  try {
    const plans = await c.env.DB.prepare(`
      SELECT DISTINCT plan_type, 
             COUNT(*) as limit_count,
             GROUP_CONCAT(limit_type || ':' || limit_value, ';') as limits_summary
      FROM plan_limits 
      WHERE is_active = 1
      GROUP BY plan_type
      ORDER BY 
        CASE plan_type 
          WHEN 'free' THEN 1
          WHEN 'standard' THEN 2
          WHEN 'plus' THEN 3
          WHEN 'pro' THEN 4
          WHEN 'enterprise' THEN 5
        END
    `).all();

    return c.json({
      success: true,
      data: {
        plans: plans.results || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Plans fetch error:', error);
    return c.json({
      success: false,
      error: 'プラン情報の取得に失敗しました。'
    }, 500);
  }
});

// 詳細プラン制限取得
licenseManagement.get('/plans/:planType/limits', async (c) => {
  try {
    const planType = c.req.param('planType');

    const limits = await c.env.DB.prepare(`
      SELECT limit_type, limit_value, period, description 
      FROM plan_limits 
      WHERE plan_type = ? AND is_active = 1
      ORDER BY 
        CASE limit_type
          WHEN 'users' THEN 1
          WHEN 'storage_gb' THEN 2
          WHEN 'api_calls' THEN 3
          WHEN 'locations' THEN 4
          ELSE 99
        END
    `).bind(planType).all();

    return c.json({
      success: true,
      data: {
        plan_type: planType,
        limits: limits.results || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Plan limits fetch error:', error);
    return c.json({
      success: false,
      error: 'プラン制限の取得に失敗しました。'
    }, 500);
  }
});

// テナントライセンス情報取得（自テナント用）
licenseManagement.get('/tenant/current', async (c) => {
  try {
    const tenantId = c.get('tenantId') || 'demo-company';

    const license = await c.env.DB.prepare(`
      SELECT tl.*, t.name as tenant_name, t.status as tenant_status
      FROM tenant_licenses tl
      JOIN tenants t ON tl.tenant_id = t.id
      WHERE tl.tenant_id = ?
      ORDER BY tl.created_at DESC
      LIMIT 1
    `).bind(tenantId).first();

    if (!license) {
      return c.json({
        success: false,
        error: 'ライセンス情報が見つかりません。'
      }, 404);
    }

    // 現在の使用量取得
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const usageStats = await c.env.DB.prepare(`
      SELECT 
        metric_type,
        value as current_usage,
        period_start,
        period_end
      FROM usage_metrics 
      WHERE tenant_id = ? 
        AND period_start >= ? 
        AND period_end <= ?
    `).bind(tenantId, monthStart.toISOString(), monthEnd.toISOString()).all();

    // プラン制限情報
    const planLimits = await c.env.DB.prepare(`
      SELECT limit_type, limit_value, period, description
      FROM plan_limits 
      WHERE plan_type = ? AND is_active = 1
    `).bind(license.plan_type).all();

    // 期限チェック
    let daysUntilExpiry = null;
    let warningLevel = 'normal';
    
    if (license.expires_at) {
      const expiryDate = new Date(license.expires_at);
      const diffTime = expiryDate.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= 7) {
        warningLevel = 'emergency';
      } else if (daysUntilExpiry <= 30) {
        warningLevel = 'critical';
      } else if (daysUntilExpiry <= 60) {
        warningLevel = 'warning';
      }
    }

    return c.json({
      success: true,
      data: {
        license: {
          id: license.id,
          plan_type: license.plan_type,
          status: license.status,
          started_at: license.started_at,
          expires_at: license.expires_at,
          auto_renew: license.auto_renew,
          billing_cycle: license.billing_cycle,
          days_until_expiry: daysUntilExpiry,
          warning_level: warningLevel
        },
        usage: usageStats.results || [],
        limits: planLimits.results || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Tenant license fetch error:', error);
    return c.json({
      success: false,
      error: 'ライセンス情報の取得に失敗しました。'
    }, 500);
  }
});

// 使用量統計取得（自テナント用）
licenseManagement.get('/usage/stats', async (c) => {
  try {
    const tenantId = c.get('tenantId') || 'demo-company';
    const period = c.req.query('period') || '30d'; // 30d, 90d, 1y

    let dateFilter: string;
    switch (period) {
      case '90d':
        dateFilter = "DATE('now', '-90 days')";
        break;
      case '1y':
        dateFilter = "DATE('now', '-1 year')";
        break;
      default:
        dateFilter = "DATE('now', '-30 days')";
    }

    const usage = await c.env.DB.prepare(`
      SELECT 
        metric_type,
        DATE(period_start) as usage_date,
        SUM(value) as daily_usage
      FROM usage_metrics 
      WHERE tenant_id = ? 
        AND DATE(period_start) >= ${dateFilter}
      GROUP BY metric_type, DATE(period_start)
      ORDER BY usage_date DESC, metric_type
    `).bind(tenantId).all();

    // 現在のライセンス情報
    const license = await c.env.DB.prepare(`
      SELECT plan_type FROM tenant_licenses 
      WHERE tenant_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).bind(tenantId).first();

    // プラン制限
    const limits = await c.env.DB.prepare(`
      SELECT limit_type, limit_value, period as limit_period
      FROM plan_limits 
      WHERE plan_type = ? AND is_active = 1
    `).bind(license?.plan_type || 'free').all();

    return c.json({
      success: true,
      data: {
        tenant_id: tenantId,
        plan_type: license?.plan_type || 'free',
        period_requested: period,
        usage_history: usage.results || [],
        current_limits: limits.results || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Usage stats fetch error:', error);
    return c.json({
      success: false,
      error: '使用量統計の取得に失敗しました。'
    }, 500);
  }
});

// ライセンス更新申請（テナント管理者用）
licenseManagement.post('/tenant/upgrade-request', async (c) => {
  try {
    const tenantId = c.get('tenantId') || 'demo-company';
    const userId = c.get('userId');
    const body = await c.req.json();
    const { target_plan, reason, effective_date } = body;

    if (!target_plan || !reason) {
      return c.json({
        success: false,
        error: 'target_plan と reason は必須です。'
      }, 400);
    }

    // プラン変更履歴に記録（承認待ち状態）
    const changeId = crypto.randomUUID();
    const currentLicense = await c.env.DB.prepare(`
      SELECT plan_type FROM tenant_licenses 
      WHERE tenant_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).bind(tenantId).first();

    await c.env.DB.prepare(`
      INSERT INTO plan_change_history 
      (id, tenant_id, from_plan, to_plan, change_type, effective_date, reason, performed_by, approval_required, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).bind(
      changeId,
      tenantId,
      currentLicense?.plan_type || 'free',
      target_plan,
      'upgrade',
      effective_date || new Date().toISOString(),
      reason,
      userId
    ).run();

    // 監査ログに記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (id, tenant_id, actor_user_id, action_type, target_type, target_id, metadata, ip_address, user_agent, result)
      VALUES (?, ?, ?, 'license_upgrade_request', 'plan', ?, ?, ?, ?, 'success')
    `).bind(
      crypto.randomUUID(),
      tenantId,
      userId,
      changeId,
      JSON.stringify({ from_plan: currentLicense?.plan_type, to_plan: target_plan, reason }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown'
    ).run();

    return c.json({
      success: true,
      data: {
        change_request_id: changeId,
        status: 'pending_approval',
        message: 'プランアップグレード申請を受け付けました。承認までお待ちください。'
      }
    });

  } catch (error) {
    console.error('License upgrade request error:', error);
    return c.json({
      success: false,
      error: 'プランアップグレード申請に失敗しました。'
    }, 500);
  }
});

// アラート設定取得・更新（テナント管理者用）
licenseManagement.get('/alerts', async (c) => {
  try {
    const tenantId = c.get('tenantId') || 'demo-company';

    const alerts = await c.env.DB.prepare(`
      SELECT metric_type, threshold_percentage, alert_level, notification_channels, is_active
      FROM usage_alerts 
      WHERE tenant_id = ?
      ORDER BY metric_type, threshold_percentage
    `).bind(tenantId).all();

    return c.json({
      success: true,
      data: {
        alerts: alerts.results || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Alerts fetch error:', error);
    return c.json({
      success: false,
      error: 'アラート設定の取得に失敗しました。'
    }, 500);
  }
});

export default licenseManagement;