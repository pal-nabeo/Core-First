// PAL物流SaaS ログイン管理システム - メインアプリケーション
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { auth } from './routes/auth-simple';
import { tenantMiddleware, securityHeaders } from './middleware/auth';
import type { CloudflareBindings } from './types/auth';
import usersApi from './routes/users';
import licensesApi from './routes/licenses';

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
app.use('/static/*', serveStatic());
app.use('/favicon.ico', serveStatic());

// API ルート
app.route('/api/auth', auth);
import { test } from './routes/test';
app.route('/api/test', test);
import { tenant } from './routes/tenant';
app.route('/api/tenant', tenant);

// 管理者API
app.route('/api/users', usersApi);
app.route('/api/licenses', licensesApi);
import invitationsApi from './routes/invitations';
app.route('/api/invitations', invitationsApi);
import upgradeApi from './routes/upgrade';
app.route('/api/upgrade', upgradeApi);

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

// 新規登録画面
app.get('/signup', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>新規登録 - PAL物流SaaS</title>
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
                <h1 class="text-2xl font-bold text-gray-900 mb-2">新規アカウント登録</h1>
                <p class="text-gray-600 text-sm">PAL物流SaaSにご登録ください</p>
                <div class="mt-4 text-xs text-gray-500 bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                    <i class="fas fa-info-circle mr-1"></i>
                    企業の管理者様のみご登録いただけます
                </div>
            </div>

            <!-- エラー表示 -->
            <div id="error-message" class="hidden mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span id="error-text"></span>
                </div>
            </div>

            <!-- 成功メッセージ -->
            <div id="success-message" class="hidden mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md">
                <div class="flex items-center">
                    <i class="fas fa-check-circle mr-2"></i>
                    <span id="success-text"></span>
                </div>
            </div>

            <!-- 登録フォーム -->
            <form id="signup-form" class="space-y-6">
                <!-- 企業情報 -->
                <div class="border-b pb-6">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">
                        <i class="fas fa-building mr-2"></i>企業情報
                    </h3>
                    
                    <!-- 企業名 -->
                    <div class="mb-4">
                        <label for="company_name" class="block text-sm font-medium text-gray-700 mb-2">
                            企業名 <span class="text-red-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            id="company_name" 
                            name="company_name"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="例: ABC物流株式会社"
                        >
                    </div>

                    <!-- サブドメイン -->
                    <div class="mb-4">
                        <label for="subdomain" class="block text-sm font-medium text-gray-700 mb-2">
                            サブドメイン識別子 <span class="text-red-500">*</span>
                        </label>
                        <div class="flex">
                            <input 
                                type="text" 
                                id="subdomain" 
                                name="subdomain"
                                required
                                pattern="[a-z0-9-]+"
                                class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="abc-logistics"
                            >
                            <span class="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md text-sm text-gray-600">
                                .pal-logistics.com
                            </span>
                        </div>
                        <p class="mt-1 text-xs text-gray-500">
                            半角英数字とハイフンのみ。ログイン時のURLになります。
                        </p>
                        <div id="subdomain-check" class="mt-2 text-sm hidden">
                            <span id="subdomain-status"></span>
                        </div>
                    </div>
                </div>

                <!-- 管理者アカウント -->
                <div>
                    <h3 class="text-lg font-medium text-gray-900 mb-4">
                        <i class="fas fa-user-shield mr-2"></i>管理者アカウント
                    </h3>
                    
                    <!-- 管理者名 -->
                    <div class="mb-4">
                        <label for="admin_name" class="block text-sm font-medium text-gray-700 mb-2">
                            管理者名 <span class="text-red-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            id="admin_name" 
                            name="admin_name"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="例: 田中 太郎"
                        >
                    </div>

                    <!-- メールアドレス -->
                    <div class="mb-4">
                        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                            メールアドレス <span class="text-red-500">*</span>
                        </label>
                        <input 
                            type="email" 
                            id="email" 
                            name="email"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="admin@abc-logistics.co.jp"
                            autocomplete="username"
                        >
                        <p class="mt-1 text-xs text-gray-500">
                            企業ドメインのメールアドレスを使用してください
                        </p>
                    </div>

                    <!-- パスワード -->
                    <div class="mb-4">
                        <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                            パスワード <span class="text-red-500">*</span>
                        </label>
                        <div class="relative">
                            <input 
                                type="password" 
                                id="password" 
                                name="password"
                                required
                                minlength="8"
                                class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="8文字以上のパスワード"
                                autocomplete="new-password"
                            >
                            <button type="button" id="toggle-password" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                        <div class="mt-2 text-xs">
                            <div class="space-y-1">
                                <div id="password-length" class="flex items-center">
                                    <i class="fas fa-circle text-gray-300 mr-2 text-xs"></i>
                                    <span class="text-gray-500">8文字以上</span>
                                </div>
                                <div id="password-char" class="flex items-center">
                                    <i class="fas fa-circle text-gray-300 mr-2 text-xs"></i>
                                    <span class="text-gray-500">英数字を含む</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- パスワード確認 -->
                    <div class="mb-6">
                        <label for="password_confirm" class="block text-sm font-medium text-gray-700 mb-2">
                            パスワード確認 <span class="text-red-500">*</span>
                        </label>
                        <input 
                            type="password" 
                            id="password_confirm" 
                            name="password_confirm"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="パスワードを再入力"
                            autocomplete="new-password"
                        >
                        <div id="password-match" class="mt-1 text-xs hidden">
                            <span id="password-match-text"></span>
                        </div>
                    </div>
                </div>

                <!-- 利用規約 -->
                <div class="flex items-start">
                    <input 
                        id="terms_agree" 
                        name="terms_agree" 
                        type="checkbox"
                        required
                        class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                    >
                    <label for="terms_agree" class="ml-3 text-sm text-gray-600">
                        <a href="/terms" class="text-blue-600 hover:text-blue-500">利用規約</a>
                        および
                        <a href="/privacy" class="text-blue-600 hover:text-blue-500">プライバシーポリシー</a>
                        に同意する <span class="text-red-500">*</span>
                    </label>
                </div>

                <!-- 登録ボタン -->
                <button 
                    type="submit" 
                    id="signup-btn"
                    class="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 font-medium"
                >
                    <i class="fas fa-user-plus mr-2"></i>
                    アカウント登録
                </button>

                <!-- ローディング状態 -->
                <button 
                    type="button" 
                    id="loading-btn"
                    class="hidden w-full bg-gray-400 text-white py-3 px-4 rounded-md cursor-not-allowed font-medium"
                    disabled
                >
                    <i class="fas fa-spinner fa-spin mr-2"></i>
                    登録中...
                </button>
            </form>

            <!-- ログインリンク -->
            <div class="mt-6 text-center">
                <p class="text-sm text-gray-600">
                    既にアカウントをお持ちの場合
                    <a href="/login" class="text-blue-600 hover:text-blue-500 font-medium ml-1">
                        ログインはこちら
                    </a>
                </p>
            </div>

            <!-- フッター -->
            <div class="mt-8 text-center text-xs text-gray-500">
                <p>© 2024 PAL物流SaaS. All rights reserved.</p>
            </div>
        </div>

        <script src="/static/signup.js"></script>
    </body>
    </html>
  `);
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

                <!-- 企業情報は非表示（メールアドレスから自動判定） -->

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

            <!-- 新規登録リンク -->
            <div class="mt-6 text-center">
                <p class="text-sm text-gray-600">
                    アカウントをお持ちでない場合
                    <a href="/signup" class="text-blue-600 hover:text-blue-500 font-medium ml-1">
                        新規登録はこちら
                    </a>
                </p>
            </div>

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

// 管理者ダッシュボード（認証必要）
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>管理者ダッシュボード - PAL物流SaaS</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="/static/dashboard.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="flex h-screen overflow-hidden">
            <!-- サイドバー -->
            <aside id="sidebar" class="flex-shrink-0 w-64 bg-white transition-all duration-300 ease-in-out shadow-xl border-r border-gray-200">
                <div class="flex flex-col h-full">
                    <!-- ロゴ -->
                    <div class="flex items-center justify-center h-16 bg-blue-600 border-b border-blue-700">
                        <i class="fas fa-truck-moving text-white text-2xl mr-2"></i>
                        <span class="text-white font-bold text-lg">PAL物流SaaS</span>
                    </div>

                    <!-- ナビゲーションメニュー -->
                    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                        <!-- ダッシュボード -->
                        <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 px-3 py-2 bg-gray-50 rounded-lg mx-2">
                            <i class="fas fa-home mr-2 text-blue-600"></i>メイン
                        </div>
                        <a href="#" onclick="showSection('overview')" class="nav-item active" data-section="overview">
                            <i class="fas fa-tachometer-alt mr-3 text-lg text-blue-600"></i>
                            <div class="flex-1">
                                <span class="font-medium">ダッシュボード</span>
                                <div class="text-xs mt-0.5">概要・統計情報</div>
                            </div>
                        </a>

                        <!-- ユーザー管理セクション -->
                        <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8 px-3 py-2 bg-blue-50 rounded-lg mx-2">
                            <i class="fas fa-users-cog mr-2 text-blue-600"></i>管理機能
                        </div>
                        
                        <!-- ユーザー管理 -->
                        <a href="#" onclick="showSection('users')" class="nav-item" data-section="users">
                            <i class="fas fa-users mr-3 text-lg text-blue-600"></i>
                            <div class="flex-1">
                                <span class="font-medium">ユーザー管理</span>
                                <div class="text-xs mt-0.5">アカウント・権限管理</div>
                            </div>
                        </a>
                        
                        <!-- ライセンス管理 -->
                        <a href="#" onclick="showSection('licenses')" class="nav-item" data-section="licenses">
                            <i class="fas fa-key mr-3 text-lg text-yellow-600"></i>
                            <div class="flex-1">
                                <span class="font-medium">ライセンス管理</span>
                                <div class="text-xs mt-0.5">使用量・制限管理</div>
                            </div>
                        </a>

                        <!-- 権限管理 -->
                        <a href="#" onclick="showSection('roles')" class="nav-item" data-section="roles">
                            <i class="fas fa-shield-alt mr-3 text-lg text-green-600"></i>
                            <div class="flex-1">
                                <span class="font-medium">権限管理</span>
                                <div class="text-xs mt-0.5">ロール・アクセス制御</div>
                            </div>
                        </a>

                        <!-- システムセクション -->
                        <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8 px-3 py-2 bg-green-50 rounded-lg mx-2">
                            <i class="fas fa-cogs mr-2 text-green-600"></i>システム
                        </div>
                        
                        <!-- 監査ログ -->
                        <a href="#" onclick="showSection('audit')" class="nav-item" data-section="audit">
                            <i class="fas fa-history mr-3 text-lg text-purple-600"></i>
                            <div class="flex-1">
                                <span class="font-medium">監査ログ</span>
                                <div class="text-xs mt-0.5">アクティビティ履歴</div>
                            </div>
                        </a>
                        
                        <!-- システム設定 -->
                        <a href="#" onclick="showSection('settings')" class="nav-item" data-section="settings">
                            <i class="fas fa-cog mr-3 text-lg text-gray-600"></i>
                            <div class="flex-1">
                                <span class="font-medium">システム設定</span>
                                <div class="text-xs mt-0.5">基本設定・環境設定</div>
                            </div>
                        </a>

                        <!-- レポート -->
                        <a href="#" onclick="showSection('reports')" class="nav-item" data-section="reports">
                            <i class="fas fa-chart-bar mr-3 text-lg text-red-600"></i>
                            <div class="flex-1">
                                <span class="font-medium">レポート</span>
                                <div class="text-xs mt-0.5">統計・分析・エクスポート</div>
                            </div>
                        </a>

                        <!-- 課金・プランセクション -->
                        <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8 px-3 py-2 bg-orange-50 rounded-lg mx-2">
                            <i class="fas fa-credit-card mr-2 text-orange-600"></i>課金・プラン
                        </div>
                        
                        <!-- アップグレード -->
                        <a href="#" onclick="showSection('upgrade')" class="nav-item" data-section="upgrade">
                            <i class="fas fa-arrow-up mr-3 text-lg text-orange-600"></i>
                            <div class="flex-1">
                                <span class="font-medium">アップグレード</span>
                                <div class="text-xs mt-0.5">プラン変更・料金確認</div>
                            </div>
                        </a>
                        
                        <!-- 課金履歴 -->
                        <a href="#" onclick="showSection('billing')" class="nav-item" data-section="billing">
                            <i class="fas fa-receipt mr-3 text-lg text-orange-600"></i>
                            <div class="flex-1">
                                <span class="font-medium">課金履歴</span>
                                <div class="text-xs mt-0.5">請求・支払い履歴</div>
                            </div>
                        </a>
                    </nav>

                    <!-- ユーザー情報 -->
                    <div class="border-t border-gray-200 bg-gray-50 p-4">
                        <div class="flex items-center">
                            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="ml-3">
                                <p class="text-sm font-medium text-gray-900" id="user-name">管理者</p>
                                <p class="text-xs text-gray-600" id="user-role">super_admin</p>
                            </div>
                        </div>
                        <button onclick="logout()" class="mt-3 w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm transition-colors shadow-sm">
                            <i class="fas fa-sign-out-alt mr-2"></i>
                            ログアウト
                        </button>
                    </div>
                </div>
            </aside>

            <!-- メインコンテンツ -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- トップバー -->
                <header class="bg-white shadow-sm border-b h-16 flex items-center justify-between px-6">
                    <div class="flex items-center">
                        <button onclick="toggleSidebar()" class="text-gray-600 hover:text-gray-900 mr-4">
                            <i class="fas fa-bars text-lg"></i>
                        </button>
                        <h1 class="text-xl font-semibold text-gray-900" id="page-title">管理者ダッシュボード</h1>
                    </div>
                    
                    <div class="flex items-center space-x-4">
                        <div class="relative">
                            <button class="text-gray-600 hover:text-gray-900 relative">
                                <i class="fas fa-bell text-lg"></i>
                                <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">3</span>
                            </button>
                        </div>
                        <div class="text-sm text-gray-600">
                            <span id="current-time"></span>
                        </div>
                    </div>
                </header>

                <!-- コンテンツエリア -->
                <main class="flex-1 overflow-y-auto p-6">
                    <!-- 概要セクション -->
                    <div id="overview-section" class="content-section">
                        <!-- 統計カード -->
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium text-gray-600">総ユーザー数</p>
                                        <p class="text-2xl font-bold text-gray-900" id="total-users">-</p>
                                    </div>
                                    <div class="p-3 bg-blue-50 rounded-full">
                                        <i class="fas fa-users text-blue-600 text-xl"></i>
                                    </div>
                                </div>
                                <p class="mt-2 text-xs text-green-600">
                                    <i class="fas fa-arrow-up mr-1"></i>
                                    今月 <span id="users-growth">+0</span> 人増加
                                </p>
                            </div>

                            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium text-gray-600">アクティブユーザー</p>
                                        <p class="text-2xl font-bold text-gray-900" id="active-users">-</p>
                                    </div>
                                    <div class="p-3 bg-green-50 rounded-full">
                                        <i class="fas fa-user-check text-green-600 text-xl"></i>
                                    </div>
                                </div>
                                <p class="mt-2 text-xs text-green-600">
                                    <i class="fas fa-circle mr-1 text-green-500"></i>
                                    過去24時間
                                </p>
                            </div>

                            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium text-gray-600">ライセンス使用率</p>
                                        <p class="text-2xl font-bold text-gray-900" id="license-usage">-</p>
                                    </div>
                                    <div class="p-3 bg-yellow-50 rounded-full">
                                        <i class="fas fa-key text-yellow-600 text-xl"></i>
                                    </div>
                                </div>
                                <div class="mt-2">
                                    <div class="bg-gray-200 rounded-full h-2">
                                        <div class="bg-yellow-500 h-2 rounded-full" style="width: 0%" id="license-bar"></div>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium text-gray-600">システム状態</p>
                                        <p class="text-2xl font-bold text-green-600" id="system-status">正常</p>
                                    </div>
                                    <div class="p-3 bg-green-50 rounded-full">
                                        <i class="fas fa-shield-alt text-green-600 text-xl"></i>
                                    </div>
                                </div>
                                <p class="mt-2 text-xs text-gray-500">
                                    最終チェック: <span id="last-check">-</span>
                                </p>
                            </div>
                        </div>

                        <!-- チャートとアクティビティ -->
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <!-- ユーザーアクティビティチャート -->
                            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                                <div class="p-6 border-b border-gray-200">
                                    <h3 class="text-lg font-semibold text-gray-900">ユーザーアクティビティ</h3>
                                    <p class="text-sm text-gray-600">過去30日間のログイン状況</p>
                                </div>
                                <div class="p-6">
                                    <canvas id="activityChart" width="400" height="200"></canvas>
                                </div>
                            </div>

                            <!-- 最近のアクティビティ -->
                            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                                <div class="p-6 border-b border-gray-200">
                                    <h3 class="text-lg font-semibold text-gray-900">最近のアクティビティ</h3>
                                    <p class="text-sm text-gray-600">リアルタイム監視</p>
                                </div>
                                <div class="p-6">
                                    <div class="space-y-4" id="recent-activities">
                                        <div class="flex items-center space-x-3">
                                            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                <i class="fas fa-sign-in-alt text-blue-600 text-xs"></i>
                                            </div>
                                            <div class="flex-1">
                                                <p class="text-sm font-medium text-gray-900">ユーザーログイン</p>
                                                <p class="text-xs text-gray-500">admin@example.com が正常にログインしました</p>
                                            </div>
                                            <span class="text-xs text-gray-400">2分前</span>
                                        </div>
                                        
                                        <div class="flex items-center space-x-3">
                                            <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                <i class="fas fa-user-plus text-green-600 text-xs"></i>
                                            </div>
                                            <div class="flex-1">
                                                <p class="text-sm font-medium text-gray-900">新規ユーザー登録</p>
                                                <p class="text-xs text-gray-500">新しいユーザーが登録されました</p>
                                            </div>
                                            <span class="text-xs text-gray-400">5分前</span>
                                        </div>

                                        <div class="flex items-center space-x-3">
                                            <div class="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                                                <i class="fas fa-exclamation-triangle text-yellow-600 text-xs"></i>
                                            </div>
                                            <div class="flex-1">
                                                <p class="text-sm font-medium text-gray-900">ライセンス警告</p>
                                                <p class="text-xs text-gray-500">使用率が80%に達しました</p>
                                            </div>
                                            <span class="text-xs text-gray-400">15分前</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- クイックアクション -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div class="p-6 border-b border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900">クイックアクション</h3>
                                <p class="text-sm text-gray-600">よく使用される機能へのショートカット</p>
                            </div>
                            <div class="p-6">
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <button onclick="showSection('users'); document.getElementById('add-user-modal').classList.remove('hidden');" class="flex flex-col items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all">
                                        <i class="fas fa-envelope text-blue-600 text-2xl mb-2"></i>
                                        <span class="text-sm font-medium text-gray-900">ユーザー招待</span>
                                    </button>
                                    
                                    <button onclick="showSection('reports')" class="flex flex-col items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all">
                                        <i class="fas fa-download text-green-600 text-2xl mb-2"></i>
                                        <span class="text-sm font-medium text-gray-900">レポート出力</span>
                                    </button>
                                    
                                    <button onclick="showSection('licenses')" class="flex flex-col items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 transition-all">
                                        <i class="fas fa-key text-yellow-600 text-2xl mb-2"></i>
                                        <span class="text-sm font-medium text-gray-900">ライセンス管理</span>
                                    </button>
                                    
                                    <button onclick="showSection('settings')" class="flex flex-col items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-all">
                                        <i class="fas fa-cog text-gray-600 text-2xl mb-2"></i>
                                        <span class="text-sm font-medium text-gray-900">システム設定</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ユーザー管理セクション -->
                    <div id="users-section" class="content-section hidden">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h2 class="text-2xl font-bold text-gray-900">ユーザー管理</h2>
                                <p class="text-gray-600">システム内のすべてのユーザーを管理</p>
                            </div>
                            <button onclick="document.getElementById('add-user-modal').classList.remove('hidden')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                                <i class="fas fa-envelope mr-2"></i>
                                ユーザー招待
                            </button>
                        </div>

                        <!-- フィルター -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                            <div class="p-4">
                                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <input type="text" id="user-search" placeholder="名前・メールアドレスで検索" class="border border-gray-300 rounded-lg px-3 py-2">
                                    <select id="role-filter" class="border border-gray-300 rounded-lg px-3 py-2">
                                        <option value="">すべての権限</option>
                                        <option value="super_admin">スーパー管理者</option>
                                        <option value="admin">管理者</option>
                                        <option value="site_manager">サイト管理者</option>
                                        <option value="user">一般ユーザー</option>
                                    </select>
                                    <select id="status-filter" class="border border-gray-300 rounded-lg px-3 py-2">
                                        <option value="">すべてのステータス</option>
                                        <option value="active">アクティブ</option>
                                        <option value="inactive">非アクティブ</option>
                                        <option value="suspended">停止</option>
                                    </select>
                                    <button onclick="applyUserFilters()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                                        <i class="fas fa-search mr-2"></i>
                                        検索
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- ユーザーテーブル -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div class="overflow-x-auto">
                                <table class="min-w-full divide-y divide-gray-200">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ユーザー</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">権限</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最終ログイン</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody id="users-table-body" class="bg-white divide-y divide-gray-200">
                                        <!-- JavaScript で動的に生成 -->
                                    </tbody>
                                </table>
                            </div>
                            <!-- ページネーション -->
                            <div id="pagination-container" class="bg-white rounded-b-lg">
                                <!-- JavaScript で動的に生成 -->
                            </div>
                        </div>
                    </div>

                    <!-- ライセンス管理セクション -->
                    <div id="licenses-section" class="content-section hidden">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h2 class="text-2xl font-bold text-gray-900">ライセンス管理</h2>
                                <p class="text-gray-600">使用量とライセンス制限を監視</p>
                            </div>
                            <button onclick="refreshLicenseData()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                                <i class="fas fa-sync mr-2"></i>
                                更新
                            </button>
                        </div>

                        <!-- ライセンス概要 -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div class="flex items-center justify-between mb-4">
                                    <h3 class="text-lg font-semibold text-gray-900">契約ライセンス</h3>
                                    <i class="fas fa-certificate text-blue-600 text-2xl"></i>
                                </div>
                                <p class="text-3xl font-bold text-gray-900" id="total-licenses">100</p>
                                <p class="text-sm text-gray-600">総ライセンス数</p>
                            </div>

                            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div class="flex items-center justify-between mb-4">
                                    <h3 class="text-lg font-semibold text-gray-900">使用中</h3>
                                    <i class="fas fa-user-check text-green-600 text-2xl"></i>
                                </div>
                                <p class="text-3xl font-bold text-gray-900" id="used-licenses">-</p>
                                <p class="text-sm text-gray-600">アクティブユーザー</p>
                            </div>

                            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div class="flex items-center justify-between mb-4">
                                    <h3 class="text-lg font-semibold text-gray-900">残り</h3>
                                    <i class="fas fa-plus-circle text-yellow-600 text-2xl"></i>
                                </div>
                                <p class="text-3xl font-bold text-gray-900" id="available-licenses">-</p>
                                <p class="text-sm text-gray-600">利用可能数</p>
                            </div>
                        </div>

                        <!-- 使用状況グラフ -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                            <div class="p-6 border-b border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900">ライセンス使用状況推移</h3>
                                <p class="text-sm text-gray-600">過去12ヶ月間の使用状況</p>
                            </div>
                            <div class="p-6">
                                <canvas id="licenseChart" width="400" height="200"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- その他のセクションも同様に実装 -->
                    <div id="roles-section" class="content-section hidden">
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">権限管理</h2>
                        <p class="text-gray-600">開発中...</p>
                    </div>

                    <div id="audit-section" class="content-section hidden">
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">監査ログ</h2>
                        <p class="text-gray-600">開発中...</p>
                    </div>

                    <div id="settings-section" class="content-section hidden">
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">システム設定</h2>
                        <p class="text-gray-600">開発中...</p>
                    </div>

                    <div id="reports-section" class="content-section hidden">
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">レポート</h2>
                        <p class="text-gray-600">開発中...</p>
                    </div>

                    <!-- アップグレードセクション -->
                    <div id="upgrade-section" class="content-section hidden">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h2 class="text-2xl font-bold text-gray-900">プラン・アップグレード</h2>
                                <p class="text-gray-600">現在のプランと利用状況を確認し、必要に応じてアップグレードできます</p>
                            </div>
                            <button onclick="loadUpgradeData()" class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg">
                                <i class="fas fa-sync mr-2"></i>
                                更新
                            </button>
                        </div>

                        <!-- 現在のプラン状況 -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
                            <div class="p-6 border-b border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900">現在のプラン</h3>
                            </div>
                            <div class="p-6">
                                <div id="current-plan-info" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <!-- プラン情報（左側） -->
                                    <div>
                                        <div class="flex items-center mb-4">
                                            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                                                <i class="fas fa-box text-blue-600 text-xl"></i>
                                            </div>
                                            <div>
                                                <h4 class="text-xl font-bold text-gray-900" id="current-plan-name">読み込み中...</h4>
                                                <p class="text-gray-600" id="current-plan-price">-</p>
                                            </div>
                                        </div>
                                        <div class="space-y-3">
                                            <div class="flex items-center">
                                                <i class="fas fa-calendar text-gray-400 mr-2"></i>
                                                <span class="text-sm text-gray-600">開始日: <span id="plan-start-date">-</span></span>
                                            </div>
                                            <div class="flex items-center">
                                                <i class="fas fa-clock text-gray-400 mr-2"></i>
                                                <span class="text-sm text-gray-600">有効期限: <span id="plan-expires-date">-</span></span>
                                            </div>
                                            <div class="flex items-center" id="plan-status-info">
                                                <i class="fas fa-info-circle text-gray-400 mr-2"></i>
                                                <span class="text-sm text-gray-600" id="plan-status">-</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- 利用状況（右側） -->
                                    <div>
                                        <h5 class="font-semibold text-gray-900 mb-4">利用状況</h5>
                                        <div class="space-y-4">
                                            <!-- ユーザー数 -->
                                            <div>
                                                <div class="flex justify-between text-sm mb-1">
                                                    <span class="text-gray-600">ユーザー数</span>
                                                    <span id="user-usage" class="text-gray-900">- / -</span>
                                                </div>
                                                <div class="w-full bg-gray-200 rounded-full h-2">
                                                    <div id="user-usage-bar" class="bg-blue-500 h-2 rounded-full" style="width: 0%"></div>
                                                </div>
                                            </div>

                                            <!-- ストレージ -->
                                            <div>
                                                <div class="flex justify-between text-sm mb-1">
                                                    <span class="text-gray-600">ストレージ</span>
                                                    <span id="storage-usage" class="text-gray-900">- / -</span>
                                                </div>
                                                <div class="w-full bg-gray-200 rounded-full h-2">
                                                    <div id="storage-usage-bar" class="bg-green-500 h-2 rounded-full" style="width: 0%"></div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- 制限警告 -->
                                        <div id="usage-warnings" class="mt-4 space-y-2 hidden">
                                            <div id="user-limit-warning" class="hidden bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                                                <i class="fas fa-exclamation-triangle mr-1"></i>
                                                ユーザー数が上限に達しています
                                            </div>
                                            <div id="storage-limit-warning" class="hidden bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                                                <i class="fas fa-exclamation-triangle mr-1"></i>
                                                ストレージが上限に達しています
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 利用可能なプラン -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div class="p-6 border-b border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900">利用可能なプラン</h3>
                                <p class="text-gray-600 mt-1">ビジネスの成長に合わせて最適なプランを選択してください</p>
                            </div>
                            <div class="p-6">
                                <div id="available-plans" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <!-- プランカードがJavaScriptで動的に生成される -->
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 課金履歴セクション -->
                    <div id="billing-section" class="content-section hidden">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h2 class="text-2xl font-bold text-gray-900">課金履歴</h2>
                                <p class="text-gray-600">プラン変更と支払い履歴を確認できます</p>
                            </div>
                            <button onclick="loadBillingHistory()" class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg">
                                <i class="fas fa-sync mr-2"></i>
                                更新
                            </button>
                        </div>

                        <!-- プラン変更履歴 -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div class="p-6 border-b border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900">プラン変更履歴</h3>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="min-w-full divide-y divide-gray-200">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日時</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">変更内容</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">実行者</th>
                                        </tr>
                                    </thead>
                                    <tbody id="billing-history-table" class="bg-white divide-y divide-gray-200">
                                        <tr>
                                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                                                履歴を読み込み中...
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>

        <!-- ユーザー追加モーダル -->
        <div id="add-user-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h3 class="text-lg font-medium text-gray-900">ユーザー招待</h3>
                            <p class="text-sm text-gray-600 mt-1">新しいユーザーをメールで招待します</p>
                        </div>
                        <button onclick="document.getElementById('add-user-modal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <form id="invite-user-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">招待先メールアドレス <span class="text-red-500">*</span></label>
                            <input type="email" name="email" required 
                                   class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                   placeholder="example@company.com">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">権限 <span class="text-red-500">*</span></label>
                            <select name="role" required class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <option value="">権限を選択してください</option>
                                <option value="user">一般ユーザー</option>
                                <option value="site_manager">サイト管理者</option>
                                <option value="admin">管理者</option>
                                <option value="super_admin">スーパー管理者</option>
                            </select>
                            <div class="mt-1 text-xs text-gray-500">
                                <div class="space-y-1">
                                    <div><strong>一般ユーザー:</strong> 基本機能のみ利用可能</div>
                                    <div><strong>サイト管理者:</strong> 担当事業所内のユーザー管理</div>
                                    <div><strong>管理者:</strong> ユーザー管理・システム設定</div>
                                    <div><strong>スーパー管理者:</strong> 全権限（テナント管理含む）</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">招待メッセージ</label>
                            <textarea name="message" rows="3" 
                                      class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      placeholder="PAL物流SaaSにご招待いたします。下記のリンクからアカウントを作成してください。"></textarea>
                            <div class="mt-1 text-xs text-gray-500">カスタムメッセージを追加できます（省略可）</div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">招待有効期限</label>
                            <select name="expires_in" class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <option value="24">24時間</option>
                                <option value="72">3日間</option>
                                <option value="168" selected>7日間（推奨）</option>
                                <option value="336">14日間</option>
                            </select>
                        </div>
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div class="flex items-start">
                                <i class="fas fa-info-circle text-blue-600 mt-0.5 mr-2"></i>
                                <div class="text-sm text-blue-800">
                                    <strong>招待の流れ:</strong><br>
                                    1. 招待メールが送信されます<br>
                                    2. 受信者がリンクをクリック<br>
                                    3. 名前とパスワードを設定<br>
                                    4. アカウント作成完了
                                </div>
                            </div>
                        </div>
                        <div class="flex justify-end space-x-3 mt-6">
                            <button type="button" onclick="document.getElementById('add-user-modal').classList.add('hidden')" class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                                キャンセル
                            </button>
                            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                <i class="fas fa-envelope mr-2"></i>
                                招待を送信
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- プラン変更確認モーダル -->
        <div id="change-plan-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">プラン変更の確認</h3>
                    <button onclick="document.getElementById('change-plan-modal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div id="plan-change-content" class="space-y-4">
                    <!-- JavaScriptで動的に生成 -->
                </div>
                
                <div class="flex justify-end space-x-3 pt-4">
                    <button type="button" onclick="document.getElementById('change-plan-modal').classList.add('hidden')" 
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        キャンセル
                    </button>
                    <button type="button" onclick="confirmPlanChange()" id="confirm-plan-change-btn"
                            class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                        <i class="fas fa-check mr-2"></i>
                        変更を実行
                    </button>
                </div>
            </div>
        </div>

        <!-- ユーザー編集モーダル -->
        <div id="edit-user-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">ユーザー編集</h3>
                    <button onclick="document.getElementById('edit-user-modal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form id="edit-user-form" class="space-y-4">
                    <input type="hidden" id="edit-user-id" name="user_id">
                    
                    <div>
                        <label for="edit-name" class="block text-sm font-medium text-gray-700 mb-2">表示名</label>
                        <input type="text" id="edit-name" name="display_name" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    
                    <div>
                        <label for="edit-email" class="block text-sm font-medium text-gray-700 mb-2">メールアドレス</label>
                        <input type="email" id="edit-email" name="email" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    
                    <div>
                        <label for="edit-role" class="block text-sm font-medium text-gray-700 mb-2">権限</label>
                        <select id="edit-role" name="role" required 
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="super_admin">スーパー管理者</option>
                            <option value="admin">管理者</option>
                            <option value="site_manager">サイト管理者</option>
                            <option value="user">一般ユーザー</option>
                        </select>
                    </div>
                    
                    <div>
                        <label for="edit-status" class="block text-sm font-medium text-gray-700 mb-2">ステータス</label>
                        <select id="edit-status" name="status" required 
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="active">アクティブ</option>
                            <option value="inactive">非アクティブ</option>
                            <option value="suspended">停止</option>
                        </select>
                    </div>
                    
                    <div class="flex justify-end space-x-3 pt-4">
                        <button type="button" onclick="document.getElementById('edit-user-modal').classList.add('hidden')" 
                                class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                            キャンセル
                        </button>
                        <button type="submit" 
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-save mr-2"></i>
                            更新
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="/static/dashboard.js"></script>
    </body>
    </html>
  `);
});

// 招待受諾ページ
app.get('/invite/:token', (c) => {
  const token = c.req.param('token');
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>アカウント作成 - PAL物流SaaS</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <!-- ロゴとタイトル -->
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full mb-4">
                    <i class="fas fa-truck-moving text-2xl"></i>
                </div>
                <h1 class="text-2xl font-bold text-gray-900 mb-2">アカウント作成</h1>
                <p class="text-gray-600 text-sm">PAL物流SaaSへようこそ</p>
            </div>

            <!-- エラー表示 -->
            <div id="error-message" class="hidden mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span id="error-text"></span>
                </div>
            </div>

            <!-- 成功メッセージ -->
            <div id="success-message" class="hidden mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md">
                <div class="flex items-center">
                    <i class="fas fa-check-circle mr-2"></i>
                    <span id="success-text"></span>
                </div>
            </div>

            <!-- 招待情報 -->
            <div id="invitation-info" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div class="flex items-center mb-2">
                    <i class="fas fa-envelope text-blue-600 mr-2"></i>
                    <span class="text-sm font-medium text-blue-900">招待されたメールアドレス</span>
                </div>
                <div id="invited-email" class="text-sm text-blue-800 font-mono"></div>
            </div>

            <!-- アカウント作成フォーム -->
            <form id="accept-invitation-form" class="space-y-6">
                <input type="hidden" id="invitation-token" value="${token}">
                
                <div>
                    <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
                        お名前 <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="name" 
                        name="name"
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="例: 田中 太郎"
                    >
                </div>

                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                        パスワード <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <input 
                            type="password" 
                            id="password" 
                            name="password"
                            required
                            minlength="8"
                            class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="8文字以上のパスワード"
                        >
                        <button type="button" id="toggle-password" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                    <div class="mt-2 text-xs">
                        <div class="space-y-1">
                            <div id="password-length" class="flex items-center">
                                <i class="fas fa-circle text-gray-300 mr-2 text-xs"></i>
                                <span class="text-gray-500">8文字以上</span>
                            </div>
                            <div id="password-char" class="flex items-center">
                                <i class="fas fa-circle text-gray-300 mr-2 text-xs"></i>
                                <span class="text-gray-500">英数字を含む</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label for="password-confirm" class="block text-sm font-medium text-gray-700 mb-2">
                        パスワード確認 <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="password" 
                        id="password-confirm" 
                        name="password_confirm"
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="パスワードを再入力"
                    >
                    <div id="password-match" class="mt-1 text-xs hidden">
                        <span id="password-match-text"></span>
                    </div>
                </div>

                <button 
                    type="submit" 
                    id="create-account-btn"
                    class="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 font-medium"
                >
                    <i class="fas fa-user-plus mr-2"></i>
                    アカウントを作成
                </button>

                <button 
                    type="button" 
                    id="loading-btn"
                    class="hidden w-full bg-gray-400 text-white py-3 px-4 rounded-md cursor-not-allowed font-medium"
                    disabled
                >
                    <i class="fas fa-spinner fa-spin mr-2"></i>
                    作成中...
                </button>
            </form>

            <!-- フッター -->
            <div class="mt-8 text-center text-xs text-gray-500">
                <p>© 2024 PAL物流SaaS. All rights reserved.</p>
            </div>
        </div>

        <script>
            const token = '${token}';
            let invitationData = null;

            // 招待情報の取得
            async function loadInvitationInfo() {
                // TODO: 招待情報取得API実装後に有効化
                // 現在はフォームを直接表示
            }

            // フォーム送信処理
            document.getElementById('accept-invitation-form').addEventListener('submit', async function(e) {
                e.preventDefault();

                const formData = new FormData(e.target);
                const name = formData.get('name');
                const password = formData.get('password');
                const passwordConfirm = formData.get('password_confirm');

                // バリデーション
                if (password !== passwordConfirm) {
                    showError('パスワードが一致しません');
                    return;
                }

                if (password.length < 8) {
                    showError('パスワードは8文字以上である必要があります');
                    return;
                }

                // ローディング状態
                document.getElementById('create-account-btn').classList.add('hidden');
                document.getElementById('loading-btn').classList.remove('hidden');

                try {
                    const response = await fetch(\`/api/invitations/accept/\${token}\`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: name,
                            password: password
                        })
                    });

                    const data = await response.json();

                    if (data.success) {
                        showSuccess('アカウントが作成されました。ログインページに移動します...');
                        setTimeout(() => {
                            window.location.href = '/login';
                        }, 2000);
                    } else {
                        showError(data.error || 'アカウント作成に失敗しました');
                    }
                } catch (error) {
                    console.error('Account creation error:', error);
                    showError('アカウント作成中にエラーが発生しました');
                } finally {
                    // ローディング状態解除
                    document.getElementById('create-account-btn').classList.remove('hidden');
                    document.getElementById('loading-btn').classList.add('hidden');
                }
            });

            // エラー表示
            function showError(message) {
                document.getElementById('error-text').textContent = message;
                document.getElementById('error-message').classList.remove('hidden');
                document.getElementById('success-message').classList.add('hidden');
            }

            // 成功メッセージ表示
            function showSuccess(message) {
                document.getElementById('success-text').textContent = message;
                document.getElementById('success-message').classList.remove('hidden');
                document.getElementById('error-message').classList.add('hidden');
            }

            // パスワード表示切り替え
            document.getElementById('toggle-password').addEventListener('click', function() {
                const passwordField = document.getElementById('password');
                const icon = this.querySelector('i');
                
                if (passwordField.type === 'password') {
                    passwordField.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    passwordField.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });

            // パスワード強度チェック
            document.getElementById('password').addEventListener('input', function() {
                const password = this.value;
                const lengthCheck = document.getElementById('password-length');
                const charCheck = document.getElementById('password-char');

                // 長さチェック
                if (password.length >= 8) {
                    lengthCheck.querySelector('i').className = 'fas fa-check-circle text-green-500 mr-2 text-xs';
                    lengthCheck.querySelector('span').className = 'text-green-600';
                } else {
                    lengthCheck.querySelector('i').className = 'fas fa-circle text-gray-300 mr-2 text-xs';
                    lengthCheck.querySelector('span').className = 'text-gray-500';
                }

                // 文字種チェック
                const hasLetter = /[a-zA-Z]/.test(password);
                const hasNumber = /[0-9]/.test(password);
                if (hasLetter && hasNumber) {
                    charCheck.querySelector('i').className = 'fas fa-check-circle text-green-500 mr-2 text-xs';
                    charCheck.querySelector('span').className = 'text-green-600';
                } else {
                    charCheck.querySelector('i').className = 'fas fa-circle text-gray-300 mr-2 text-xs';
                    charCheck.querySelector('span').className = 'text-gray-500';
                }
            });

            // パスワード一致チェック
            document.getElementById('password-confirm').addEventListener('input', function() {
                const password = document.getElementById('password').value;
                const confirm = this.value;
                const matchDiv = document.getElementById('password-match');
                const matchText = document.getElementById('password-match-text');

                if (confirm.length > 0) {
                    matchDiv.classList.remove('hidden');
                    if (password === confirm) {
                        matchText.textContent = '✓ パスワードが一致しています';
                        matchText.className = 'text-green-600';
                    } else {
                        matchText.textContent = '✗ パスワードが一致しません';
                        matchText.className = 'text-red-600';
                    }
                } else {
                    matchDiv.classList.add('hidden');
                }
            });

            // 初期化
            loadInvitationInfo();
        </script>
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
            // ログアウト関数
            async function logout() {
                try {
                    const response = await fetch('/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        // ページをリロードしてログアウト状態を反映
                        window.location.reload();
                    } else {
                        alert('ログアウトに失敗しました');
                    }
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('ログアウト中にエラーが発生しました');
                }
            }

            // セッションチェック - ログイン状態を確認してUIを動的に変更
            fetch('/api/auth/me', { credentials: 'include' })
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.user) {
                        // ログイン済みの場合、UIを更新
                        const buttonContainer = document.querySelector('.space-y-4.sm\\:space-y-0.sm\\:space-x-4.sm\\:flex.sm\\:justify-center');
                        
                        if (buttonContainer) {
                            buttonContainer.innerHTML = \`
                                <div class="bg-white rounded-lg shadow-md p-6 mb-8 max-w-md mx-auto">
                                    <div class="text-center">
                                        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <i class="fas fa-user-check text-green-600 text-2xl"></i>
                                        </div>
                                        <h3 class="text-lg font-semibold text-gray-900 mb-2">ログイン済み</h3>
                                        <p class="text-gray-600 mb-1">\${data.user.name || data.user.email}</p>
                                        <p class="text-sm text-gray-500 mb-6">\${data.user.role || 'ユーザー'}</p>
                                        
                                        <div class="space-y-3">
                                            <a href="/dashboard" class="block w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200">
                                                <i class="fas fa-tachometer-alt mr-2"></i>
                                                ダッシュボードへ
                                            </a>
                                            <button onclick="logout()" class="block w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200">
                                                <i class="fas fa-sign-out-alt mr-2"></i>
                                                ログアウト
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            \`;
                        }
                        
                        // ログイン済みメッセージを表示
                        const subtitle = document.querySelector('p.text-xl.text-gray-600.mb-8');
                        if (subtitle) {
                            subtitle.innerHTML = 'ようこそ！管理者ダッシュボードで各種管理業務を行えます。';
                            subtitle.classList.add('text-green-600');
                        }
                    }
                })
                .catch(error => {
                    // エラーは無視（ログインしていない状態）
                    console.log('ログインしていない状態です');
                });
        </script>
    </body>
    </html>
  `);
});

export default app;