// PAL物流SaaS アップグレード・課金管理API
import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const upgrade = new Hono<{ Bindings: CloudflareBindings }>();

// プラン定義
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    displayName: 'フリープラン',
    price: 0,
    currency: 'JPY',
    duration: 30, // 日
    maxUsers: 10,
    maxStorage: 1, // GB
    features: {
      twoFactor: false,
      ipRestriction: false,
      sso: false,
      api: false,
      support: 'email'
    },
    description: '30日間の無料トライアル'
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    displayName: 'スタンダードプラン',
    price: 2000,
    currency: 'JPY',
    duration: -1, // 無制限
    maxUsers: 50,
    maxStorage: 50, // GB
    features: {
      twoFactor: true,
      ipRestriction: false,
      sso: 'google',
      api: 'limited',
      support: 'email_chat'
    },
    description: '中小企業向けベーシックプラン'
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    displayName: 'プラスプラン',
    price: 8000,
    currency: 'JPY',
    duration: -1, // 無制限
    maxUsers: 200,
    maxStorage: 500, // GB
    features: {
      twoFactor: true,
      ipRestriction: true,
      sso: 'multiple',
      api: 'standard',
      support: 'priority'
    },
    description: '中規模企業向け高機能プラン'
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    displayName: 'プロプラン',
    price: 20000,
    currency: 'JPY',
    duration: -1, // 無制限
    maxUsers: -1, // 無制限
    maxStorage: -1, // 無制限
    features: {
      twoFactor: true,
      ipRestriction: true,
      sso: 'custom',
      api: 'unlimited',
      support: 'dedicated'
    },
    description: '大企業向けエンタープライズプラン'
  }
};

/**
 * 利用可能なプラン一覧取得
 * GET /api/upgrade/plans
 */
upgrade.get('/plans', async (c) => {
  try {
    const plansArray = Object.values(PLANS).map(plan => ({
      ...plan,
      recommended: plan.id === 'standard' // スタンダードプランを推奨として設定
    }));

    return c.json({
      success: true,
      plans: plansArray
    });
  } catch (error) {
    console.error('Plans fetch error:', error);
    return c.json({
      success: false,
      error: 'プラン一覧の取得中にエラーが発生しました'
    }, 500);
  }
});

/**
 * 現在のテナント サブスクリプション状況取得
 * GET /api/upgrade/status
 */
upgrade.get('/status', async (c) => {
  try {
    const tenantSubdomain = c.get('tenantSubdomain') || 'demo-company';

    // テナント情報とサブスクリプション状況を取得
    const tenantData = await c.env.DB.prepare(`
      SELECT 
        t.id, t.name, t.subdomain,
        t.plan_id, t.plan_started_at, t.plan_expires_at,
        t.created_at
      FROM tenants t
      WHERE t.subdomain = ? AND t.status = 'active'
    `).bind(tenantSubdomain).first();

    if (!tenantData) {
      return c.json({
        success: false,
        error: 'テナント情報が見つかりません'
      }, 404);
    }

    const currentPlan = PLANS[tenantData.plan_id as keyof typeof PLANS] || PLANS.free;
    
    // 利用状況を取得
    const usageStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(u.id) as current_users,
        COALESCE(SUM(LENGTH(u.display_name) + LENGTH(u.email)), 0) as storage_used
      FROM users u
      WHERE u.tenant_id = ? AND u.status = 'active'
    `).bind(tenantData.id).first();

    const planStartedAt = tenantData.plan_started_at ? new Date(tenantData.plan_started_at) : new Date(tenantData.created_at);
    const planExpiresAt = tenantData.plan_expires_at ? new Date(tenantData.plan_expires_at) : null;
    
    // 残り日数計算
    const now = new Date();
    const daysRemaining = planExpiresAt ? Math.ceil((planExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : -1;

    return c.json({
      success: true,
      tenant: {
        id: tenantData.id,
        name: tenantData.name,
        subdomain: tenantData.subdomain
      },
      subscription: {
        currentPlan: currentPlan,
        planStartedAt: planStartedAt.toISOString(),
        planExpiresAt: planExpiresAt?.toISOString() || null,
        daysRemaining: daysRemaining,
        isExpired: planExpiresAt ? now > planExpiresAt : false,
        isTrialPeriod: currentPlan.id === 'free'
      },
      usage: {
        currentUsers: usageStats?.current_users || 0,
        maxUsers: currentPlan.maxUsers,
        storageUsed: Math.ceil((usageStats?.storage_used || 0) / (1024 * 1024)), // MB
        maxStorage: currentPlan.maxStorage * 1024 // MB
      },
      limits: {
        userLimitReached: currentPlan.maxUsers > 0 && (usageStats?.current_users || 0) >= currentPlan.maxUsers,
        storageLimitReached: currentPlan.maxStorage > 0 && 
          Math.ceil((usageStats?.storage_used || 0) / (1024 * 1024 * 1024)) >= currentPlan.maxStorage
      }
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    return c.json({
      success: false,
      error: 'サブスクリプション状況の取得中にエラーが発生しました'
    }, 500);
  }
});

/**
 * プランアップグレード実行
 * POST /api/upgrade/change-plan
 */
upgrade.post('/change-plan', async (c) => {
  try {
    const { planId } = await c.req.json();

    if (!planId || !PLANS[planId as keyof typeof PLANS]) {
      return c.json({
        success: false,
        error: '無効なプランが選択されました'
      }, 400);
    }

    const tenantSubdomain = c.get('tenantSubdomain') || 'demo-company';
    const newPlan = PLANS[planId as keyof typeof PLANS];

    // 現在のテナント情報を取得
    const tenantData = await c.env.DB.prepare(`
      SELECT id, plan_id FROM tenants 
      WHERE subdomain = ? AND status = 'active'
    `).bind(tenantSubdomain).first();

    if (!tenantData) {
      return c.json({
        success: false,
        error: 'テナント情報が見つかりません'
      }, 404);
    }

    const currentPlan = PLANS[tenantData.plan_id as keyof typeof PLANS] || PLANS.free;

    // ダウングレード制限チェック
    if (newPlan.maxUsers > 0 && newPlan.maxUsers < (currentPlan.maxUsers || 0)) {
      const currentUsers = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE tenant_id = ? AND status = 'active'
      `).bind(tenantData.id).first();

      if ((currentUsers?.count || 0) > newPlan.maxUsers) {
        return c.json({
          success: false,
          error: `現在のユーザー数（${currentUsers?.count}名）が新しいプランの上限（${newPlan.maxUsers}名）を超えています`
        }, 400);
      }
    }

    const now = new Date();
    let planExpiresAt = null;

    // 有効期限設定
    if (newPlan.duration > 0) {
      planExpiresAt = new Date(now.getTime() + (newPlan.duration * 24 * 60 * 60 * 1000));
    }

    // テナントのプラン情報を更新
    await c.env.DB.prepare(`
      UPDATE tenants 
      SET 
        plan_id = ?,
        plan_started_at = ?,
        plan_expires_at = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      planId,
      now.toISOString(),
      planExpiresAt?.toISOString() || null,
      now.toISOString(),
      tenantData.id
    ).run();

    // プラン変更履歴を記録
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action_type, target_type, target_id,
        payload, ip_address, user_agent, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenantData.id,
      null, // System action - no specific user
      'plan_changed',
      'tenant',
      tenantData.id,
      JSON.stringify({
        from_plan: currentPlan.id,
        to_plan: planId,
        price: newPlan.price
      }),
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      'success'
    ).run();

    return c.json({
      success: true,
      message: `プランが${newPlan.displayName}に変更されました`,
      newPlan: newPlan,
      planExpiresAt: planExpiresAt?.toISOString() || null
    });

  } catch (error) {
    console.error('Plan change error:', error);
    return c.json({
      success: false,
      error: 'プラン変更中にエラーが発生しました',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * プラン変更履歴取得
 * GET /api/upgrade/history
 */
upgrade.get('/history', async (c) => {
  try {
    const tenantSubdomain = c.get('tenantSubdomain') || 'demo-company';

    // テナントID取得
    const tenantData = await c.env.DB.prepare(`
      SELECT id FROM tenants WHERE subdomain = ? AND status = 'active'
    `).bind(tenantSubdomain).first();

    if (!tenantData) {
      return c.json({
        success: false,
        error: 'テナント情報が見つかりません'
      }, 404);
    }

    // プラン変更履歴を取得
    const history = await c.env.DB.prepare(`
      SELECT 
        al.action_type, al.payload, al.created_at,
        u.display_name as actor_name
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_user_id = u.id
      WHERE al.tenant_id = ? 
        AND al.action_type = 'plan_changed'
        AND al.result = 'success'
      ORDER BY al.created_at DESC
      LIMIT 50
    `).bind(tenantData.id).all();

    const formattedHistory = (history.results || []).map((record: any) => {
      const details = JSON.parse(record.payload || '{}');
      const fromPlan = PLANS[details.from_plan as keyof typeof PLANS];
      const toPlan = PLANS[details.to_plan as keyof typeof PLANS];

      return {
        date: record.created_at,
        fromPlan: fromPlan || { id: details.from_plan, displayName: '不明' },
        toPlan: toPlan || { id: details.to_plan, displayName: '不明' },
        price: details.price || 0,
        actorName: record.actor_name || 'システム'
      };
    });

    return c.json({
      success: true,
      history: formattedHistory
    });

  } catch (error) {
    console.error('Plan history error:', error);
    return c.json({
      success: false,
      error: 'プラン履歴の取得中にエラーが発生しました'
    }, 500);
  }
});

export default upgrade;