// システム監視API
import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const systemMonitoring = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * 最新メトリクス取得
 * GET /api/admin/system-monitoring/metrics/latest
 */
systemMonitoring.get('/metrics/latest', async (c) => {
  try {
    const metrics = await c.env.DB.prepare(`
      SELECT * FROM latest_system_metrics
      ORDER BY service_name, metric_type
    `).all();

    return c.json({
      success: true,
      data: metrics.results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch latest metrics:', error);
    return c.json({
      success: false,
      error: 'メトリクス取得エラー'
    }, 500);
  }
});

/**
 * サービス別メトリクス取得
 * GET /api/admin/system-monitoring/metrics/by-service/:serviceName
 */
systemMonitoring.get('/metrics/by-service/:serviceName', async (c) => {
  try {
    const serviceName = c.req.param('serviceName');
    const hours = parseInt(c.req.query('hours') || '1');

    const metrics = await c.env.DB.prepare(`
      SELECT *
      FROM system_metrics
      WHERE service_name = ?
        AND recorded_at > datetime('now', '-' || ? || ' hours')
      ORDER BY recorded_at DESC
      LIMIT 100
    `).bind(serviceName, hours).all();

    return c.json({
      success: true,
      service_name: serviceName,
      data: metrics.results,
      count: metrics.results.length
    });
  } catch (error) {
    console.error('Failed to fetch service metrics:', error);
    return c.json({
      success: false,
      error: 'サービスメトリクス取得エラー'
    }, 500);
  }
});

/**
 * メトリクスタイプ別時系列データ取得
 * GET /api/admin/system-monitoring/metrics/timeseries
 */
systemMonitoring.get('/metrics/timeseries', async (c) => {
  try {
    const metricType = c.req.query('metric_type') || 'cpu';
    const serviceName = c.req.query('service_name') || 'overall';
    const hours = parseInt(c.req.query('hours') || '1');

    const metrics = await c.env.DB.prepare(`
      SELECT 
        recorded_at,
        value,
        status,
        unit
      FROM system_metrics
      WHERE metric_type = ?
        AND service_name = ?
        AND recorded_at > datetime('now', '-' || ? || ' hours')
      ORDER BY recorded_at ASC
    `).bind(metricType, serviceName, hours).all();

    return c.json({
      success: true,
      metric_type: metricType,
      service_name: serviceName,
      data: metrics.results
    });
  } catch (error) {
    console.error('Failed to fetch timeseries metrics:', error);
    return c.json({
      success: false,
      error: '時系列データ取得エラー'
    }, 500);
  }
});

/**
 * アクティブアラート取得
 * GET /api/admin/system-monitoring/alerts/active
 */
systemMonitoring.get('/alerts/active', async (c) => {
  try {
    const alerts = await c.env.DB.prepare(`
      SELECT * FROM active_system_alerts
      LIMIT 50
    `).all();

    // 重要度別カウント
    const criticalCount = alerts.results.filter((a: any) => a.severity === 'critical').length;
    const warningCount = alerts.results.filter((a: any) => a.severity === 'warning').length;
    const infoCount = alerts.results.filter((a: any) => a.severity === 'info').length;

    return c.json({
      success: true,
      alerts: alerts.results,
      summary: {
        total: alerts.results.length,
        critical: criticalCount,
        warning: warningCount,
        info: infoCount
      }
    });
  } catch (error) {
    console.error('Failed to fetch active alerts:', error);
    return c.json({
      success: false,
      error: 'アラート取得エラー'
    }, 500);
  }
});

/**
 * アラート確認
 * POST /api/admin/system-monitoring/alerts/:alertId/acknowledge
 */
systemMonitoring.post('/alerts/:alertId/acknowledge', async (c) => {
  try {
    const alertId = c.req.param('alertId');
    const userId = c.get('userId') || 'system';

    await c.env.DB.prepare(`
      UPDATE system_alerts
      SET 
        status = 'acknowledged',
        acknowledged_by = ?,
        acknowledged_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(userId, alertId).run();

    return c.json({
      success: true,
      message: 'アラートを確認しました'
    });
  } catch (error) {
    console.error('Failed to acknowledge alert:', error);
    return c.json({
      success: false,
      error: 'アラート確認エラー'
    }, 500);
  }
});

/**
 * アラート解決
 * POST /api/admin/system-monitoring/alerts/:alertId/resolve
 */
systemMonitoring.post('/alerts/:alertId/resolve', async (c) => {
  try {
    const alertId = c.req.param('alertId');

    await c.env.DB.prepare(`
      UPDATE system_alerts
      SET 
        status = 'resolved',
        resolved_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(alertId).run();

    return c.json({
      success: true,
      message: 'アラートを解決しました'
    });
  } catch (error) {
    console.error('Failed to resolve alert:', error);
    return c.json({
      success: false,
      error: 'アラート解決エラー'
    }, 500);
  }
});

/**
 * システムヘルスチェック
 * GET /api/admin/system-monitoring/health
 */
systemMonitoring.get('/health', async (c) => {
  try {
    // 最新のヘルスチェック結果を取得
    const healthLogs = await c.env.DB.prepare(`
      SELECT 
        service_name,
        status,
        response_time,
        created_at
      FROM system_health_logs
      WHERE created_at > datetime('now', '-5 minutes')
      ORDER BY created_at DESC
      LIMIT 20
    `).all();

    // サービス別の最新ステータス
    const serviceStatus: { [key: string]: any } = {};
    for (const log of healthLogs.results) {
      const service = (log as any).service_name;
      if (!serviceStatus[service]) {
        serviceStatus[service] = log;
      }
    }

    // 全体のヘルスステータス判定
    const allHealthy = Object.values(serviceStatus).every((s: any) => s.status === 'healthy');
    const anyDown = Object.values(serviceStatus).some((s: any) => s.status === 'down');
    
    let overallStatus = 'healthy';
    if (anyDown) overallStatus = 'down';
    else if (!allHealthy) overallStatus = 'degraded';

    return c.json({
      success: true,
      overall_status: overallStatus,
      services: serviceStatus,
      last_check: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch health status:', error);
    return c.json({
      success: false,
      error: 'ヘルスチェック取得エラー'
    }, 500);
  }
});

/**
 * サマリー統計取得
 * GET /api/admin/system-monitoring/summary
 */
systemMonitoring.get('/summary', async (c) => {
  try {
    // 各メトリクスタイプの平均値を計算
    const summary = await c.env.DB.prepare(`
      SELECT 
        metric_type,
        service_name,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value,
        unit
      FROM system_metrics
      WHERE recorded_at > datetime('now', '-1 hour')
      GROUP BY metric_type, service_name, unit
      ORDER BY service_name, metric_type
    `).all();

    // アラートサマリー
    const alertSummary = await c.env.DB.prepare(`
      SELECT 
        severity,
        COUNT(*) as count
      FROM system_alerts
      WHERE status = 'active'
      GROUP BY severity
    `).all();

    // システム稼働率
    const uptime = await c.env.DB.prepare(`
      SELECT value
      FROM system_metrics
      WHERE metric_type = 'uptime'
        AND service_name = 'overall'
      ORDER BY recorded_at DESC
      LIMIT 1
    `).first();

    return c.json({
      success: true,
      metrics_summary: summary.results,
      alert_summary: alertSummary.results,
      uptime: uptime ? (uptime as any).value : null,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch summary:', error);
    return c.json({
      success: false,
      error: 'サマリー取得エラー'
    }, 500);
  }
});

export default systemMonitoring;
