import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const aiAnalysisApi = new Hono<{ Bindings: CloudflareBindings }>();

// AI分析カテゴリの定義
const ANALYSIS_CATEGORIES = {
  loading_efficiency: '積載効率最適化',
  warehouse_operations: '庫内作業効率化',
  delivery_route: '配送ルート最適化',
  cost_optimization: 'コスト削減提案',
  demand_forecast: '需要予測分析',
  inventory_optimization: '在庫最適化'
};

// AI分析リクエストの作成
aiAnalysisApi.post('/analyze', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const body = await c.req.json();
    const { category, data_source_id, parameters } = body;

    if (!category || !ANALYSIS_CATEGORIES[category as keyof typeof ANALYSIS_CATEGORIES]) {
      return c.json({ success: false, message: '無効なカテゴリです' }, 400);
    }

    // 分析IDの生成
    const analysisId = crypto.randomUUID();
    const now = new Date().toISOString();

    // TODO: 実際のAI分析処理（外部APIまたは内部アルゴリズム）
    // ここでは仮の分析結果を生成
    const mockAnalysisResult = generateMockAnalysis(category);

    // データベースに分析結果を保存
    const stmt = c.env.DB.prepare(`
      INSERT INTO ai_analysis_results (
        id, tenant_id, user_id, category, data_source_id,
        analysis_parameters, result_summary, result_details,
        confidence_score, recommendations, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      analysisId,
      user.tenant_id,
      user.id,
      category,
      data_source_id || null,
      JSON.stringify(parameters || {}),
      mockAnalysisResult.summary,
      JSON.stringify(mockAnalysisResult.details),
      mockAnalysisResult.confidence,
      JSON.stringify(mockAnalysisResult.recommendations),
      'completed',
      now,
      now
    ).run();

    return c.json({
      success: true,
      analysis_id: analysisId,
      category,
      result: mockAnalysisResult,
      message: 'AI分析が完了しました'
    });

  } catch (error) {
    console.error('AI analysis error:', error);
    return c.json({ success: false, message: 'AI分析処理に失敗しました' }, 500);
  }
});

// 分析結果の取得
aiAnalysisApi.get('/results', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const category = c.req.query('category');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    let query = `
      SELECT 
        a.id, a.category, a.result_summary, a.confidence_score,
        a.status, a.created_at, a.updated_at,
        u.display_name as user_name
      FROM ai_analysis_results a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.tenant_id = ?
    `;

    const params: any[] = [user.tenant_id];

    if (category) {
      query += ' AND a.category = ?';
      params.push(category);
    }

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();

    return c.json({
      success: true,
      results: result.results,
      total: result.results.length,
      categories: ANALYSIS_CATEGORIES
    });

  } catch (error) {
    console.error('Results fetch error:', error);
    return c.json({ success: false, message: '分析結果の取得に失敗しました' }, 500);
  }
});

// 特定分析結果の詳細取得
aiAnalysisApi.get('/results/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const analysisId = c.req.param('id');

    const stmt = c.env.DB.prepare(`
      SELECT 
        a.*,
        u.display_name as user_name,
        u.email as user_email
      FROM ai_analysis_results a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ? AND a.tenant_id = ?
    `);

    const result = await stmt.bind(analysisId, user.tenant_id).first() as any;

    if (!result) {
      return c.json({ success: false, message: '分析結果が見つかりません' }, 404);
    }

    // JSON文字列をパース
    result.analysis_parameters = result.analysis_parameters ? JSON.parse(result.analysis_parameters) : {};
    result.result_details = result.result_details ? JSON.parse(result.result_details) : {};
    result.recommendations = result.recommendations ? JSON.parse(result.recommendations) : [];

    return c.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Result detail fetch error:', error);
    return c.json({ success: false, message: '詳細の取得に失敗しました' }, 500);
  }
});

// 分析結果の削除
aiAnalysisApi.delete('/results/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const analysisId = c.req.param('id');

    // テナント確認
    const checkStmt = c.env.DB.prepare(`
      SELECT id FROM ai_analysis_results WHERE id = ? AND tenant_id = ?
    `);
    const existing = await checkStmt.bind(analysisId, user.tenant_id).first();

    if (!existing) {
      return c.json({ success: false, message: '分析結果が見つかりません' }, 404);
    }

    // 削除
    const deleteStmt = c.env.DB.prepare(`
      DELETE FROM ai_analysis_results WHERE id = ? AND tenant_id = ?
    `);
    await deleteStmt.bind(analysisId, user.tenant_id).run();

    return c.json({
      success: true,
      message: '分析結果を削除しました'
    });

  } catch (error) {
    console.error('Result delete error:', error);
    return c.json({ success: false, message: '削除に失敗しました' }, 500);
  }
});

// 分析統計の取得
aiAnalysisApi.get('/stats', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const stmt = c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_analyses,
        AVG(confidence_score) as avg_confidence,
        category,
        COUNT(*) as category_count
      FROM ai_analysis_results
      WHERE tenant_id = ?
      GROUP BY category
    `);

    const result = await stmt.bind(user.tenant_id).all();

    // 総数を計算
    const totalStmt = c.env.DB.prepare(`
      SELECT COUNT(*) as total FROM ai_analysis_results WHERE tenant_id = ?
    `);
    const totalResult = await totalStmt.bind(user.tenant_id).first() as any;

    return c.json({
      success: true,
      total_analyses: totalResult?.total || 0,
      by_category: result.results,
      categories: ANALYSIS_CATEGORIES
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    return c.json({ success: false, message: '統計の取得に失敗しました' }, 500);
  }
});

// カテゴリ一覧の取得
aiAnalysisApi.get('/categories', (c) => {
  return c.json({
    success: true,
    categories: Object.entries(ANALYSIS_CATEGORIES).map(([key, label]) => ({
      key,
      label
    }))
  });
});

// モック分析結果の生成（実際のAI APIに置き換える）
function generateMockAnalysis(category: string) {
  const categoryTemplates: Record<string, any> = {
    loading_efficiency: {
      summary: '積載効率が現在72%から最大89%まで改善可能です。推奨される積載パターンの変更により、年間約340万円のコスト削減が見込まれます。',
      confidence: 0.87,
      details: {
        current_efficiency: 72,
        potential_efficiency: 89,
        improvement_percentage: 17,
        estimated_savings: 3400000,
        key_factors: [
          '荷物サイズの最適化',
          '積載順序の改善',
          'スペース活用率の向上'
        ]
      },
      recommendations: [
        {
          title: '積載パターンの変更',
          description: '大型荷物を先に積み込み、小型荷物で空きスペースを埋める方式に変更',
          priority: 'high',
          estimated_impact: '効率+12%'
        },
        {
          title: 'パレット配置の最適化',
          description: '重量バランスを考慮したパレット配置により安全性と積載率を向上',
          priority: 'medium',
          estimated_impact: '効率+5%'
        }
      ]
    },
    warehouse_operations: {
      summary: '庫内作業の動線を最適化することで、作業時間を平均23%削減できます。ピッキング効率が特に改善の余地があります。',
      confidence: 0.82,
      details: {
        current_efficiency: 68,
        potential_efficiency: 91,
        time_reduction_percentage: 23,
        focus_areas: [
          'ピッキング動線の最適化',
          '在庫配置の見直し',
          '作業員配置の改善'
        ]
      },
      recommendations: [
        {
          title: 'ABC分析に基づく在庫配置',
          description: '出荷頻度の高い商品を出入口近くに配置',
          priority: 'high',
          estimated_impact: '作業時間-15%'
        },
        {
          title: 'ピッキングルートの最適化',
          description: 'AIによる最短ルート提案システムの導入',
          priority: 'medium',
          estimated_impact: '作業時間-8%'
        }
      ]
    },
    delivery_route: {
      summary: '配送ルートの最適化により、配送時間を18%短縮し、燃料コストを年間約280万円削減できます。',
      confidence: 0.91,
      details: {
        current_total_distance: 3200,
        optimized_distance: 2624,
        distance_reduction: 576,
        estimated_fuel_savings: 2800000,
        time_savings_hours: 124
      },
      recommendations: [
        {
          title: '配送順序の最適化',
          description: '時間指定配送を優先し、地域別クラスタリングを実施',
          priority: 'high',
          estimated_impact: '時間-12%'
        },
        {
          title: '動的ルート変更システム',
          description: 'リアルタイム交通情報に基づく柔軟なルート変更',
          priority: 'medium',
          estimated_impact: '時間-6%'
        }
      ]
    },
    cost_optimization: {
      summary: '物流コストの総合的な見直しにより、年間約520万円のコスト削減が可能です。',
      confidence: 0.85,
      details: {
        current_annual_cost: 28000000,
        potential_savings: 5200000,
        savings_percentage: 18.6,
        cost_breakdown: {
          transportation: 45,
          warehouse: 30,
          labor: 25
        }
      },
      recommendations: [
        {
          title: '共同配送の検討',
          description: '同業他社との共同配送により配送コストを削減',
          priority: 'high',
          estimated_impact: '¥2.8M/年'
        },
        {
          title: '外注先の見直し',
          description: 'より競争力のある外注先への切り替え',
          priority: 'medium',
          estimated_impact: '¥1.5M/年'
        }
      ]
    },
    demand_forecast: {
      summary: '過去3年間のデータ分析により、次四半期の需要を高精度で予測。在庫の過不足を最小化できます。',
      confidence: 0.88,
      details: {
        forecast_period: '2025 Q2',
        predicted_demand_increase: 12.5,
        seasonal_factors: [
          '3月末の年度末需要',
          'GW前の駆け込み需要',
          '新製品発売の影響'
        ],
        inventory_recommendations: {
          increase_items: 15,
          decrease_items: 8,
          maintain_items: 27
        }
      },
      recommendations: [
        {
          title: '主要商品の在庫増強',
          description: '需要増加が見込まれる15品目の在庫を20-30%増加',
          priority: 'high',
          estimated_impact: '欠品リスク-80%'
        },
        {
          title: '低回転商品の在庫削減',
          description: '需要減少傾向の8品目の発注量を調整',
          priority: 'medium',
          estimated_impact: '在庫コスト-¥1.2M'
        }
      ]
    },
    inventory_optimization: {
      summary: '在庫回転率を現在の6.2回/年から8.5回/年に改善可能。過剰在庫の削減により約380万円の資金を解放できます。',
      confidence: 0.83,
      details: {
        current_turnover: 6.2,
        optimal_turnover: 8.5,
        excess_inventory_value: 3800000,
        stockout_risk: 'low',
        key_issues: [
          '長期滞留在庫の存在',
          '発注ロットの最適化不足',
          '需要予測精度の改善余地'
        ]
      },
      recommendations: [
        {
          title: '長期滞留在庫の処分',
          description: '90日以上滞留している商品の値引き販売または廃棄',
          priority: 'high',
          estimated_impact: '¥2.5M資金回収'
        },
        {
          title: '発注ロットサイズの最適化',
          description: 'EOQ (経済的発注量) に基づく発注量の見直し',
          priority: 'medium',
          estimated_impact: '在庫コスト-15%'
        }
      ]
    }
  };

  return categoryTemplates[category] || categoryTemplates.loading_efficiency;
}

export default aiAnalysisApi;
