// Core First ライセンスチェックミドルウェア
// 要件定義書準拠のライセンス・使用量制限機能

import { Context, Next } from 'hono';
import type { CloudflareBindings } from '../types/auth';

interface LicenseCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  warningLevel?: 'normal' | 'warning' | 'critical' | 'emergency';
  expiresAt?: string;
}

interface UsageMetric {
  tenant_id: string;
  metric_type: string;
  current_value: number;
  limit_value: number;
  period_start: string;
  period_end: string;
}

/**
 * ライセンスチェックAPI
 * GET /api/v1/license/check
 */
export async function licenseCheckAPI(c: Context<{ Bindings: CloudflareBindings }>) {
  try {
    const tenantId = c.get('tenantId') || 'demo-company';
    const feature = c.req.query('feature');
    const checkType = c.req.query('type') || 'feature_access';

    const result = await performLicenseCheck(c, tenantId, checkType, feature);
    
    // ライセンスチェックログを記録
    await logLicenseCheck(c, tenantId, checkType, feature || 'general', result);

    return c.json({
      success: true,
      data: {
        allowed: result.allowed,
        reason: result.reason,
        limits: {
          current_usage: result.currentUsage,
          limit_value: result.limit,
          warning_level: result.warningLevel
        },
        expires_at: result.expiresAt,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('License check API error:', error);
    return c.json({
      success: false,
      error: 'ライセンスチェックでエラーが発生しました。',
      data: {
        allowed: false,
        reason: 'system_error'
      }
    }, 500);
  }
}

/**
 * 使用量記録API
 * POST /api/v1/usage/record
 */
export async function usageRecordAPI(c: Context<{ Bindings: CloudflareBindings }>) {
  try {
    const tenantId = c.get('tenantId') || 'demo-company';
    const body = await c.req.json();
    const { metric_type, value = 1, timestamp, metadata = {} } = body;

    if (!metric_type) {
      return c.json({
        success: false,
        error: 'metric_type は必須です。'
      }, 400);
    }

    // 使用量を記録
    await recordUsage(c, tenantId, metric_type, value, timestamp, metadata);

    return c.json({
      success: true,
      data: {
        tenant_id: tenantId,
        metric_type,
        value,
        recorded_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Usage record API error:', error);
    return c.json({
      success: false,
      error: '使用量記録でエラーが発生しました。'
    }, 500);
  }
}

/**
 * ライセンスチェックミドルウェア
 * API呼び出し時の自動チェック
 */
export async function licenseCheckMiddleware(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  try {
    const path = c.req.path;
    const method = c.req.method;
    const tenantId = c.get('tenantId');

    // チェック対象外のパス
    const excludePaths = [
      '/api/health',
      '/api/auth/login', 
      '/api/auth/logout',
      '/api/v1/license/check',
      '/api/v1/usage/record'
    ];

    if (!tenantId || excludePaths.some(p => path.startsWith(p))) {
      return next();
    }

    // API呼び出し制限チェック
    if (path.startsWith('/api/') && method !== 'OPTIONS') {
      const apiResult = await checkAPIQuota(c, tenantId);
      if (!apiResult.allowed) {
        return c.json({
          success: false,
          error: 'API呼び出し制限に達しています。',
          details: {
            current_usage: apiResult.currentUsage,
            limit: apiResult.limit,
            reset_date: apiResult.expiresAt
          }
        }, 429); // Too Many Requests
      }

      // API使用量をカウント
      await recordUsage(c, tenantId, 'api_calls', 1);
    }

    // 機能別アクセス制限チェック
    const featureResult = await checkFeatureAccess(c, tenantId, path);
    if (!featureResult.allowed) {
      return c.json({
        success: false,
        error: 'この機能へのアクセスが制限されています。',
        reason: featureResult.reason
      }, 403); // Forbidden
    }

    return next();

  } catch (error) {
    console.error('License middleware error:', error);
    // エラー時は処理を継続（フェイルセーフ）
    return next();
  }
}

/**
 * 包括的なライセンスチェック
 */
async function performLicenseCheck(
  c: Context<{ Bindings: CloudflareBindings }>, 
  tenantId: string, 
  checkType: string, 
  feature?: string
): Promise<LicenseCheckResult> {
  
  // テナントライセンス情報取得
  const license = await c.env.DB.prepare(`
    SELECT tl.*, t.status as tenant_status
    FROM tenant_licenses tl
    JOIN tenants t ON tl.tenant_id = t.id
    WHERE tl.tenant_id = ? AND tl.status = 'active'
    ORDER BY tl.created_at DESC
    LIMIT 1
  `).bind(tenantId).first();

  if (!license) {
    return {
      allowed: false,
      reason: 'license_not_found'
    };
  }

  // ライセンス期限チェック
  if (license.expires_at) {
    const expiryDate = new Date(license.expires_at);
    const now = new Date();
    
    if (now > expiryDate) {
      return {
        allowed: false,
        reason: 'license_expired',
        expiresAt: license.expires_at
      };
    }
  }

  // チェックタイプ別処理
  switch (checkType) {
    case 'api_quota':
      return await checkAPIQuota(c, tenantId);
    
    case 'user_limit':
      return await checkUserLimit(c, tenantId);
    
    case 'storage_limit':
      return await checkStorageLimit(c, tenantId);
    
    case 'feature_access':
      return await checkFeatureAccess(c, tenantId, feature || '');
    
    default:
      return {
        allowed: true,
        warningLevel: 'normal'
      };
  }
}

/**
 * API呼び出し制限チェック
 */
async function checkAPIQuota(c: Context<{ Bindings: CloudflareBindings }>, tenantId: string): Promise<LicenseCheckResult> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 現在の使用量取得
  const usage = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(value), 0) as current_usage
    FROM usage_metrics 
    WHERE tenant_id = ? 
      AND metric_type = 'api_calls'
      AND period_start >= ? 
      AND period_end <= ?
  `).bind(tenantId, monthStart.toISOString(), monthEnd.toISOString()).first();

  // 制限値取得
  const limit = await getPlanLimit(c, tenantId, 'api_calls');
  
  if (limit === -1) { // 無制限
    return { 
      allowed: true, 
      currentUsage: usage?.current_usage || 0,
      limit: -1,
      warningLevel: 'normal'
    };
  }

  const currentUsage = usage?.current_usage || 0;
  const usagePercentage = limit > 0 ? (currentUsage / limit) * 100 : 0;

  let warningLevel: 'normal' | 'warning' | 'critical' | 'emergency' = 'normal';
  if (usagePercentage >= 100) {
    warningLevel = 'emergency';
  } else if (usagePercentage >= 95) {
    warningLevel = 'critical';
  } else if (usagePercentage >= 85) {
    warningLevel = 'warning';
  }

  return {
    allowed: currentUsage < limit,
    reason: currentUsage >= limit ? 'api_quota_exceeded' : undefined,
    currentUsage,
    limit,
    warningLevel
  };
}

/**
 * ユーザー数制限チェック
 */
async function checkUserLimit(c: Context<{ Bindings: CloudflareBindings }>, tenantId: string): Promise<LicenseCheckResult> {
  const usage = await c.env.DB.prepare(`
    SELECT COUNT(*) as current_users
    FROM users 
    WHERE tenant_id = ? AND status = 'active'
  `).bind(tenantId).first();

  const limit = await getPlanLimit(c, tenantId, 'users');
  const currentUsers = usage?.current_users || 0;

  if (limit === -1) {
    return { 
      allowed: true, 
      currentUsage: currentUsers, 
      limit: -1,
      warningLevel: 'normal'
    };
  }

  const usagePercentage = limit > 0 ? (currentUsers / limit) * 100 : 0;
  let warningLevel: 'normal' | 'warning' | 'critical' | 'emergency' = 'normal';
  
  if (usagePercentage >= 100) {
    warningLevel = 'emergency';
  } else if (usagePercentage >= 90) {
    warningLevel = 'critical';
  } else if (usagePercentage >= 80) {
    warningLevel = 'warning';
  }

  return {
    allowed: currentUsers < limit,
    reason: currentUsers >= limit ? 'user_limit_exceeded' : undefined,
    currentUsage: currentUsers,
    limit,
    warningLevel
  };
}

/**
 * ストレージ制限チェック
 */
async function checkStorageLimit(c: Context<{ Bindings: CloudflareBindings }>, tenantId: string): Promise<LicenseCheckResult> {
  // 簡易実装：今後実際のストレージ使用量を計算
  const limit = await getPlanLimit(c, tenantId, 'storage_gb');
  
  return {
    allowed: true,
    currentUsage: 0,
    limit,
    warningLevel: 'normal'
  };
}

/**
 * 機能アクセス制限チェック
 */
async function checkFeatureAccess(c: Context<{ Bindings: CloudflareBindings }>, tenantId: string, path: string): Promise<LicenseCheckResult> {
  const license = await c.env.DB.prepare(`
    SELECT plan_type FROM tenant_licenses 
    WHERE tenant_id = ? AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `).bind(tenantId).first();

  const planType = license?.plan_type || 'free';

  // パス別のアクセス制限
  const restrictedFeatures: { [key: string]: string[] } = {
    '/api/advanced/': ['plus', 'pro', 'enterprise'],
    '/api/admin/analytics': ['standard', 'plus', 'pro', 'enterprise'],
    '/api/admin/export': ['plus', 'pro', 'enterprise'],
    '/api/integrations/': ['pro', 'enterprise'],
    '/api/custom/': ['enterprise']
  };

  for (const [restrictedPath, allowedPlans] of Object.entries(restrictedFeatures)) {
    if (path.startsWith(restrictedPath) && !allowedPlans.includes(planType)) {
      return {
        allowed: false,
        reason: `feature_requires_${allowedPlans[0]}_plan`
      };
    }
  }

  return { allowed: true, warningLevel: 'normal' };
}

/**
 * プラン制限値取得
 */
async function getPlanLimit(c: Context<{ Bindings: CloudflareBindings }>, tenantId: string, limitType: string): Promise<number> {
  const license = await c.env.DB.prepare(`
    SELECT plan_type FROM tenant_licenses 
    WHERE tenant_id = ? AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `).bind(tenantId).first();

  if (!license) return 0;

  const limit = await c.env.DB.prepare(`
    SELECT limit_value FROM plan_limits 
    WHERE plan_type = ? AND limit_type = ? AND is_active = 1
  `).bind(license.plan_type, limitType).first();

  return limit?.limit_value || 0;
}

/**
 * 使用量記録
 */
async function recordUsage(
  c: Context<{ Bindings: CloudflareBindings }>, 
  tenantId: string, 
  metricType: string, 
  value: number = 1, 
  timestamp?: string, 
  metadata: any = {}
): Promise<void> {
  
  const now = new Date(timestamp || Date.now());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 既存の月次使用量を取得または作成
  let usage = await c.env.DB.prepare(`
    SELECT * FROM usage_metrics 
    WHERE tenant_id = ? 
      AND metric_type = ? 
      AND period_start = ? 
      AND period_end = ?
  `).bind(tenantId, metricType, monthStart.toISOString(), monthEnd.toISOString()).first();

  if (usage) {
    // 既存レコードを更新
    await c.env.DB.prepare(`
      UPDATE usage_metrics 
      SET value = value + ?, 
          metadata = ?, 
          recorded_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(value, JSON.stringify(metadata), usage.id).run();
  } else {
    // 新規レコードを作成
    await c.env.DB.prepare(`
      INSERT INTO usage_metrics 
      (id, tenant_id, metric_type, value, period_start, period_end, metadata, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      tenantId,
      metricType,
      value,
      monthStart.toISOString(),
      monthEnd.toISOString(),
      JSON.stringify(metadata)
    ).run();
  }
}

/**
 * ライセンスチェックログ記録
 */
async function logLicenseCheck(
  c: Context<{ Bindings: CloudflareBindings }>, 
  tenantId: string, 
  checkType: string, 
  feature: string, 
  result: LicenseCheckResult
): Promise<void> {
  
  try {
    await c.env.DB.prepare(`
      INSERT INTO license_check_logs 
      (id, tenant_id, check_type, feature_name, result, reason, current_usage, limit_value, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      tenantId,
      checkType,
      feature,
      result.allowed ? 'allowed' : 'denied',
      result.reason || '',
      result.currentUsage || 0,
      result.limit || 0,
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || 'unknown'
    ).run();
  } catch (error) {
    console.error('Failed to log license check:', error);
  }
}