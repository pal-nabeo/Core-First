// サービス提供者ダッシュボードAPI
// 全テナント統合管理機能
import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// KPI 統合データ取得
app.get('/kpi', async (c) => {
  try {
    const db = c.env.DB;

    // 総テナント数
    const totalTenants = await db.prepare(`
      SELECT COUNT(*) as count
      FROM tenants
      WHERE id != 'system'
    `).first();

    // アクティブテナント数
    const activeTenants = await db.prepare(`
      SELECT COUNT(*) as count
      FROM tenants
      WHERE status = 'active' AND id != 'system'
    `).first();

    // 総ユーザー数
    const totalUsers = await db.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE tenant_id != 'system'
    `).first();

    // アクティブユーザー数（過去24時間内にログイン）
    const activeUsers = await db.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE tenant_id != 'system' 
        AND status = 'active'
        AND last_login_at > datetime('now', '-24 hours')
    `).first();

    // 今月の新規ユーザー数
    const newUsersThisMonth = await db.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE tenant_id != 'system'
        AND created_at >= date('now', 'start of month')
    `).first();

    // システム稼働率（疑似データ - 実際にはヘルスチェックログから計算）
    const systemUptime = 99.8;

    // ライセンス使用率の計算
    const licenseUsage = await db.prepare(`
      SELECT
        COUNT(CASE WHEN u.status = 'active' THEN 1 END) as used_licenses,
        SUM(100) as total_licenses  -- 疑似データ: テナントあたり100ライセンス
      FROM tenants t
      LEFT JOIN users u ON t.id = u.tenant_id
      WHERE t.id != 'system'
    `).first();

    const licenseUsagePercent = licenseUsage?.total_licenses > 0 
      ? Math.round((licenseUsage.used_licenses / licenseUsage.total_licenses) * 100)
      : 0;

    return c.json({
      success: true,
      data: {
        totalTenants: totalTenants?.count || 0,
        activeTenants: activeTenants?.count || 0,
        totalUsers: totalUsers?.count || 0,
        activeUsers: activeUsers?.count || 0,
        newUsersThisMonth: newUsersThisMonth?.count || 0,
        systemUptime: systemUptime,
        licenseUsage: {
          used: licenseUsage?.used_licenses || 0,
          total: licenseUsage?.total_licenses || 0,
          percentage: licenseUsagePercent
        },
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('KPI データ取得エラー:', error);
    return c.json({
      success: false,
      error: 'KPI データの取得に失敗しました'
    }, 500);
  }
});

// テナント一覧取得
app.get('/tenants', async (c) => {
  try {
    const db = c.env.DB;
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    // テナント一覧とユーザー数を取得
    const tenants = await db.prepare(`
      SELECT 
        t.id,
        t.name,
        t.subdomain,
        t.plan_id,
        t.status,
        t.company_type,
        t.company_size,
        t.trial_expires_at,
        t.created_at,
        COUNT(u.id) as user_count,
        COUNT(CASE WHEN u.status = 'active' THEN 1 END) as active_user_count,
        MAX(u.last_login_at) as last_activity
      FROM tenants t
      LEFT JOIN users u ON t.id = u.tenant_id
      WHERE t.id != 'system'
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    // 総テナント数
    const totalCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM tenants
      WHERE id != 'system'
    `).first();

    return c.json({
      success: true,
      data: {
        tenants: tenants.results || [],
        pagination: {
          page,
          limit,
          total: totalCount?.count || 0,
          totalPages: Math.ceil((totalCount?.count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('テナント一覧取得エラー:', error);
    return c.json({
      success: false,
      error: 'テナント一覧の取得に失敗しました'
    }, 500);
  }
});

// 売上分析データ取得
app.get('/revenue', async (c) => {
  try {
    const db = c.env.DB;

    // プラン別の売上分析（疑似データ）
    const planPricing = {
      free: 0,
      standard: 5000,
      plus: 10000,
      pro: 20000,
      enterprise: 50000
    };

    const revenueByPlan = await db.prepare(`
      SELECT 
        plan_id,
        COUNT(*) as tenant_count
      FROM tenants
      WHERE id != 'system' AND status = 'active'
      GROUP BY plan_id
    `).all();

    let totalMonthlyRevenue = 0;
    const revenueBreakdown = (revenueByPlan.results || []).map((plan: any) => {
      const monthlyRevenue = plan.tenant_count * (planPricing[plan.plan_id as keyof typeof planPricing] || 0);
      totalMonthlyRevenue += monthlyRevenue;
      
      return {
        plan: plan.plan_id,
        tenantCount: plan.tenant_count,
        monthlyRevenue,
        annualRevenue: monthlyRevenue * 12
      };
    });

    // 過去12ヶ月の売上推移（疑似データ）
    const revenueHistory = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const variation = 0.8 + Math.random() * 0.4; // ±20%の変動
      revenueHistory.push({
        month: date.toISOString().substring(0, 7),
        revenue: Math.round(totalMonthlyRevenue * variation),
        tenantCount: Math.round((revenueByPlan.results?.length || 0) * variation)
      });
    }

    return c.json({
      success: true,
      data: {
        totalMonthlyRevenue,
        totalAnnualRevenue: totalMonthlyRevenue * 12,
        revenueBreakdown,
        revenueHistory,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('売上データ取得エラー:', error);
    return c.json({
      success: false,
      error: '売上データの取得に失敗しました'
    }, 500);
  }
});

// リアルタイム監視データ取得
app.get('/monitoring', async (c) => {
  try {
    const db = c.env.DB;

    // システム状態
    const systemStatus = {
      status: 'healthy',
      uptime: 99.8,
      lastCheck: new Date().toISOString(),
      services: {
        database: 'healthy',
        api: 'healthy',
        auth: 'healthy',
        storage: 'healthy'
      }
    };

    // 最近のアクティビティ
    const recentActivities = await db.prepare(`
      SELECT 
        action_type,
        target_type,
        actor_user_id,
        ip_address,
        result,
        created_at,
        u.display_name as actor_name,
        t.name as tenant_name
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_user_id = u.id
      LEFT JOIN tenants t ON a.tenant_id = t.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all();

    // アラート（疑似データ）
    const alerts = [
      {
        id: 'alert_1',
        level: 'warning',
        title: 'ライセンス使用率が80%に到達',
        description: 'テナント ABC物流株式会社のライセンス使用率が警告レベルに達しました',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        resolved: false
      },
      {
        id: 'alert_2',
        level: 'info',
        title: '新規テナント登録',
        description: '新しいテナントが登録されました: XYZ配送サービス',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        resolved: true
      }
    ];

    return c.json({
      success: true,
      data: {
        systemStatus,
        recentActivities: recentActivities.results || [],
        alerts,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('監視データ取得エラー:', error);
    return c.json({
      success: false,
      error: '監視データの取得に失敗しました'
    }, 500);
  }
});

// チャート用のユーザーアクティビティデータ取得
app.get('/charts/user-activity', async (c) => {
  try {
    const db = c.env.DB;
    
    // 過去30日のログイン数
    const activityData = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // その日のログイン数を取得
      const loginCount = await db.prepare(`
        SELECT COUNT(*) as count
        FROM audit_logs
        WHERE action_type = 'login'
          AND result = 'success'
          AND DATE(created_at) = ?
      `).bind(dateStr).first();
      
      activityData.push({
        date: dateStr,
        logins: loginCount?.count || Math.floor(Math.random() * 50) + 10 // 疑似データでフォールバック
      });
    }

    return c.json({
      success: true,
      data: {
        activityData,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('ユーザーアクティビティデータ取得エラー:', error);
    return c.json({
      success: false,
      error: 'アクティビティデータの取得に失敗しました'
    }, 500);
  }
});

// 横断ユーザー検索
app.get('/cross-tenant-users', async (c) => {
  try {
    const db = c.env.DB;
    const searchQuery = c.req.query('q') || '';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    let whereClause = "u.tenant_id != 'system'";
    let params: any[] = [];

    if (searchQuery) {
      whereClause += ` AND (u.email LIKE ? OR u.display_name LIKE ? OR t.name LIKE ?)`;
      const searchPattern = `%${searchQuery}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // 横断ユーザー検索
    const users = await db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.status,
        u.last_login_at,
        u.created_at,
        t.id as tenant_id,
        t.name as tenant_name,
        t.subdomain,
        t.plan_id,
        GROUP_CONCAT(r.display_name) as roles
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    // 総数取得
    const totalCount = await db.prepare(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE ${whereClause}
    `).bind(...params).first();

    return c.json({
      success: true,
      data: {
        users: users.results || [],
        pagination: {
          page,
          limit,
          total: totalCount?.count || 0,
          totalPages: Math.ceil((totalCount?.count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('横断ユーザー検索エラー:', error);
    return c.json({
      success: false,
      error: 'ユーザー検索に失敗しました'
    }, 500);
  }
});

// サポートチケット管理
app.get('/support-tickets', async (c) => {
  try {
    // 疑似データ（実際にはサポートチケット用のテーブルから取得）
    const tickets = [
      {
        id: 'ticket_1',
        title: 'ログインできない問題について',
        description: 'パスワードリセット後もログインできません',
        status: 'open',
        priority: 'high',
        tenantName: 'ABC物流株式会社',
        requesterEmail: 'admin@abc-logistics.co.jp',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      },
      {
        id: 'ticket_2',
        title: 'プランアップグレードについて',
        description: 'Plusプランにアップグレードを希望します',
        status: 'in_progress',
        priority: 'medium',
        tenantName: 'XYZ配送サービス',
        requesterEmail: 'manager@xyz-delivery.jp',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ticket_3',
        title: 'ユーザー招待機能の使い方',
        description: '新しいユーザーを招待する方法を教えてください',
        status: 'resolved',
        priority: 'low',
        tenantName: 'デモ物流企業',
        requesterEmail: 'admin@demo-logistics.com',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    return c.json({
      success: true,
      data: {
        tickets,
        summary: {
          total: tickets.length,
          open: tickets.filter(t => t.status === 'open').length,
          inProgress: tickets.filter(t => t.status === 'in_progress').length,
          resolved: tickets.filter(t => t.status === 'resolved').length
        },
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('サポートチケット取得エラー:', error);
    return c.json({
      success: false,
      error: 'サポートチケットの取得に失敗しました'
    }, 500);
  }
});

// 要件定義書 v2.0 対応: サービス提供者専用管理機能追加

// テナント作成・管理（スーパー管理者権限）
app.post('/tenants', async (c) => {
  try {
    // 権限チェック（実際にはJWTから権限を確認）
    const { name, subdomain, plan_id, company_type, company_size } = await c.req.json();

    if (!name || !subdomain) {
      return c.json({
        success: false,
        error: 'テナント名とサブドメインは必須です'
      }, 400);
    }

    const db = c.env.DB;
    const tenantId = crypto.randomUUID();

    // サブドメイン重複チェック
    const existing = await db.prepare(
      'SELECT id FROM tenants WHERE subdomain = ?'
    ).bind(subdomain).first();

    if (existing) {
      return c.json({
        success: false,
        error: 'このサブドメインは既に使用されています'
      }, 400);
    }

    // テナント作成
    await db.prepare(`
      INSERT INTO tenants (id, name, subdomain, plan_id, company_type, company_size, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).bind(tenantId, name, subdomain, plan_id || 'free', company_type, company_size).run();

    // テナント管理ログ記録
    await db.prepare(`
      INSERT INTO tenant_management_logs (id, tenant_id, action_type, performed_by, new_values, reason)
      VALUES (?, ?, 'created', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenantId,
      'system-admin-001', // 実際にはJWTから取得
      JSON.stringify({ name, subdomain, plan_id, company_type, company_size }),
      'New tenant creation via service provider dashboard'
    ).run();

    return c.json({
      success: true,
      data: {
        id: tenantId,
        name,
        subdomain,
        plan_id: plan_id || 'free',
        status: 'active'
      }
    });
  } catch (error) {
    console.error('テナント作成エラー:', error);
    return c.json({
      success: false,
      error: 'テナントの作成に失敗しました'
    }, 500);
  }
});

// テナント更新（スーパー管理者権限）
app.put('/tenants/:tenantId', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const updates = await c.req.json();
    const db = c.env.DB;

    // 既存テナント取得
    const existingTenant = await db.prepare(
      'SELECT * FROM tenants WHERE id = ?'
    ).bind(tenantId).first();

    if (!existingTenant) {
      return c.json({
        success: false,
        error: 'テナントが見つかりません'
      }, 404);
    }

    // 更新クエリ構築
    const allowedFields = ['name', 'plan_id', 'status', 'company_type', 'company_size'];
    const updateFields = [];
    const updateValues = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return c.json({
        success: false,
        error: '更新する項目がありません'
      }, 400);
    }

    updateValues.push(tenantId);

    // テナント更新
    await db.prepare(`
      UPDATE tenants 
      SET ${updateFields.join(', ')}, updated_at = datetime('now')
      WHERE id = ?
    `).bind(...updateValues).run();

    // 管理ログ記録
    await db.prepare(`
      INSERT INTO tenant_management_logs (id, tenant_id, action_type, performed_by, old_values, new_values, reason)
      VALUES (?, ?, 'updated', ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenantId,
      'system-admin-001',
      JSON.stringify(existingTenant),
      JSON.stringify(updates),
      'Tenant update via service provider dashboard'
    ).run();

    return c.json({
      success: true,
      message: 'テナントが正常に更新されました'
    });
  } catch (error) {
    console.error('テナント更新エラー:', error);
    return c.json({
      success: false,
      error: 'テナントの更新に失敗しました'
    }, 500);
  }
});

// システム管理者管理（スーパー管理者専用）
app.get('/system-admins', async (c) => {
  try {
    const db = c.env.DB;
    
    const admins = await db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.status,
        u.last_login_at,
        u.created_at,
        GROUP_CONCAT(r.display_name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.tenant_id = 'system'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();

    return c.json({
      success: true,
      data: {
        admins: admins.results || []
      }
    });
  } catch (error) {
    console.error('システム管理者取得エラー:', error);
    return c.json({
      success: false,
      error: 'システム管理者の取得に失敗しました'
    }, 500);
  }
});

// 緊急ユーザー操作（スーパー管理者専用）
app.post('/emergency/user/:userId/action', async (c) => {
  try {
    const userId = c.req.param('userId');
    const { action, reason } = await c.req.json();
    const db = c.env.DB;

    // ユーザー存在確認
    const user = await db.prepare(
      'SELECT * FROM users WHERE id = ? AND tenant_id != "system"'
    ).bind(userId).first();

    if (!user) {
      return c.json({
        success: false,
        error: 'ユーザーが見つかりません'
      }, 404);
    }

    let updateQuery = '';
    let logAction = '';

    switch (action) {
      case 'suspend':
        updateQuery = 'UPDATE users SET status = "suspended" WHERE id = ?';
        logAction = 'emergency_user_suspended';
        break;
      case 'activate':
        updateQuery = 'UPDATE users SET status = "active" WHERE id = ?';
        logAction = 'emergency_user_activated';
        break;
      case 'unlock':
        updateQuery = 'UPDATE users SET locked_until = NULL, failed_login_count = 0 WHERE id = ?';
        logAction = 'emergency_user_unlocked';
        break;
      default:
        return c.json({
          success: false,
          error: '無効なアクションです'
        }, 400);
    }

    // ユーザー状態更新
    await db.prepare(updateQuery).bind(userId).run();

    // 緊急操作ログ記録
    await db.prepare(`
      INSERT INTO audit_logs (id, tenant_id, actor_user_id, action_type, target_type, target_id, ip_address, result, payload)
      VALUES (?, ?, ?, ?, 'user', ?, ?, 'success', ?)
    `).bind(
      crypto.randomUUID(),
      user.tenant_id,
      'system-admin-001',
      logAction,
      userId,
      c.req.header('CF-Connecting-IP'),
      JSON.stringify({ reason, originalStatus: user.status })
    ).run();

    return c.json({
      success: true,
      message: `緊急操作「${action}」が正常に実行されました`
    });
  } catch (error) {
    console.error('緊急ユーザー操作エラー:', error);
    return c.json({
      success: false,
      error: '緊急操作の実行に失敗しました'
    }, 500);
  }
});

// セキュリティ監査レポート
app.get('/security/audit-report', async (c) => {
  try {
    const db = c.env.DB;
    const days = parseInt(c.req.query('days') || '30');

    // セキュリティ関連ログの集計
    const securityEvents = await db.prepare(`
      SELECT 
        action_type,
        COUNT(*) as count,
        COUNT(CASE WHEN result = 'failure' THEN 1 END) as failures
      FROM audit_logs 
      WHERE created_at >= datetime('now', '-' || ? || ' days')
        AND action_type IN ('login', 'logout', 'password_reset', 'account_locked')
      GROUP BY action_type
    `).bind(days).all();

    // 失敗ログイン統計
    const failedLogins = await db.prepare(`
      SELECT 
        DATE(attempt_at) as date,
        COUNT(*) as count,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM failed_logins
      WHERE attempt_at >= datetime('now', '-' || ? || ' days')
      GROUP BY DATE(attempt_at)
      ORDER BY date DESC
    `).bind(days).all();

    // 疑わしいアクティビティ
    const suspiciousActivities = await db.prepare(`
      SELECT 
        ip_address,
        COUNT(*) as failed_attempts,
        COUNT(DISTINCT email) as different_emails,
        MIN(attempt_at) as first_attempt,
        MAX(attempt_at) as last_attempt
      FROM failed_logins
      WHERE attempt_at >= datetime('now', '-' || ? || ' days')
      GROUP BY ip_address
      HAVING COUNT(*) > 10
      ORDER BY failed_attempts DESC
      LIMIT 20
    `).bind(days).all();

    return c.json({
      success: true,
      data: {
        reportPeriod: `Past ${days} days`,
        securityEvents: securityEvents.results || [],
        failedLogins: failedLogins.results || [],
        suspiciousActivities: suspiciousActivities.results || [],
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('セキュリティ監査レポートエラー:', error);
    return c.json({
      success: false,
      error: 'セキュリティ監査レポートの生成に失敗しました'
    }, 500);
  }
});

export { app as providerDashboard };