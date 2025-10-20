// Core First 権限分離ミドルウェア
// サービス提供者とサービス利用者（テナント管理者）の厳格な権限分離

import { Context, Next } from 'hono';
import type { CloudflareBindings } from '../types/auth';

// サービス提供者専用権限
const SERVICE_PROVIDER_PERMISSIONS = [
  'system:tenant:create',
  'system:tenant:delete',
  'system:tenant:suspend',
  'system:billing:global_view',
  'system:license:global_manage',
  'system:user:cross_tenant_manage',
  'system:analytics:global_view',
  'system:security:global_monitor',
  'system:backup:global_manage',
  'system:support:all_tenants',
  'system:emergency_access',
  'system:audit:global_logs',
  'system:infrastructure:manage',
  // ログ管理関連権限（全テナント対象）
  'system:logs:view_all_tenants',
  'system:logs:search_all_tenants',
  'system:logs:export_all_tenants',
  'system:logs:manage_retention',
  'system:logs:emergency_access',
  'system:logs:breakglass_approve',
  'system:logs:audit_access',
  'system:logs:system_view',
  'system:logs:infrastructure_view',
  // データアップロードとマッピング関連権限（全テナント対象）
  'system:data_upload:manage_global_templates',
  'system:data_upload:view_all_tenants',
  'system:data_upload:emergency_access',
  'system:data_upload:cross_tenant_operations',
  'system:data_upload:key_management',
  'system:data_upload:audit_all',
  'system:mapping:global_templates',
  'system:mapping:cross_tenant_view',
  'system:mapping:ai_training_oversight',
  'system:encryption:global_manage',
  'system:template:distribute_global',
  'system:template:approve_sharing'
];

// テナント管理者権限（自テナント内のみ）
const TENANT_ADMIN_PERMISSIONS = [
  'tenant:user:manage',
  'tenant:role:manage',
  'tenant:settings:manage',
  'tenant:billing:view',
  'tenant:license:view',
  'tenant:analytics:view',
  'tenant:backup:manage',
  'tenant:support:create_ticket',
  'tenant:audit:view_logs',
  'tenant:integration:manage',
  // ログ管理関連権限（自テナントのみ）
  'tenant:logs:view',
  'tenant:logs:search',
  'tenant:logs:export',
  'tenant:logs:user_activity',
  'tenant:logs:business_operations',
  'tenant:logs:security_events',
  'tenant:logs:audit_trail',
  // データアップロードとマッピング関連権限（自テナントのみ）
  'tenant:data_upload:manage',
  'tenant:data_upload:view_own',
  'tenant:data_upload:process',
  'tenant:data_upload:validate',
  'tenant:mapping:create',
  'tenant:mapping:edit_own',
  'tenant:mapping:view_own',
  'tenant:mapping:use_templates',
  'tenant:template:create_own',
  'tenant:template:manage_own',
  'tenant:template:request_sharing',
  'tenant:encryption:own_keys',
  'tenant:ai_consent:manage'
];

// 一般ユーザー権限
const USER_PERMISSIONS = [
  'user:profile:view',
  'user:profile:edit',
  'user:data:own_view',
  'user:data:own_edit',
  'user:reports:view',
  'user:dashboard:view'
];

interface UserContext {
  userId: string;
  tenantId: string;
  userType: 'service_provider' | 'tenant_admin' | 'site_manager' | 'user';
  roles: string[];
  permissions: string[];
}

/**
 * 権限分離チェックミドルウェア
 */
export async function roleSeparationMiddleware(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  try {
    const path = c.req.path;
    const method = c.req.method;
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');

    // 認証不要パス
    const publicPaths = [
      '/api/health',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/signup',
      '/signup',
      '/login',
      '/static',
      '/favicon.ico'
    ];

    if (!userId || publicPaths.some(p => path.startsWith(p))) {
      return next();
    }

    console.log('🔍 roleSeparationMiddleware:', {
      path,
      userId,
      tenantId,
      method
    });

    // ユーザーコンテキスト取得
    const userContext = await getUserContext(c, userId, tenantId);
    c.set('userContext', userContext);
    
    console.log('✅ userContext set:', {
      userType: userContext.userType,
      roles: userContext.roles,
      permissionCount: userContext.permissions.length
    });

    // パス別権限チェック
    const requiredPermission = getRequiredPermissionForPath(path, method);
    if (requiredPermission && !hasPermission(userContext, requiredPermission)) {
      
      // 権限不足ログ記録
      await logAccessDenied(c, userId, tenantId, path, requiredPermission, userContext.userType);

      return c.json({
        success: false,
        error: 'この機能にアクセスする権限がありません。',
        details: {
          required_permission: requiredPermission,
          user_type: userContext.userType,
          access_level: getAccessLevelDescription(requiredPermission)
        }
      }, 403);
    }

    // サービス提供者による他テナントアクセスの特別チェック
    if (userContext.userType === 'service_provider') {
      const targetTenantId = extractTargetTenantFromPath(path, c);
      if (targetTenantId && targetTenantId !== tenantId) {
        // クロステナントアクセスの監査ログ
        await logCrossTenantAccess(c, userId, tenantId, targetTenantId, path);
      }
    }

    return next();

  } catch (error) {
    console.error('Role separation middleware error:', error);
    return next(); // フェイルセーフで処理を継続
  }
}

/**
 * サービス提供者専用エンドポイントチェック
 */
export async function requireServiceProvider(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  const userContext = c.get('userContext') as UserContext;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId');
  
  console.log('🔍 requireServiceProvider check:', {
    hasUserContext: !!userContext,
    userType: userContext?.userType || 'none',
    userId,
    tenantId,
    path: c.req.path
  });
  
  if (!userContext || userContext.userType !== 'service_provider') {
    console.error('❌ Service provider check failed:', {
      userContext: !!userContext,
      userType: userContext?.userType,
      required: 'service_provider'
    });
    
    return c.json({
      success: false,
      error: 'この機能はサービス提供者のみアクセス可能です。',
      details: {
        required_role: 'service_provider',
        current_role: userContext?.userType || 'unknown',
        has_userId: !!userId,
        has_tenantId: !!tenantId
      }
    }, 403);
  }

  console.log('✅ Service provider check passed');
  return next();
}

/**
 * テナント管理者以上権限チェック
 */
export async function requireTenantAdmin(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  const userContext = c.get('userContext') as UserContext;
  const allowedTypes = ['service_provider', 'tenant_admin'];
  
  if (!userContext || !allowedTypes.includes(userContext.userType)) {
    return c.json({
      success: false,
      error: 'この機能は管理者権限が必要です。',
      details: {
        required_roles: allowedTypes,
        current_role: userContext?.userType || 'unknown'
      }
    }, 403);
  }

  return next();
}

/**
 * ユーザーコンテキスト取得
 */
async function getUserContext(
  c: Context<{ Bindings: CloudflareBindings }>, 
  userId: string, 
  tenantId: string
): Promise<UserContext> {
  
  // ユーザー基本情報と権限取得
  const userInfo = await c.env.DB.prepare(`
    SELECT 
      u.id, u.tenant_id, u.email, u.status,
      ur.role_id, r.name as role_name, r.permissions,
      CASE 
        WHEN u.tenant_id = 'system' THEN 'service_provider'
        WHEN r.name IN ('tenant_admin', 'super_admin') THEN 'tenant_admin'
        WHEN r.name = 'site_manager' THEN 'site_manager'
        ELSE 'user'
      END as user_type
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.id = ? AND u.status = 'active'
  `).bind(userId).all();

  if (!userInfo.results || userInfo.results.length === 0) {
    throw new Error('User not found or inactive');
  }

  const user = userInfo.results[0];
  const roles = userInfo.results.map(row => row.role_name).filter(Boolean);
  
  // 権限の集約
  let permissions: string[] = [];
  for (const row of userInfo.results) {
    if (row.permissions) {
      const rolePermissions = JSON.parse(row.permissions);
      permissions = [...permissions, ...rolePermissions];
    }
  }

  // ユーザータイプ別のデフォルト権限追加
  switch (user.user_type) {
    case 'service_provider':
      permissions = [...permissions, ...SERVICE_PROVIDER_PERMISSIONS];
      break;
    case 'tenant_admin':
      permissions = [...permissions, ...TENANT_ADMIN_PERMISSIONS, ...USER_PERMISSIONS];
      break;
    default:
      permissions = [...permissions, ...USER_PERMISSIONS];
  }

  return {
    userId: user.id,
    tenantId: user.tenant_id,
    userType: user.user_type,
    roles: [...new Set(roles)], // 重複除去
    permissions: [...new Set(permissions)] // 重複除去
  };
}

/**
 * パス別必要権限取得
 */
function getRequiredPermissionForPath(path: string, method: string): string | null {
  const pathPermissionMap: { [key: string]: string } = {
    // サービス提供者専用
    '/api/provider-dashboard': 'system:analytics:global_view',
    '/api/service-provider-auth': 'system:user:cross_tenant_manage',
    '/api/admin/tenant': 'system:tenant:create',
    '/api/admin/billing/global': 'system:billing:global_view',
    '/api/admin/emergency-access': 'system:emergency_access',
    
    // テナント管理者以上
    '/api/admin/users': 'tenant:user:manage',
    '/api/admin/roles': 'tenant:role:manage',
    '/api/admin/settings': 'tenant:settings:manage',
    '/api/license-management': 'tenant:license:view',
    '/api/upgrade': 'tenant:billing:view',
    
    // 一般機能
    '/api/account': 'user:profile:view',
    '/api/tenant/current': 'user:dashboard:view',
    
    // データアップロードとマッピング機能
    '/api/data-upload': 'tenant:data_upload:manage',
    '/api/data-upload/global': 'system:data_upload:view_all_tenants',
    '/api/data-mapping': 'tenant:mapping:create',
    '/api/data-mapping/global': 'system:mapping:cross_tenant_view',
    '/api/templates': 'tenant:template:create_own',
    '/api/templates/global': 'system:template:distribute_global',
    '/api/templates/share': 'tenant:template:request_sharing',
    '/api/encryption/keys': 'tenant:encryption:own_keys',
    '/api/encryption/global': 'system:encryption:global_manage',
    '/api/ai-consent': 'tenant:ai_consent:manage'
  };

  // メソッド別権限調整
  const methodAdjustments: { [key: string]: { [key: string]: string } } = {
    'DELETE': {
      '/api/admin/users': 'system:user:cross_tenant_manage', // 削除は更に高権限
      '/api/admin/tenant': 'system:tenant:delete'
    },
    'POST': {
      '/api/admin/tenant': 'system:tenant:create'
    }
  };

  // 基本権限確認
  for (const [pathPrefix, permission] of Object.entries(pathPermissionMap)) {
    if (path.startsWith(pathPrefix)) {
      // メソッド別の権限調整があるかチェック
      const methodMap = methodAdjustments[method];
      if (methodMap && methodMap[pathPrefix]) {
        return methodMap[pathPrefix];
      }
      return permission;
    }
  }

  return null;
}

/**
 * 権限チェック
 */
function hasPermission(userContext: UserContext, requiredPermission: string): boolean {
  return userContext.permissions.includes(requiredPermission);
}

/**
 * アクセスレベル説明取得
 */
function getAccessLevelDescription(permission: string): string {
  if (permission.startsWith('system:')) {
    return 'サービス提供者専用機能';
  } else if (permission.startsWith('tenant:')) {
    return 'テナント管理者機能';
  } else if (permission.startsWith('user:')) {
    return '一般ユーザー機能';
  }
  return '特殊権限が必要な機能';
}

/**
 * パスからターゲットテナントID抽出
 */
function extractTargetTenantFromPath(path: string, c: Context): string | null {
  const tenantParam = c.req.query('tenant_id') || c.req.param('tenant_id');
  if (tenantParam) return tenantParam;
  
  // URLパスから推測
  const tenantPathMatch = path.match(/\/api\/admin\/tenant\/([^\/]+)/);
  if (tenantPathMatch) return tenantPathMatch[1];
  
  return null;
}

/**
 * アクセス拒否ログ記録
 */
async function logAccessDenied(
  c: Context<{ Bindings: CloudflareBindings }>, 
  userId: string, 
  tenantId: string, 
  path: string, 
  requiredPermission: string, 
  userType: string
): Promise<void> {
  
  try {
    await c.env.DB.prepare(`
      INSERT INTO security_events 
      (id, tenant_id, user_id, event_type, severity, ip_address, user_agent, details, created_at)
      VALUES (?, ?, ?, 'access_denied', 'medium', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      tenantId,
      userId,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      JSON.stringify({
        path,
        required_permission: requiredPermission,
        user_type: userType,
        method: c.req.method
      })
    ).run();
  } catch (error) {
    console.error('Failed to log access denied:', error);
  }
}

/**
 * クロステナントアクセスログ記録
 */
async function logCrossTenantAccess(
  c: Context<{ Bindings: CloudflareBindings }>, 
  userId: string, 
  sourceTeantId: string, 
  targetTenantId: string, 
  path: string
): Promise<void> {
  
  try {
    await c.env.DB.prepare(`
      INSERT INTO emergency_access_logs 
      (id, tenant_id, performed_by, access_type, reason, ip_address, user_agent, actions_performed, created_at)
      VALUES (?, ?, ?, 'cross_tenant_access', 'service_provider_operation', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      targetTenantId,
      userId,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      JSON.stringify({
        source_tenant: sourceTeantId,
        target_tenant: targetTenantId,
        access_path: path,
        method: c.req.method
      })
    ).run();
  } catch (error) {
    console.error('Failed to log cross tenant access:', error);
  }
}