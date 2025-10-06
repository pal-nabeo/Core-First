// ライセンス管理API
import { Hono } from 'hono'

type Bindings = {
  DB: D1Database;
}

const licensesApi = new Hono<{ Bindings: Bindings }>()

// ライセンス統計情報取得
licensesApi.get('/stats', async (c) => {
  try {
    // テナントのライセンス制限を取得
    const testTenantId = 'tenant_abc_logistics';
    const tenantResult = await c.env.DB.prepare(`
      SELECT max_users, license_type, license_expires_at
      FROM tenants 
      WHERE id = ? AND status = 'active'
    `).bind(testTenantId).first(); // TODO: テナントIDを動的に取得

    if (!tenantResult) {
      return c.json({
        success: false,
        error: 'テナント情報が見つかりません'
      }, 404);
    }

    // 現在のアクティブユーザー数
    const activeUsersResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE tenant_id = ? AND status = 'active'
    `).bind(testTenantId).first();

    // 今日のアクティブユーザー数（ログイン実績ベース）
    const todayActiveUsersResult = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT actor_user_id) as count FROM audit_logs 
      WHERE tenant_id = ? AND action_type = 'login' 
      AND DATE(created_at) = DATE('now')
    `).bind(testTenantId).first();

    // 過去30日間のユーザー数推移
    const userTrendResult = await c.env.DB.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users,
        (SELECT COUNT(*) FROM users u2 
         WHERE u2.tenant_id = 1 AND u2.status = 'active' 
         AND DATE(u2.created_at) <= DATE(al.created_at)
        ) as cumulative_users
      FROM audit_logs al
      WHERE al.tenant_id = ? AND al.action = 'user_created'
      AND DATE(al.created_at) >= DATE('now', '-30 days')
      GROUP BY DATE(al.created_at)
      ORDER BY date DESC
      LIMIT 30
    `).bind(1).all();

    // ライセンス使用率計算
    const maxUsers = tenantResult.max_users || 100;
    const currentUsers = activeUsersResult?.count || 0;
    const usagePercentage = Math.round((currentUsers / maxUsers) * 100);

    // ライセンス期限チェック
    const licenseExpiresAt = tenantResult.license_expires_at;
    let daysUntilExpiry = null;
    if (licenseExpiresAt) {
      const expiryDate = new Date(licenseExpiresAt);
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // 警告レベル判定
    let warningLevel = 'normal';
    if (usagePercentage >= 90) {
      warningLevel = 'critical';
    } else if (usagePercentage >= 80) {
      warningLevel = 'warning';
    }

    if (daysUntilExpiry && daysUntilExpiry <= 30) {
      warningLevel = 'critical';
    } else if (daysUntilExpiry && daysUntilExpiry <= 60) {
      if (warningLevel === 'normal') warningLevel = 'warning';
    }

    return c.json({
      success: true,
      data: {
        license_info: {
          type: tenantResult.license_type,
          max_users: maxUsers,
          current_users: currentUsers,
          available_licenses: Math.max(0, maxUsers - currentUsers),
          usage_percentage: usagePercentage,
          expires_at: licenseExpiresAt,
          days_until_expiry: daysUntilExpiry,
          warning_level: warningLevel
        },
        activity_stats: {
          today_active_users: todayActiveUsersResult?.count || 0,
          user_trend: userTrendResult.results || []
        }
      }
    });

  } catch (error) {
    console.error('Error fetching license statistics:', error);
    return c.json({
      success: false,
      error: 'ライセンス統計の取得に失敗しました'
    }, 500);
  }
});

// ライセンス使用状況履歴取得
licensesApi.get('/usage-history', async (c) => {
  try {
    const { period = '30' } = c.req.query();
    const days = parseInt(period);

    // 日別アクティブユーザー数
    const dailyUsageResult = await c.env.DB.prepare(`
      WITH RECURSIVE date_range(date) AS (
        SELECT DATE('now', '-${days} days')
        UNION ALL
        SELECT DATE(date, '+1 day')
        FROM date_range
        WHERE date < DATE('now')
      )
      SELECT 
        dr.date,
        COALESCE(daily_logins.active_users, 0) as active_users,
        COALESCE(daily_new.new_users, 0) as new_users
      FROM date_range dr
      LEFT JOIN (
        SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT user_id) as active_users
        FROM audit_logs 
        WHERE tenant_id = ? AND action = 'login'
        AND DATE(created_at) >= DATE('now', '-${days} days')
        GROUP BY DATE(created_at)
      ) daily_logins ON dr.date = daily_logins.date
      LEFT JOIN (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_users
        FROM users
        WHERE tenant_id = ? AND status != 'deleted'
        AND DATE(created_at) >= DATE('now', '-${days} days')
        GROUP BY DATE(created_at)
      ) daily_new ON dr.date = daily_new.date
      ORDER BY dr.date
    `).bind(1, 1).all();

    // 時間別使用状況（今日分）
    const hourlyUsageResult = await c.env.DB.prepare(`
      SELECT 
        strftime('%H', created_at) as hour,
        COUNT(DISTINCT user_id) as active_users
      FROM audit_logs
      WHERE tenant_id = ? 
      AND action IN ('login', 'api_call', 'page_view')
      AND DATE(created_at) = DATE('now')
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `).bind(1).all();

    return c.json({
      success: true,
      data: {
        daily_usage: dailyUsageResult.results || [],
        hourly_usage: hourlyUsageResult.results || []
      }
    });

  } catch (error) {
    console.error('Error fetching usage history:', error);
    return c.json({
      success: false,
      error: 'ライセンス使用履歴の取得に失敗しました'
    }, 500);
  }
});

// ライセンス制限更新
licensesApi.put('/limits', async (c) => {
  try {
    const { max_users, license_type, license_expires_at } = await c.req.json();

    // バリデーション
    if (max_users && (max_users < 1 || max_users > 10000)) {
      return c.json({
        success: false,
        error: 'ユーザー数制限は1〜10000の範囲で設定してください'
      }, 400);
    }

    const validLicenseTypes = ['trial', 'basic', 'premium', 'enterprise'];
    if (license_type && !validLicenseTypes.includes(license_type)) {
      return c.json({
        success: false,
        error: '無効なライセンスタイプです'
      }, 400);
    }

    // 現在の設定を取得
    const currentSettings = await c.env.DB.prepare(`
      SELECT max_users, license_type, license_expires_at
      FROM tenants WHERE id = ?
    `).bind(1).first();

    if (!currentSettings) {
      return c.json({
        success: false,
        error: 'テナントが見つかりません'
      }, 404);
    }

    // ライセンス制限更新
    const updateResult = await c.env.DB.prepare(`
      UPDATE tenants 
      SET max_users = COALESCE(?, max_users),
          license_type = COALESCE(?, license_type),
          license_expires_at = COALESCE(?, license_expires_at),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      max_users || null,
      license_type || null, 
      license_expires_at || null,
      1
    ).run();

    if (!updateResult.success) {
      return c.json({
        success: false,
        error: 'ライセンス設定の更新に失敗しました'
      }, 500);
    }

    // 変更ログ記録
    const changes = [];
    if (max_users && max_users !== currentSettings.max_users) {
      changes.push(`Max users: ${currentSettings.max_users} → ${max_users}`);
    }
    if (license_type && license_type !== currentSettings.license_type) {
      changes.push(`License type: ${currentSettings.license_type} → ${license_type}`);
    }
    if (license_expires_at && license_expires_at !== currentSettings.license_expires_at) {
      changes.push(`Expiry: ${currentSettings.license_expires_at} → ${license_expires_at}`);
    }

    if (changes.length > 0) {
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, tenant_id, action, details, ip_address, user_agent)
        VALUES (?, ?, 'license_updated', ?, ?, ?)
      `).bind(
        null, // TODO: セッションから管理者IDを取得
        1,
        changes.join('; '),
        c.req.header('CF-Connecting-IP') || 'unknown',
        c.req.header('User-Agent') || 'unknown'
      ).run();
    }

    // 更新後の設定を返す
    const updatedSettings = await c.env.DB.prepare(`
      SELECT max_users, license_type, license_expires_at, updated_at
      FROM tenants WHERE id = ?
    `).bind(1).first();

    return c.json({
      success: true,
      message: 'ライセンス設定が正常に更新されました',
      data: updatedSettings
    });

  } catch (error) {
    console.error('Error updating license limits:', error);
    return c.json({
      success: false,
      error: 'ライセンス設定の更新中にエラーが発生しました'
    }, 500);
  }
});

// ライセンス使用量チェック
licensesApi.post('/check-usage', async (c) => {
  try {
    // 現在のライセンス情報を取得
    const licenseInfo = await c.env.DB.prepare(`
      SELECT max_users, license_expires_at FROM tenants WHERE id = ?
    `).bind(1).first();

    if (!licenseInfo) {
      return c.json({
        success: false,
        error: 'ライセンス情報が見つかりません'
      }, 404);
    }

    // アクティブユーザー数を取得
    const activeUsersResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE tenant_id = ? AND status = 'active'
    `).bind(1).first();

    const currentUsers = activeUsersResult?.count || 0;
    const maxUsers = licenseInfo.max_users || 0;

    // ライセンス期限チェック
    let isExpired = false;
    let daysUntilExpiry = null;
    if (licenseInfo.license_expires_at) {
      const expiryDate = new Date(licenseInfo.license_expires_at);
      const now = new Date();
      isExpired = expiryDate < now;
      
      if (!isExpired) {
        const diffTime = expiryDate.getTime() - now.getTime();
        daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // 使用量超過チェック
    const isOverLimit = currentUsers > maxUsers;
    const usagePercentage = Math.round((currentUsers / maxUsers) * 100);

    // 警告レベル判定
    let warnings = [];
    
    if (isExpired) {
      warnings.push({
        level: 'critical',
        message: 'ライセンスが期限切れです',
        action: 'ライセンスを更新してください'
      });
    } else if (daysUntilExpiry && daysUntilExpiry <= 7) {
      warnings.push({
        level: 'critical', 
        message: `ライセンス期限まで${daysUntilExpiry}日です`,
        action: 'ライセンス更新の準備を行ってください'
      });
    } else if (daysUntilExpiry && daysUntilExpiry <= 30) {
      warnings.push({
        level: 'warning',
        message: `ライセンス期限まで${daysUntilExpiry}日です`,
        action: 'ライセンス更新をご検討ください'
      });
    }

    if (isOverLimit) {
      warnings.push({
        level: 'critical',
        message: `ユーザー数が上限を超過しています (${currentUsers}/${maxUsers})`,
        action: 'ライセンスをアップグレードするか、不要なユーザーを削除してください'
      });
    } else if (usagePercentage >= 90) {
      warnings.push({
        level: 'warning',
        message: `ライセンス使用率が90%を超えています (${currentUsers}/${maxUsers})`,
        action: 'ライセンスのアップグレードをご検討ください'
      });
    }

    return c.json({
      success: true,
      data: {
        license_status: {
          is_valid: !isExpired && !isOverLimit,
          is_expired: isExpired,
          is_over_limit: isOverLimit,
          current_users: currentUsers,
          max_users: maxUsers,
          usage_percentage: usagePercentage,
          expires_at: licenseInfo.license_expires_at,
          days_until_expiry: daysUntilExpiry
        },
        warnings: warnings
      }
    });

  } catch (error) {
    console.error('Error checking license usage:', error);
    return c.json({
      success: false,
      error: 'ライセンス使用量チェックに失敗しました'
    }, 500);
  }
});

// ライセンス違反アラート取得
licensesApi.get('/alerts', async (c) => {
  try {
    const alerts = [];

    // ライセンス使用量チェック
    const usageCheck = await c.env.DB.prepare(`
      SELECT 
        t.max_users,
        t.license_expires_at,
        COUNT(u.id) as current_users
      FROM tenants t
      LEFT JOIN users u ON t.id = u.tenant_id AND u.status = 'active'
      WHERE t.id = ?
      GROUP BY t.id
    `).bind(1).first();

    if (usageCheck) {
      const { max_users, license_expires_at, current_users } = usageCheck;
      const usagePercentage = (current_users / max_users) * 100;

      // 使用量アラート
      if (current_users > max_users) {
        alerts.push({
          id: 'usage_exceeded',
          type: 'license_violation',
          severity: 'critical',
          title: 'ライセンス上限超過',
          message: `アクティブユーザー数が上限を超過しています (${current_users}/${max_users})`,
          created_at: new Date().toISOString(),
          actions: [
            { label: 'ライセンス追加', action: 'upgrade_license' },
            { label: 'ユーザー無効化', action: 'deactivate_users' }
          ]
        });
      } else if (usagePercentage >= 90) {
        alerts.push({
          id: 'usage_warning',
          type: 'license_warning',
          severity: 'warning',
          title: 'ライセンス使用率高',
          message: `ライセンス使用率が${Math.round(usagePercentage)}%に達しています`,
          created_at: new Date().toISOString(),
          actions: [
            { label: 'ライセンス追加', action: 'upgrade_license' }
          ]
        });
      }

      // 期限アラート
      if (license_expires_at) {
        const expiryDate = new Date(license_expires_at);
        const now = new Date();
        const diffTime = expiryDate.getTime() - now.getTime();
        const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry <= 0) {
          alerts.push({
            id: 'license_expired',
            type: 'license_violation',
            severity: 'critical',
            title: 'ライセンス期限切れ',
            message: 'ライセンスの有効期限が切れています',
            created_at: new Date().toISOString(),
            actions: [
              { label: 'ライセンス更新', action: 'renew_license' }
            ]
          });
        } else if (daysUntilExpiry <= 7) {
          alerts.push({
            id: 'license_expiring_soon',
            type: 'license_warning',
            severity: 'critical',
            title: 'ライセンス期限間近',
            message: `ライセンスの有効期限まで${daysUntilExpiry}日です`,
            created_at: new Date().toISOString(),
            actions: [
              { label: 'ライセンス更新', action: 'renew_license' }
            ]
          });
        } else if (daysUntilExpiry <= 30) {
          alerts.push({
            id: 'license_expiring_warning',
            type: 'license_warning',
            severity: 'warning',
            title: 'ライセンス更新推奨',
            message: `ライセンスの有効期限まで${daysUntilExpiry}日です`,
            created_at: new Date().toISOString(),
            actions: [
              { label: 'ライセンス更新', action: 'renew_license' }
            ]
          });
        }
      }
    }

    // 最近の異常なアクティビティをチェック
    const suspiciousActivityResult = await c.env.DB.prepare(`
      SELECT 
        user_id,
        ip_address,
        COUNT(*) as login_attempts
      FROM audit_logs
      WHERE tenant_id = ? AND action = 'login_failed'
      AND created_at > datetime('now', '-1 hour')
      GROUP BY user_id, ip_address
      HAVING COUNT(*) >= 5
      ORDER BY login_attempts DESC
      LIMIT 5
    `).bind(1).all();

    if (suspiciousActivityResult.results && suspiciousActivityResult.results.length > 0) {
      alerts.push({
        id: 'suspicious_activity',
        type: 'security_warning',
        severity: 'warning',
        title: '不正ログイン試行検出',
        message: `複数の不正ログイン試行が検出されました`,
        created_at: new Date().toISOString(),
        details: suspiciousActivityResult.results,
        actions: [
          { label: 'ログを確認', action: 'view_audit_logs' },
          { label: 'IP制限設定', action: 'configure_ip_restrictions' }
        ]
      });
    }

    return c.json({
      success: true,
      data: {
        alerts: alerts,
        alert_count: alerts.length,
        critical_count: alerts.filter(a => a.severity === 'critical').length,
        warning_count: alerts.filter(a => a.severity === 'warning').length
      }
    });

  } catch (error) {
    console.error('Error fetching license alerts:', error);
    return c.json({
      success: false,
      error: 'アラート情報の取得に失敗しました'
    }, 500);
  }
});

export default licensesApi;