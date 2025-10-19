import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const chatAiApi = new Hono<{ Bindings: CloudflareBindings }>();

// チャットメッセージの送信
chatAiApi.post('/message', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const body = await c.req.json();
    const { message, context_id, context_data } = body;

    if (!message || message.trim().length === 0) {
      return c.json({ success: false, message: 'メッセージが空です' }, 400);
    }

    // メッセージIDの生成
    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    // コンテキストIDがない場合は新しく生成
    const actualContextId = context_id || crypto.randomUUID();

    // ユーザーメッセージを保存
    const userMsgStmt = c.env.DB.prepare(`
      INSERT INTO chat_history (
        id, tenant_id, user_id, context_id, message_type,
        message_content, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    await userMsgStmt.bind(
      messageId,
      user.tenant_id,
      user.id,
      actualContextId,
      'user',
      message,
      now
    ).run();

    // TODO: 実際のAI APIを呼び出す（OpenAI, Claude, Gemini等）
    // ここでは仮のAI応答を生成
    const aiResponse = await generateAIResponse(message, context_data);

    // AI応答を保存
    const aiMsgId = crypto.randomUUID();
    const aiMsgStmt = c.env.DB.prepare(`
      INSERT INTO chat_history (
        id, tenant_id, user_id, context_id, message_type,
        message_content, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await aiMsgStmt.bind(
      aiMsgId,
      user.tenant_id,
      user.id,
      actualContextId,
      'assistant',
      aiResponse.content,
      JSON.stringify({
        confidence: aiResponse.confidence,
        intent: aiResponse.intent,
        suggestions: aiResponse.suggestions
      }),
      now
    ).run();

    return c.json({
      success: true,
      message_id: messageId,
      context_id: actualContextId,
      response: {
        id: aiMsgId,
        content: aiResponse.content,
        confidence: aiResponse.confidence,
        intent: aiResponse.intent,
        suggestions: aiResponse.suggestions
      }
    });

  } catch (error) {
    console.error('Chat message error:', error);
    return c.json({ success: false, message: 'メッセージ送信に失敗しました' }, 500);
  }
});

// チャット履歴の取得
chatAiApi.get('/history', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const contextId = c.req.query('context_id');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    if (!contextId) {
      // コンテキスト一覧を取得
      const contextsStmt = c.env.DB.prepare(`
        SELECT 
          context_id,
          MIN(created_at) as first_message_at,
          MAX(created_at) as last_message_at,
          COUNT(*) as message_count
        FROM chat_history
        WHERE tenant_id = ? AND user_id = ?
        GROUP BY context_id
        ORDER BY MAX(created_at) DESC
        LIMIT ? OFFSET ?
      `);

      const result = await contextsStmt.bind(user.tenant_id, user.id, limit, offset).all();

      return c.json({
        success: true,
        contexts: result.results
      });
    } else {
      // 特定コンテキストのメッセージ履歴を取得
      const messagesStmt = c.env.DB.prepare(`
        SELECT 
          id, message_type, message_content, metadata,
          feedback_rating, created_at
        FROM chat_history
        WHERE tenant_id = ? AND user_id = ? AND context_id = ?
        ORDER BY created_at ASC
        LIMIT ? OFFSET ?
      `);

      const result = await messagesStmt.bind(
        user.tenant_id,
        user.id,
        contextId,
        limit,
        offset
      ).all();

      // メタデータをパース
      const messages = (result.results as any[]).map(msg => ({
        ...msg,
        metadata: msg.metadata ? JSON.parse(msg.metadata) : null
      }));

      return c.json({
        success: true,
        context_id: contextId,
        messages
      });
    }

  } catch (error) {
    console.error('History fetch error:', error);
    return c.json({ success: false, message: '履歴の取得に失敗しました' }, 500);
  }
});

// チャットコンテキストの削除
chatAiApi.delete('/context/:contextId', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const contextId = c.req.param('contextId');

    // テナント・ユーザー確認
    const checkStmt = c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM chat_history 
      WHERE context_id = ? AND tenant_id = ? AND user_id = ?
    `);
    const existing = await checkStmt.bind(contextId, user.tenant_id, user.id).first() as any;

    if (!existing || existing.count === 0) {
      return c.json({ success: false, message: 'チャット履歴が見つかりません' }, 404);
    }

    // 削除
    const deleteStmt = c.env.DB.prepare(`
      DELETE FROM chat_history 
      WHERE context_id = ? AND tenant_id = ? AND user_id = ?
    `);
    await deleteStmt.bind(contextId, user.tenant_id, user.id).run();

    return c.json({
      success: true,
      message: 'チャット履歴を削除しました'
    });

  } catch (error) {
    console.error('Context delete error:', error);
    return c.json({ success: false, message: '削除に失敗しました' }, 500);
  }
});

// フィードバックの送信
chatAiApi.post('/feedback', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const body = await c.req.json();
    const { message_id, rating, comment } = body;

    if (!message_id || rating === undefined) {
      return c.json({ success: false, message: 'メッセージIDと評価が必要です' }, 400);
    }

    // メッセージ存在確認
    const checkStmt = c.env.DB.prepare(`
      SELECT id FROM chat_history 
      WHERE id = ? AND tenant_id = ? AND message_type = 'assistant'
    `);
    const existing = await checkStmt.bind(message_id, user.tenant_id).first();

    if (!existing) {
      return c.json({ success: false, message: 'メッセージが見つかりません' }, 404);
    }

    // フィードバックを更新
    const updateStmt = c.env.DB.prepare(`
      UPDATE chat_history 
      SET feedback_rating = ?, feedback_comment = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `);

    await updateStmt.bind(
      rating,
      comment || null,
      new Date().toISOString(),
      message_id,
      user.tenant_id
    ).run();

    return c.json({
      success: true,
      message: 'フィードバックを送信しました'
    });

  } catch (error) {
    console.error('Feedback error:', error);
    return c.json({ success: false, message: 'フィードバック送信に失敗しました' }, 500);
  }
});

// チャット統計の取得
chatAiApi.get('/stats', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    // 総メッセージ数
    const totalStmt = c.env.DB.prepare(`
      SELECT COUNT(*) as total FROM chat_history 
      WHERE tenant_id = ? AND user_id = ?
    `);
    const totalResult = await totalStmt.bind(user.tenant_id, user.id).first() as any;

    // コンテキスト数
    const contextsStmt = c.env.DB.prepare(`
      SELECT COUNT(DISTINCT context_id) as total FROM chat_history 
      WHERE tenant_id = ? AND user_id = ?
    `);
    const contextsResult = await contextsStmt.bind(user.tenant_id, user.id).first() as any;

    // 平均評価
    const avgRatingStmt = c.env.DB.prepare(`
      SELECT AVG(feedback_rating) as avg_rating, COUNT(*) as rated_count
      FROM chat_history 
      WHERE tenant_id = ? AND user_id = ? AND feedback_rating IS NOT NULL
    `);
    const ratingResult = await avgRatingStmt.bind(user.tenant_id, user.id).first() as any;

    return c.json({
      success: true,
      total_messages: totalResult?.total || 0,
      total_conversations: contextsResult?.total || 0,
      average_rating: ratingResult?.avg_rating || null,
      rated_messages: ratingResult?.rated_count || 0
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    return c.json({ success: false, message: '統計の取得に失敗しました' }, 500);
  }
});

// クイック質問テンプレートの取得
chatAiApi.get('/quick-questions', (c) => {
  const quickQuestions = [
    {
      category: '配送効率',
      questions: [
        '今月の配送効率はどうですか？',
        '配送コストを削減する方法を教えてください',
        '遅延が多い配送ルートはどこですか？'
      ]
    },
    {
      category: '在庫管理',
      questions: [
        '在庫回転率を改善する方法は？',
        '過剰在庫が発生している商品は？',
        '欠品リスクが高い商品を教えてください'
      ]
    },
    {
      category: '庫内作業',
      questions: [
        'ピッキング効率を上げるには？',
        '作業時間が長い工程はどこですか？',
        '人員配置を最適化する方法は？'
      ]
    },
    {
      category: 'コスト分析',
      questions: [
        '物流コストの内訳を教えてください',
        'コスト削減の優先順位は？',
        '外注費用を最適化する方法は？'
      ]
    }
  ];

  return c.json({
    success: true,
    quick_questions: quickQuestions
  });
});

// モックAI応答の生成（実際のAI APIに置き換える）
async function generateAIResponse(message: string, contextData?: any) {
  // キーワードベースの簡易応答生成（実際はAI APIを使用）
  const lowercaseMsg = message.toLowerCase();
  
  let response = {
    content: '',
    confidence: 0.85,
    intent: 'general_inquiry',
    suggestions: [] as string[]
  };

  if (lowercaseMsg.includes('配送') || lowercaseMsg.includes('ルート')) {
    response.intent = 'delivery_optimization';
    response.content = `配送に関するご質問ですね。現在の配送データを分析したところ、以下の改善ポイントが見つかりました：

1. **ルート最適化**: 配送順序を見直すことで、約15%の時間短縮が可能です
2. **時間帯の調整**: 交通渋滞を避けることで、燃料コストを12%削減できます
3. **配送拠点の見直し**: 配送エリアに応じた拠点配置により、効率が向上します

詳しい分析結果を確認されますか？`;
    response.suggestions = [
      '配送ルート最適化の詳細分析を見る',
      '時間帯別の配送効率を確認する',
      '配送コスト削減シミュレーションを実行する'
    ];
  } else if (lowercaseMsg.includes('在庫') || lowercaseMsg.includes('発注')) {
    response.intent = 'inventory_management';
    response.content = `在庫管理についてお答えします。現在の在庫状況を分析すると：

1. **在庫回転率**: 現在6.2回/年で、業界平均の7.5回と比較してやや低めです
2. **滞留在庫**: 90日以上動きのない商品が全体の8%あります
3. **発注タイミング**: 一部商品で発注リードタイムの最適化が必要です

改善提案を詳しく確認されますか？`;
    response.suggestions = [
      '滞留在庫の詳細リストを見る',
      '発注量最適化の提案を確認する',
      '在庫回転率改善プランを作成する'
    ];
  } else if (lowercaseMsg.includes('コスト') || lowercaseMsg.includes('費用')) {
    response.intent = 'cost_analysis';
    response.content = `コストに関するご質問ですね。現在の物流コストの内訳は以下の通りです：

- **輸送費**: 45% (月間約230万円)
- **保管費**: 30% (月間約150万円)
- **人件費**: 25% (月間約130万円)

主なコスト削減の機会：
1. 共同配送による輸送費削減 (推定効果: 月間-35万円)
2. 在庫圧縮による保管費削減 (推定効果: 月間-22万円)
3. 作業効率化による残業時間削減 (推定効果: 月間-18万円)

詳細な分析レポートを作成しましょうか？`;
    response.suggestions = [
      'コスト削減プランの詳細を見る',
      '他社との共同配送の可能性を調査する',
      '作業効率化の具体案を確認する'
    ];
  } else if (lowercaseMsg.includes('効率') || lowercaseMsg.includes('改善')) {
    response.intent = 'efficiency_improvement';
    response.content = `業務効率改善についてアドバイスします。

現在の主な改善ポイント：

1. **ピッキング効率**: ABC分析に基づく在庫配置で、作業時間を15%短縮可能
2. **動線最適化**: 庫内レイアウトの見直しで、移動距離を20%削減
3. **作業標準化**: マニュアル整備により、ミス率を35%低減

これらの改善により、月間約45万円の人件費削減が見込まれます。

どの項目から着手されますか？`;
    response.suggestions = [
      'ピッキング効率改善の詳細プランを見る',
      '動線分析レポートを確認する',
      '作業標準化マニュアルのサンプルを見る'
    ];
  } else {
    response.intent = 'general_inquiry';
    response.content = `ご質問ありがとうございます。物流業務の効率化についてお手伝いします。

以下のような分野でサポートできます：
- 📦 配送ルートの最適化
- 📊 在庫管理の改善
- 💰 コスト削減の提案
- ⚡ 作業効率の向上
- 📈 需要予測と計画

具体的にどの分野についてお知りになりたいですか？`;
    response.suggestions = [
      '配送効率の改善方法を教えて',
      '在庫管理のベストプラクティスは？',
      'コスト削減の優先順位を知りたい'
    ];
  }

  return response;
}

export default chatAiApi;
