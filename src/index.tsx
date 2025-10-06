// PAL物流SaaS ログイン管理システム - メインアプリケーション
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { auth } from './routes/auth-simple';
import { tenantMiddleware, securityHeaders } from './middleware/auth';
import type { CloudflareBindings } from './types/auth';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// セキュリティヘッダー適用
app.use('*', securityHeaders);

// テナント分離ミドルウェア適用
app.use('*', tenantMiddleware);

// CORS設定（API用）
app.use('/api/*', cors({
  origin: (origin) => {
    // 開発環境では全てのオリジンを許可
    if (process.env.NODE_ENV === 'development') {
      return origin || '*';
    }
    // 本番環境では特定のオリジンのみ許可
    const allowedOrigins = [
      /https:\/\/.*\.pages\.dev$/,
      /https:\/\/.*\.your-domain\.com$/,
      'http://localhost:3000'
    ];
    
    if (!origin) return '*';
    
    return allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') return origin === allowed;
      return allowed.test(origin);
    }) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Subdomain'],
  credentials: true
}));

// 静的ファイル配信（CSSやJS）
app.use('/static/*', serveStatic({ root: './public' }));
app.use('/favicon.ico', serveStatic({ path: './public/favicon.ico' }));

// API ルート
app.route('/api/auth', auth);
import { test } from './routes/test';
app.route('/api/test', test);

// API 基本情報
app.get('/api', (c) => {
  return c.json({
    service: 'PAL物流SaaS ログイン管理システム',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    tenant: c.get('tenantSubdomain')
  });
});

// API ヘルスチェック
app.get('/api/health', async (c) => {
  try {
    // データベース接続確認
    await c.env.DB.prepare('SELECT 1').first();
    
    return c.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ログイン画面
app.get('/login', (c) => {
  const tenantSubdomain = c.get('tenantSubdomain');
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ログイン - PAL物流SaaS</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/login.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <!-- ロゴとタイトル -->
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full mb-4">
                    <i class="fas fa-truck-moving text-2xl"></i>
                </div>
                <h1 class="text-2xl font-bold text-gray-900 mb-2">PAL物流SaaS</h1>
                <p class="text-gray-600 text-sm">物流管理システム</p>
                ${tenantSubdomain && tenantSubdomain !== 'localhost' ? 
                  `<p class="text-blue-600 text-sm font-medium mt-2">企業: ${tenantSubdomain}</p>` : 
                  ''
                }
            </div>

            <!-- エラー表示 -->
            <div id="error-message" class="hidden mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span id="error-text"></span>
                </div>
            </div>

            <!-- ログインフォーム -->
            <form id="login-form" class="space-y-6">
                <!-- メールアドレス -->
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-envelope mr-1"></i>
                        メールアドレス
                    </label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email"
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="your-email@company.co.jp"
                        autocomplete="username"
                    >
                </div>

                <!-- パスワード -->
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-lock mr-1"></i>
                        パスワード
                    </label>
                    <div class="relative">
                        <input 
                            type="password" 
                            id="password" 
                            name="password"
                            required
                            class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="パスワードを入力"
                            autocomplete="current-password"
                        >
                        <button type="button" id="toggle-password" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>

                <!-- 企業識別（開発用） -->
                <div id="tenant-field">
                    <label for="tenant_subdomain" class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-building mr-1"></i>
                        企業識別子
                    </label>
                    <select 
                        id="tenant_subdomain" 
                        name="tenant_subdomain"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">企業を選択...</option>
                        <option value="abc-logistics">ABC物流株式会社</option>
                        <option value="xyz-delivery">XYZ配送サービス</option>
                        <option value="demo-company" selected>デモ物流企業</option>
                    </select>
                </div>

                <!-- オプション -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <input 
                            id="remember_me" 
                            name="remember_me" 
                            type="checkbox"
                            class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        >
                        <label for="remember_me" class="ml-2 text-sm text-gray-600">
                            ログイン状態を保持する
                        </label>
                    </div>

                    <a href="/password/reset" class="text-sm text-blue-600 hover:text-blue-500">
                        パスワードを忘れた場合
                    </a>
                </div>

                <!-- ログインボタン -->
                <button 
                    type="submit" 
                    id="login-btn"
                    class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 font-medium"
                >
                    <i class="fas fa-sign-in-alt mr-2"></i>
                    ログイン
                </button>

                <!-- ローディング状態 -->
                <button 
                    type="button" 
                    id="loading-btn"
                    class="hidden w-full bg-gray-400 text-white py-2 px-4 rounded-md cursor-not-allowed font-medium"
                    disabled
                >
                    <i class="fas fa-spinner fa-spin mr-2"></i>
                    ログイン中...
                </button>
            </form>

            <!-- SSO オプション（将来実装） -->
            <div class="mt-6 border-t border-gray-200 pt-6">
                <p class="text-center text-sm text-gray-500 mb-4">または</p>
                <div class="space-y-3">
                    <button 
                        type="button" 
                        class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        disabled
                    >
                        <i class="fab fa-google mr-2 text-red-500"></i>
                        Googleでログイン（近日公開）
                    </button>
                    <button 
                        type="button" 
                        class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        disabled
                    >
                        <i class="fab fa-microsoft mr-2 text-blue-500"></i>
                        Microsoft 365でログイン（近日公開）
                    </button>
                </div>
            </div>

            <!-- フッター -->
            <div class="mt-8 text-center text-xs text-gray-500">
                <p>© 2024 PAL物流SaaS. All rights reserved.</p>
                <div class="mt-2 space-x-4">
                    <a href="/privacy" class="hover:text-gray-700">プライバシーポリシー</a>
                    <a href="/terms" class="hover:text-gray-700">利用規約</a>
                    <a href="/support" class="hover:text-gray-700">サポート</a>
                </div>
            </div>
        </div>

        <script src="/static/login.js"></script>
    </body>
    </html>
  `);
});

// 管理画面（認証必要）
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>管理画面 - PAL物流SaaS</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div id="admin-app" class="min-h-screen">
            <!-- 認証チェック中のローディング -->
            <div id="loading" class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
                    <p class="text-gray-600">読み込み中...</p>
                </div>
            </div>
        </div>

        <script src="/static/admin.js"></script>
    </body>
    </html>
  `);
});

// ダッシュボード（認証必要）
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ダッシュボード - PAL物流SaaS</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div id="dashboard-app" class="min-h-screen">
            <!-- 認証チェック中のローディング -->
            <div id="loading" class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
                    <p class="text-gray-600">読み込み中...</p>
                </div>
            </div>
        </div>

        <script src="/static/dashboard.js"></script>
    </body>
    </html>
  `);
});

// ルートページ（ランディングページまたはダッシュボードへリダイレクト）
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PAL物流SaaS - 物流管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-white">
        <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div class="text-center max-w-2xl mx-auto px-4">
                <!-- ロゴ -->
                <div class="inline-flex items-center justify-center w-24 h-24 bg-blue-600 text-white rounded-full mb-8">
                    <i class="fas fa-truck-moving text-4xl"></i>
                </div>
                
                <!-- タイトル -->
                <h1 class="text-4xl font-bold text-gray-900 mb-4">PAL物流SaaS</h1>
                <p class="text-xl text-gray-600 mb-8">効率的な物流管理で、ビジネスを加速させる</p>
                
                <!-- 機能紹介 -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div class="p-6 bg-white rounded-lg shadow-md">
                        <i class="fas fa-users text-blue-600 text-3xl mb-4"></i>
                        <h3 class="text-lg font-semibold mb-2">ユーザー管理</h3>
                        <p class="text-gray-600">企業単位でのマルチテナント対応</p>
                    </div>
                    <div class="p-6 bg-white rounded-lg shadow-md">
                        <i class="fas fa-shield-alt text-blue-600 text-3xl mb-4"></i>
                        <h3 class="text-lg font-semibold mb-2">セキュリティ</h3>
                        <p class="text-gray-600">2要素認証と高度な権限管理</p>
                    </div>
                    <div class="p-6 bg-white rounded-lg shadow-md">
                        <i class="fas fa-chart-bar text-blue-600 text-3xl mb-4"></i>
                        <h3 class="text-lg font-semibold mb-2">分析・レポート</h3>
                        <p class="text-gray-600">詳細な使用状況分析と監査ログ</p>
                    </div>
                </div>
                
                <!-- ボタン -->
                <div class="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
                    <a href="/login" class="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200">
                        <i class="fas fa-sign-in-alt mr-2"></i>
                        ログイン
                    </a>
                    <a href="/signup" class="inline-block border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-600 hover:text-white transition-colors duration-200">
                        <i class="fas fa-user-plus mr-2"></i>
                        新規登録
                    </a>
                </div>

                <!-- フッター -->
                <div class="mt-16 text-sm text-gray-500">
                    <p>© 2024 PAL物流SaaS. All rights reserved.</p>
                </div>
            </div>
        </div>

        <script>
            // セッションチェック - ログイン済みの場合はダッシュボードへリダイレクト
            fetch('/api/auth/me')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        window.location.href = '/dashboard';
                    }
                })
                .catch(error => {
                    // エラーは無視（ログインしていない状態）
                });
        </script>
    </body>
    </html>
  `);
});

export default app;