// PAL物流SaaS ログイン管理システム - メインアプリケーション
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { auth } from './routes/auth-simple';
import { tenantMiddleware, securityHeaders } from './middleware/auth';
import { licenseCheckMiddleware } from './middleware/license';
import { roleSeparationMiddleware, requireServiceProvider, requireTenantAdmin } from './middleware/role-separation';
import { requireTwoFactorAuth } from './middleware/two-factor-auth';
import type { CloudflareBindings } from './types/auth';
import usersApi from './routes/users';
import licensesApi from './routes/licenses';
import licenseManagementApi from './routes/license-management';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// セキュリティヘッダー適用
app.use('*', securityHeaders);

// テナント分離ミドルウェア適用
app.use('*', tenantMiddleware);

// ライセンスチェックミドルウェア適用
app.use('*', licenseCheckMiddleware);

// 権限分離ミドルウェア適用
app.use('*', roleSeparationMiddleware);

// 2要素認証ミドルウェア適用（高権限機能に対して）
app.use('*', requireTwoFactorAuth);

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

// ユーザーアカウント管理API
import accountApi from './routes/account';
app.route('/api/account', accountApi);

// 管理者API（テナント管理者以上限定）
import adminApi from './routes/admin';
app.use('/api/admin/*', requireTenantAdmin);
app.route('/api/admin', adminApi);
app.route('/api/users', usersApi);
app.route('/api/licenses', licensesApi);
app.route('/api/license-management', licenseManagementApi);
import invitationsApi from './routes/invitations';
app.route('/api/invitations', invitationsApi);
import upgradeApi from './routes/upgrade';
app.route('/api/upgrade', upgradeApi);

// サービス提供者ダッシュボードAPI（サービス提供者限定）
import { providerDashboard } from './routes/provider-dashboard';
app.use('/api/provider-dashboard/*', requireServiceProvider);
app.route('/api/provider-dashboard', providerDashboard);

// サービス提供者認証API（サービス提供者限定）
import serviceProviderAuth from './routes/service-provider-auth';
app.use('/api/service-provider-auth/*', requireServiceProvider);
app.route('/api/service-provider-auth', serviceProviderAuth);

// 2要素認証API
import twoFactorAuthRoutes from './routes/two-factor-auth';
app.route('/api/auth/two-factor', twoFactorAuthRoutes);

// ログ管理API
import logsApi from './routes/logs';
app.use('/api/logs/*', requireTenantAdmin); // テナント管理者以上の権限が必要
app.route('/api/logs', logsApi);

// 緊急アクセス（ブレイクグラス）API
import breakglassApi from './routes/breakglass';
app.use('/api/breakglass/*', requireServiceProvider); // サービス提供者のみ
app.route('/api/breakglass', breakglassApi);

// データアップロードとマッピング機能API
import dataUploadApi from './routes/data-upload';
app.use('/api/data-upload/*', requireTenantAdmin); // テナント管理者以上の権限が必要
app.route('/api/data-upload', dataUploadApi);

// テンプレート管理API
import templateManagementApi from './routes/template-management';
app.use('/api/templates/*', requireTenantAdmin); // テナント管理者以上の権限が必要
app.route('/api/templates', templateManagementApi);

// 暗号化・キー管理API
import encryptionManagementApi from './routes/encryption-management';
app.use('/api/encryption/*', requireTenantAdmin); // テナント管理者以上の権限が必要
app.route('/api/encryption', encryptionManagementApi);

// AI学習データ同意管理API
import aiConsentManagementApi from './routes/ai-consent-management';
app.use('/api/ai-consent/*', requireTenantAdmin); // テナント管理者以上の権限が必要
app.route('/api/ai-consent', aiConsentManagementApi);

// フィールドアクセス制御API
import fieldAccessControlApi from './routes/field-access-control';
app.use('/api/field-access/*', requireTenantAdmin); // テナント管理者以上の権限が必要
app.route('/api/field-access', fieldAccessControlApi);

// クロステナント監査API
import crossTenantAuditApi from './routes/cross-tenant-audit';
app.use('/api/cross-tenant-audit/*', requireTenantAdmin); // テナント管理者以上の権限が必要
app.route('/api/cross-tenant-audit', crossTenantAuditApi);

// API 基本情報
app.get('/api', (c) => {
  return c.json({
    service: 'Core First 統合管理システム',
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
        <title>新規登録 - Core First</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/login.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <!-- ロゴとタイトル -->
            <div class="text-center mb-8">
                <div class="flex flex-col items-center justify-center mb-4">
                    <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                         alt="Core First Logo" 
                         class="w-12 h-12 mb-3">
                    <h2 class="text-2xl font-bold text-blue-900 mb-4">Core First</h2>
                    <h1 class="text-xl font-bold text-gray-900">新規アカウント登録</h1>
                </div>
                <p class="text-gray-600 text-sm">統合管理システムにご登録ください</p>
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
                <p>© 2024 Core First. All rights reserved.</p>
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
        <title>ログイン - Core First</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/login.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <!-- ロゴとタイトル -->
            <div class="text-center mb-8">
                <div class="flex flex-col items-center justify-center mb-4">
                    <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                         alt="Core First Logo" 
                         class="w-12 h-12 mb-3">
                    <h2 class="text-3xl font-bold text-blue-900 mb-4">Core First</h2>
                    <p class="text-gray-600 text-sm">統合管理システム</p>
                </div>
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
                <p>© 2024 Core First. All rights reserved.</p>
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
        <title>管理画面 - Core First</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100">
        <div id="admin-app" class="min-h-screen">
            <!-- 認証チェック中のローディング -->
            <div id="loading" class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                    <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                         alt="Core First Logo" 
                         class="w-12 h-12 mx-auto mb-4">
                    <i class="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
                    <p class="text-gray-600">読み込み中...</p>
                </div>
            </div>
        </div>

        <script>
            console.log('Inline script loaded');
            // エラーリスナーを設定
            window.addEventListener('error', function(e) {
                console.error('Global JavaScript error:', e.error, e.message, e.filename, e.lineno);
            });
            
            // JavaScriptファイルの読み込み確認
            const script = document.createElement('script');
            script.onload = function() {
                console.log('External JS file loaded successfully');
                // スクリプト読み込み後に少し待ってからチェック
                setTimeout(function() {
                    console.log('Checking if initialization functions exist...');
                    if (typeof checkAuth === 'function') {
                        console.log('checkAuth function found - starting authentication check');
                        checkAuth();
                    } else {
                        console.error('checkAuth function not found');
                    }
                }, 100);
            };
            script.onerror = function(e) {
                console.error('Failed to load external JS file:', e);
            };
            script.src = '/static/admin.js';
            document.head.appendChild(script);
        </script>
    </body>
    </html>
  `);
});



// サービス提供者管理ダッシュボード（Core First運営側）
app.get('/admin-dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Core First 統合管理システム - サービス提供者ダッシュボード</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="/static/admin-provider-dashboard.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="flex h-screen overflow-hidden">
            <!-- サイドバー -->
            <aside id="sidebar" class="flex-shrink-0 w-80 bg-white transition-all duration-300 ease-in-out shadow-xl border-r border-gray-200">
                <div class="flex flex-col h-full">
                    <!-- ロゴ -->
                    <div class="flex items-center h-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4">
                        <!-- 展開時のロゴ（画像 + テキスト） -->
                        <div class="flex items-center sidebar-text" id="sidebar-logo">
                            <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                                 alt="Core First Logo" 
                                 class="w-8 h-8 mr-3 filter brightness-0 invert drop-shadow-sm">
                            <div>
                                <h3 class="text-lg font-bold">Core First</h3>
                                <p class="text-xs opacity-90">統合管理システム</p>
                            </div>
                        </div>
                        <!-- 折りたたみ時のロゴ（画像のみ） -->
                        <div class="sidebar-icon hidden items-center justify-center" id="sidebar-logo-collapsed">
                            <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                                 alt="Core First Logo" 
                                 class="w-8 h-8 filter brightness-0 invert drop-shadow-sm">
                        </div>
                    </div>

                    <!-- ナビゲーションメニュー -->
                    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                        <!-- メイン統合ダッシュボード -->
                        <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg mx-2 sidebar-text">
                            <i class="fas fa-globe mr-2 text-blue-600"></i>統合管理
                        </div>
                        <a href="#" class="nav-item active" data-section="overview" data-tooltip="統合ダッシュボード - 全テナント概要・KPI">
                            <i class="fas fa-chart-pie text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">統合ダッシュボード</span>
                                <div class="text-xs mt-0.5">全テナント・売上・稼働率</div>
                            </div>
                        </a>
                        
                        <a href="#" class="nav-item" data-section="realtime-monitoring" data-tooltip="リアルタイム監視 - システム状況・アラート">
                            <i class="fas fa-heartbeat text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">リアルタイム監視</span>
                                <div class="text-xs mt-0.5">システム状況・アラート</div>
                            </div>
                        </a>

                        <!-- テナント管理セクション -->
                        <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8 px-3 py-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg mx-2 sidebar-text">
                            <i class="fas fa-building mr-2 text-purple-600"></i>テナント管理
                        </div>
                        
                        <a href="#" class="nav-item" data-section="tenant-management" data-tooltip="テナント管理 - 企業管理・プラン設定">
                            <i class="fas fa-city text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">テナント管理</span>
                                <div class="text-xs mt-0.5">企業管理・プラン設定</div>
                            </div>
                        </a>
                        
                        <a href="#" class="nav-item" data-section="cross-tenant-users" data-tooltip="横断ユーザー管理 - 全テナント検索・緊急操作">
                            <i class="fas fa-users-cog text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">横断ユーザー管理</span>
                                <div class="text-xs mt-0.5">全テナント検索・緊急操作</div>
                            </div>
                        </a>
                        
                        <a href="#" class="nav-item" data-section="usage-analytics" data-tooltip="利用分析 - テナント別利用状況・傾向分析">
                            <i class="fas fa-analytics text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">利用分析</span>
                                <div class="text-xs mt-0.5">テナント別利用状況・傾向</div>
                            </div>
                        </a>

                        <!-- 請求・課金管理セクション -->
                        <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8 px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg mx-2 sidebar-text">
                            <i class="fas fa-dollar-sign mr-2 text-green-600"></i>課金管理
                        </div>
                        
                        <a href="#" class="nav-item" data-section="revenue-dashboard" data-tooltip="売上ダッシュボード - 売上分析・予測">
                            <i class="fas fa-chart-line text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">売上ダッシュボード</span>
                                <div class="text-xs mt-0.5">売上分析・予測</div>
                            </div>
                        </a>
                        
                        <a href="#" class="nav-item" data-section="billing-management" data-tooltip="請求管理 - 一括発行・支払い状況">
                            <i class="fas fa-file-invoice-dollar text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">請求管理</span>
                                <div class="text-xs mt-0.5">一括発行・支払い状況</div>
                            </div>
                        </a>
                        
                        <a href="#" class="nav-item" data-section="subscription-management" data-tooltip="サブスクリプション管理 - プラン変更・キャンセル">
                            <i class="fas fa-sync-alt text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">サブスクリプション</span>
                                <div class="text-xs mt-0.5">プラン変更・キャンセル</div>
                            </div>
                        </a>

                        <!-- サポート・顧客管理セクション -->
                        <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8 px-3 py-2 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg mx-2 sidebar-text">
                            <i class="fas fa-headset mr-2 text-orange-600"></i>サポート
                        </div>
                        
                        <a href="#" class="nav-item" data-section="support-tickets" data-tooltip="サポートチケット - 問い合わせ管理">
                            <i class="fas fa-ticket-alt text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">サポートチケット</span>
                                <div class="text-xs mt-0.5">問い合わせ管理</div>
                            </div>
                        </a>
                        
                        <a href="#" class="nav-item" data-section="customer-success" data-tooltip="カスタマーサクセス - 健全性・チャーン予測">
                            <i class="fas fa-users-crown text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">カスタマーサクセス</span>
                                <div class="text-xs mt-0.5">健全性・チャーン予測</div>
                            </div>
                        </a>

                        <!-- システム管理セクション -->
                        <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8 px-3 py-2 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg mx-2 sidebar-text">
                            <i class="fas fa-server mr-2 text-red-600"></i>システム管理
                        </div>
                        
                        <a href="#" class="nav-item" data-section="system-monitoring" data-tooltip="システム監視 - パフォーマンス・障害監視">
                            <i class="fas fa-desktop text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">システム監視</span>
                                <div class="text-xs mt-0.5">パフォーマンス・障害監視</div>
                            </div>
                        </a>
                        
                        <a href="#" class="nav-item" data-section="audit-logs" data-tooltip="監査ログ - セキュリティ・コンプライアンス">
                            <i class="fas fa-shield-alt text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">監査ログ</span>
                                <div class="text-xs mt-0.5">セキュリティ・コンプライアンス</div>
                            </div>
                        </a>
                        
                        <a href="#" class="nav-item" data-section="backup-management" data-tooltip="バックアップ管理 - データ保護・復旧">
                            <i class="fas fa-database text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">バックアップ管理</span>
                                <div class="text-xs mt-0.5">データ保護・復旧</div>
                            </div>
                        </a>

                        <!-- 管理者管理セクション -->
                        <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 mt-8 px-3 py-2 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg mx-2 sidebar-text">
                            <i class="fas fa-users-shield mr-2 text-indigo-600"></i>管理者管理
                        </div>
                        
                        <a href="#" class="nav-item" data-section="admin-users" data-tooltip="管理者管理 - 提供者側管理者アカウント">
                            <i class="fas fa-user-shield text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">管理者管理</span>
                                <div class="text-xs mt-0.5">提供者側管理者アカウント</div>
                            </div>
                        </a>
                        
                        <a href="#" class="nav-item" data-section="role-permissions" data-tooltip="権限管理 - ロール・アクセス制御">
                            <i class="fas fa-key text-lg nav-icon"></i>
                            <div class="flex-1 sidebar-text">
                                <span class="font-medium">権限管理</span>
                                <div class="text-xs mt-0.5">ロール・アクセス制御</div>
                            </div>
                        </a>
                    </nav>

                    <!-- ロール切り替えボタン -->
                    <div class="border-t border-gray-200 p-4">
                        <div class="mb-4">
                            <button id="switch-to-tenant" class="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-3 py-2 rounded-md text-sm transition-all shadow-sm sidebar-text">
                                <i class="fas fa-exchange-alt mr-2"></i>
                                <span>テナント管理画面</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- ユーザー情報 -->
                    <div class="border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 p-4">
                        <div class="flex items-center">
                            <div class="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                <i class="fas fa-user-crown"></i>
                            </div>
                            <div class="ml-3 sidebar-text">
                                <p class="text-sm font-medium text-gray-900" id="user-name">Core First 管理者</p>
                                <p class="text-xs text-gray-600" id="user-role">スーパー管理者</p>
                                <p class="text-xs text-blue-600 font-medium">サービス提供者側</p>
                            </div>
                        </div>
                        <div class="mt-3 space-y-2">
                            <button id="profile-button" class="w-full bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-md text-sm transition-colors border border-gray-300 shadow-sm sidebar-text">
                                <i class="fas fa-user-edit mr-2"></i>
                                <span>プロフィール設定</span>
                            </button>
                            <button id="logout-button" class="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm transition-colors shadow-sm sidebar-text">
                                <i class="fas fa-sign-out-alt mr-2"></i>
                                <span>ログアウト</span>
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            <!-- メインコンテンツ -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- トップバー -->
                <header class="bg-white shadow-sm border-b h-16 flex items-center justify-between px-6">
                    <div class="flex items-center">
                        <button id="sidebar-toggle" class="text-gray-600 hover:text-gray-900 mr-4">
                            <i class="fas fa-bars text-lg"></i>
                        </button>
                        <div>
                            <h1 class="text-xl font-semibold text-gray-900" id="page-title">Core First 統合管理システム</h1>
                            <p class="text-sm text-gray-600" id="page-subtitle">サービス提供者ダッシュボード - 全テナント統合管理</p>
                        </div>
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
                        
                        <!-- ユーザープロファイルドロップダウン -->
                        <div class="relative">
                            <button onclick="toggleUserMenu()" id="user-menu-button" class="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none">
                                <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                    <span class="text-white text-sm font-medium">管</span>
                                </div>
                                <i class="fas fa-chevron-down text-xs"></i>
                            </button>
                            
                            <!-- ドロップダウンメニュー -->
                            <div id="user-menu" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                                <!-- ユーザー情報 -->
                                <div class="px-4 py-3 border-b border-gray-100">
                                    <p class="text-sm font-medium text-gray-900">管理者</p>
                                    <p class="text-xs text-gray-500">admin@corefirst.com</p>
                                    <span class="inline-block mt-1 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">スーパー管理者</span>
                                </div>
                                
                                <!-- メニュー項目 -->
                                <div class="py-1">
                                    <a href="#" onclick="showSection('profile')" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <i class="fas fa-user mr-3 text-gray-400"></i>
                                        プロファイル設定
                                    </a>
                                    <a href="#" onclick="showSection('security')" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <i class="fas fa-shield-alt mr-3 text-gray-400"></i>
                                        セキュリティ設定
                                    </a>
                                    <a href="/tenant-dashboard" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <i class="fas fa-tachometer-alt mr-3 text-gray-400"></i>
                                        テナント管理画面
                                    </a>
                                </div>
                                
                                <div class="border-t border-gray-100 py-1">
                                    <a href="#" onclick="logout()" class="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                        <i class="fas fa-sign-out-alt mr-3"></i>
                                        ログアウト
                                    </a>
                                </div>
                            </div>
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
                                    <button onclick="showSection('users'); showModal('add-user-modal');" class="flex flex-col items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all">
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
                            <button onclick="showModal('add-user-modal')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
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

                    <!-- プロフィール編集セクション -->
                    <div id="profile-section" class="content-section hidden">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h2 class="text-2xl font-bold text-gray-900">プロフィール管理</h2>
                                <p class="text-gray-600">基本情報と個人設定を管理します</p>
                            </div>
                            <button onclick="loadProfile()" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">
                                <i class="fas fa-sync mr-2"></i>
                                更新
                            </button>
                        </div>

                        <!-- 基本情報カード -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                            <div class="p-6 border-b border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                                    <i class="fas fa-user mr-2 text-purple-600"></i>
                                    基本情報
                                </h3>
                            </div>
                            <div class="p-6">
                                <form id="profile-form">
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <!-- 表示名 -->
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">表示名 <span class="text-red-500">*</span></label>
                                            <input type="text" id="display-name" name="displayName" required
                                                   class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                   placeholder="山田 太郎">
                                        </div>
                                        
                                        <!-- メールアドレス -->
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">メールアドレス</label>
                                            <input type="email" id="email" name="email" readonly
                                                   class="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
                                                   placeholder="yamada@company.com">
                                            <p class="text-xs text-gray-500 mt-1">メールアドレスは変更できません</p>
                                        </div>
                                        
                                        <!-- 電話番号 -->
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">電話番号</label>
                                            <input type="tel" id="phone-number" name="phoneNumber"
                                                   class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                   placeholder="090-1234-5678">
                                        </div>
                                        
                                        <!-- 言語設定 -->
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">言語</label>
                                            <select id="locale" name="locale" class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                                                <option value="ja-JP">日本語</option>
                                                <option value="en-US">English (US)</option>
                                                <option value="zh-CN">中文 (简体)</option>
                                                <option value="ko-KR">한국어</option>
                                            </select>
                                        </div>
                                        
                                        <!-- タイムゾーン -->
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">タイムゾーン</label>
                                            <select id="timezone" name="timezone" class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                                                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                                                <option value="UTC">UTC</option>
                                                <option value="America/New_York">America/New_York (EST)</option>
                                                <option value="Europe/London">Europe/London (GMT)</option>
                                            </select>
                                        </div>
                                        
                                        <!-- アカウント情報 -->
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">アカウント作成日</label>
                                            <input type="text" id="created-at" readonly
                                                   class="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500">
                                        </div>
                                    </div>
                                    
                                    <div class="mt-6 flex justify-end">
                                        <button type="submit" class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg">
                                            <i class="fas fa-save mr-2"></i>
                                            プロフィールを更新
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <!-- ロール・権限情報 -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div class="p-6 border-b border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                                    <i class="fas fa-shield-alt mr-2 text-green-600"></i>
                                    ロール・権限
                                </h3>
                            </div>
                            <div class="p-6">
                                <div id="user-roles" class="space-y-3">
                                    <!-- ロール情報がJavaScriptで挿入される -->
                                    <p class="text-gray-500">読み込み中...</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- セキュリティ設定セクション -->
                    <div id="security-section" class="content-section hidden">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h2 class="text-2xl font-bold text-gray-900">セキュリティ設定</h2>
                                <p class="text-gray-600">パスワードと2要素認証の設定を管理します</p>
                            </div>
                        </div>

                        <!-- パスワード変更 -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                            <div class="p-6 border-b border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                                    <i class="fas fa-lock mr-2 text-red-600"></i>
                                    パスワード変更
                                </h3>
                            </div>
                            <div class="p-6">
                                <form id="password-form">
                                    <div class="space-y-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">現在のパスワード <span class="text-red-500">*</span></label>
                                            <input type="password" name="currentPassword" required
                                                   class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                                        </div>
                                        
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">新しいパスワード <span class="text-red-500">*</span></label>
                                            <input type="password" name="newPassword" required
                                                   class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                                            <div class="mt-1 text-xs text-gray-500">
                                                8文字以上、大文字・小文字・数字・記号のうち3種類以上を含む必要があります
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-2">新しいパスワード（確認） <span class="text-red-500">*</span></label>
                                            <input type="password" name="confirmPassword" required
                                                   class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                                        </div>
                                    </div>
                                    
                                    <div class="mt-6 flex justify-end">
                                        <button type="submit" class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg">
                                            <i class="fas fa-key mr-2"></i>
                                            パスワードを変更
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <!-- 2要素認証設定 -->
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div class="p-6 border-b border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                                    <i class="fas fa-mobile-alt mr-2 text-blue-600"></i>
                                    2要素認証
                                </h3>
                            </div>
                            <div class="p-6">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="font-medium text-gray-900">2要素認証の状態</h4>
                                        <p class="text-sm text-gray-600">セキュリティを強化するために2要素認証を有効にしてください</p>
                                    </div>
                                    <div class="flex items-center">
                                        <span id="2fa-status" class="mr-3 text-sm font-medium">読み込み中...</span>
                                        <button id="2fa-toggle" onclick="toggle2FA()" class="bg-gray-300 text-gray-600 px-4 py-2 rounded-lg disabled:opacity-50">
                                            処理中...
                                        </button>
                                    </div>
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
                        <button onclick="hideModal('add-user-modal')" class="text-gray-400 hover:text-gray-600">
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
                                      placeholder="Core Firstにご招待いたします。下記のリンクからアカウントを作成してください。"></textarea>
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
                            <button type="button" onclick="hideModal('add-user-modal')" class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
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

        <!-- ユーザー編集モーダル（スーパー管理者専用） -->
        <div id="edit-user-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900">ユーザー情報編集</h3>
                        <p class="text-sm text-gray-600">スーパー管理者専用機能</p>
                    </div>
                    <button onclick="hideModal('edit-user-modal')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form id="edit-user-form">
                    <input type="hidden" id="edit-user-id" name="user_id">
                    
                    <!-- 基本情報 -->
                    <div class="mb-6">
                        <h4 class="text-md font-semibold text-gray-900 mb-3 flex items-center">
                            <i class="fas fa-user mr-2 text-blue-600"></i>
                            基本情報
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="edit-display-name" class="block text-sm font-medium text-gray-700 mb-2">表示名 <span class="text-red-500">*</span></label>
                                <input type="text" id="edit-display-name" name="displayName" required 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            </div>
                            
                            <div>
                                <label for="edit-email" class="block text-sm font-medium text-gray-700 mb-2">メールアドレス <span class="text-red-500">*</span></label>
                                <input type="email" id="edit-email" name="email" required 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            </div>
                            
                            <div>
                                <label for="edit-phone" class="block text-sm font-medium text-gray-700 mb-2">電話番号</label>
                                <input type="tel" id="edit-phone" name="phoneNumber" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                       placeholder="090-1234-5678">
                            </div>
                            
                            <div>
                                <label for="edit-status" class="block text-sm font-medium text-gray-700 mb-2">ステータス <span class="text-red-500">*</span></label>
                                <select id="edit-status" name="status" required 
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                    <option value="active">有効</option>
                                    <option value="disabled">無効</option>
                                    <option value="frozen">凍結</option>
                                    <option value="trial_expired">試用期間終了</option>
                                </select>
                            </div>
                            
                            <div>
                                <label for="edit-locale" class="block text-sm font-medium text-gray-700 mb-2">言語</label>
                                <select id="edit-locale" name="locale" 
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                    <option value="ja-JP">日本語</option>
                                    <option value="en-US">English (US)</option>
                                    <option value="zh-CN">简体中文</option>
                                    <option value="ko-KR">한국어</option>
                                </select>
                            </div>
                            
                            <div>
                                <label for="edit-timezone" class="block text-sm font-medium text-gray-700 mb-2">タイムゾーン</label>
                                <select id="edit-timezone" name="timezone" 
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                                    <option value="America/New_York">America/New_York (EST)</option>
                                    <option value="Europe/London">Europe/London (GMT)</option>
                                    <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                                    <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- セキュリティ設定 -->
                    <div class="mb-6">
                        <h4 class="text-md font-semibold text-gray-900 mb-3 flex items-center">
                            <i class="fas fa-shield-alt mr-2 text-green-600"></i>
                            セキュリティ設定
                        </h4>
                        <div class="space-y-4">
                            <div class="flex items-center space-x-4">
                                <label class="flex items-center">
                                    <input type="checkbox" id="edit-email-verified" name="emailVerified" 
                                           class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                                    <span class="ml-2 text-sm text-gray-700">メールアドレス認証済み</span>
                                </label>
                                
                                <label class="flex items-center">
                                    <input type="checkbox" id="edit-must-reset" name="mustResetPassword" 
                                           class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                                    <span class="ml-2 text-sm text-gray-700">次回ログイン時にパスワード変更を要求</span>
                                </label>
                                
                                <label class="flex items-center">
                                    <input type="checkbox" id="edit-two-fa" name="twoFaEnabled" 
                                           class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                                    <span class="ml-2 text-sm text-gray-700">2要素認証有効</span>
                                </label>
                            </div>
                            
                            <div>
                                <label class="flex items-center">
                                    <input type="checkbox" id="edit-reset-failed-logins" name="resetFailedLogins" 
                                           class="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500">
                                    <span class="ml-2 text-sm text-gray-700">ログイン失敗回数をリセットしてアカウントロックを解除</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 危険な操作 -->
                    <div class="mb-6">
                        <h4 class="text-md font-semibold text-gray-900 mb-3 flex items-center">
                            <i class="fas fa-exclamation-triangle mr-2 text-red-600"></i>
                            危険な操作
                        </h4>
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div class="space-y-3">
                                <button type="button" onclick="showPasswordResetModal()" 
                                        class="w-full md:w-auto px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 mr-2">
                                    <i class="fas fa-key mr-2"></i>
                                    パスワードをリセット
                                </button>
                                
                                <button type="button" onclick="deleteUser()" 
                                        class="w-full md:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                                    <i class="fas fa-trash mr-2"></i>
                                    ユーザーを削除
                                </button>
                            </div>
                            <p class="text-sm text-red-700 mt-2">
                                <i class="fas fa-info-circle mr-1"></i>
                                これらの操作は取り消すことができません。注意して実行してください。
                            </p>
                        </div>
                    </div>
                    
                    <!-- 操作ボタン -->
                    <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button type="button" onclick="hideModal('edit-user-modal')" 
                                class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                            キャンセル
                        </button>
                        <button type="submit" 
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-save mr-2"></i>
                            変更を保存
                        </button>
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

        <!-- パスワードリセットモーダル -->
        <div id="password-reset-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900">パスワードリセット</h3>
                        <p class="text-sm text-gray-600">管理者によるパスワードリセット</p>
                    </div>
                    <button onclick="hideModal('password-reset-modal')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form id="password-reset-form">
                    <input type="hidden" id="reset-user-id">
                    
                    <div class="space-y-4">
                        <div>
                            <label for="temp-password" class="block text-sm font-medium text-gray-700 mb-2">新しい一時パスワード</label>
                            <input type="text" id="temp-password" name="temporaryPassword" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                                   placeholder="空欄の場合は自動生成されます">
                            <div class="mt-1 text-xs text-gray-500">
                                空欄にすると「Temp####!」形式で自動生成されます
                            </div>
                        </div>
                        
                        <div>
                            <label class="flex items-center">
                                <input type="checkbox" id="require-reset" name="requireReset" checked 
                                       class="h-4 w-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500">
                                <span class="ml-2 text-sm text-gray-700">次回ログイン時にパスワード変更を要求</span>
                            </label>
                        </div>
                        
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div class="flex items-start">
                                <i class="fas fa-exclamation-triangle text-yellow-600 mt-0.5 mr-2"></i>
                                <div class="text-sm text-yellow-800">
                                    <strong>注意事項:</strong><br>
                                    • パスワードがリセットされます<br>
                                    • ログイン失敗回数もリセットされます<br>
                                    • アカウントロックが解除されます<br>
                                    • ユーザーに新しいパスワードを安全に通知してください
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end space-x-3 pt-4">
                        <button type="button" onclick="hideModal('password-reset-modal')" 
                                class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                            キャンセル
                        </button>
                        <button type="submit" 
                                class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                            <i class="fas fa-key mr-2"></i>
                            パスワードをリセット
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            console.log('Inline script loaded');
            // エラーリスナーを設定
            window.addEventListener('error', function(e) {
                console.error('Global JavaScript error:', e.error, e.message, e.filename, e.lineno);
            });
            
            // JavaScriptファイルの読み込み確認
            const script = document.createElement('script');
            script.onload = function() {
                console.log('External JS file loaded successfully');
                // スクリプト読み込み後に少し待ってからチェック
                setTimeout(function() {
                    console.log('Checking if initialization functions exist...');
                    if (typeof initializeWhenReady === 'function') {
                        console.log('initializeWhenReady function found');
                    } else {
                        console.error('initializeWhenReady function not found');
                    }
                }, 100);
            };
            script.onerror = function(e) {
                console.error('Failed to load external JS file:', e);
            };
            script.src = '/static/admin-provider-dashboard.js';
            document.head.appendChild(script);
        </script>
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
        <title>アカウント作成 - Core First</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <!-- ロゴとタイトル -->
            <div class="text-center mb-8">
                <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                     alt="Core First Logo" 
                     class="w-16 h-16 mx-auto mb-4">
                <h1 class="text-2xl font-bold text-gray-900 mb-2">アカウント作成</h1>
                <p class="text-gray-600 text-sm">Core Firstへようこそ</p>
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
                <p>© 2024 Core First. All rights reserved.</p>
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
        <title>Core First - 統合管理システム</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-white">
        <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div class="text-center max-w-2xl mx-auto px-4">
                <!-- ロゴとタイトル -->
                <div class="mb-8">
                    <div class="flex items-center justify-center mb-6">
                        <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                             alt="Core First Logo" 
                             class="w-16 h-16 mr-4">
                        <h1 class="text-4xl font-bold text-blue-900">Core First</h1>
                    </div>
                    <p class="text-xl text-gray-600">統合管理システムで、ビジネスを効率化する</p>
                </div>
                
                <!-- 機能紹介 -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div class="p-6 bg-white rounded-lg shadow-md">
                        <i class="fas fa-users text-blue-600 text-3xl mb-4"></i>
                        <h3 class="text-lg font-semibold mb-2">ユーザー管理</h3>
                        <p class="text-gray-600">企業単位でのマルチテナント対応統合管理</p>
                    </div>
                    <div class="p-6 bg-white rounded-lg shadow-md">
                        <i class="fas fa-shield-alt text-blue-600 text-3xl mb-4"></i>
                        <h3 class="text-lg font-semibold mb-2">セキュリティ</h3>
                        <p class="text-gray-600">2要素認証とスーパー管理者権限管理</p>
                    </div>
                    <div class="p-6 bg-white rounded-lg shadow-md">
                        <i class="fas fa-cogs text-blue-600 text-3xl mb-4"></i>
                        <h3 class="text-lg font-semibold mb-2">統合管理</h3>
                        <p class="text-gray-600">プラン管理・監査ログ・レポート機能</p>
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
                    <p>© 2024 Core First. All rights reserved.</p>
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

// CLO向けチュートリアル・トップページ（ログイン後のデフォルト）
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Core First - CLO向けサイト</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/clo-tutorial.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <!-- ヘッダー -->
        <header class="bg-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <!-- ロゴ -->
                    <div class="flex items-center">
                        <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                             alt="Core First Logo" 
                             class="w-8 h-8 mr-3">
                        <h1 class="text-xl font-bold text-blue-900">Core First</h1>
                        <span class="ml-2 text-sm text-gray-500">CLO向けサイト</span>
                    </div>
                    
                    <!-- ユーザープロファイル -->
                    <div class="flex items-center space-x-4">
                        <div class="text-sm text-gray-600">
                            <span id="current-time"></span>
                        </div>
                        <div class="relative">
                            <button onclick="toggleUserMenu()" id="user-menu-button" class="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none">
                                <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                    <span class="text-white text-sm font-medium">C</span>
                                </div>
                                <i class="fas fa-chevron-down text-xs"></i>
                            </button>
                            
                            <!-- ドロップダウンメニュー -->
                            <div id="user-menu" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                                <div class="px-4 py-3 border-b border-gray-100">
                                    <p class="text-sm font-medium text-gray-900">CLO ユーザー</p>
                                    <p class="text-xs text-gray-500">clo@example.com</p>
                                    <span class="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">CLO</span>
                                </div>
                                <div class="py-1">
                                    <a href="#" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <i class="fas fa-user mr-3 text-gray-400"></i>プロファイル設定
                                    </a>
                                    <a href="/admin-dashboard" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <i class="fas fa-cogs mr-3 text-gray-400"></i>管理者ダッシュボード
                                    </a>
                                </div>
                                <div class="border-t border-gray-100 py-1">
                                    <a href="#" onclick="logout()" class="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                        <i class="fas fa-sign-out-alt mr-3"></i>ログアウト
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <!-- メインコンテンツ -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <!-- ウェルカムセクション -->
            <div class="text-center mb-16">
                <h1 class="text-4xl font-bold text-gray-900 mb-4">
                    物流・サプライチェーン管理へようこそ
                </h1>
                <p class="text-xl text-gray-600 mb-8">
                    AIを活用した高度な分析で、物流効率を最大化しましょう
                </p>
                <div class="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <i class="fas fa-play mr-2"></i>
                    チュートリアルを開始
                </div>
            </div>

            <!-- 機能カードグリッド -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                <!-- メインダッシュボード -->
                <div class="feature-card" onclick="navigateTo('/main-dashboard')">
                    <div class="feature-icon bg-blue-100">
                        <i class="fas fa-tachometer-alt text-blue-600 text-3xl"></i>
                    </div>
                    <h3 class="feature-title">メインダッシュボード</h3>
                    <p class="feature-description">
                        総合評価と利用状況の可視化<br>
                        KPI監視とリアルタイム分析
                    </p>
                    <div class="feature-badge">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>

                <!-- AI分析・チャット -->
                <div class="feature-card" onclick="navigateTo('/ai-analysis')">
                    <div class="feature-icon bg-green-100">
                        <i class="fas fa-brain text-green-600 text-3xl"></i>
                    </div>
                    <h3 class="feature-title">AI分析・チャット</h3>
                    <p class="feature-description">
                        積載効率・庫内作業・荷待ち時間の改善<br>
                        自然言語での相談・質問
                    </p>
                    <div class="feature-badge">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>

                <!-- データ連携・マッピング -->
                <div class="feature-card" onclick="navigateTo('/data-mapping')">
                    <div class="feature-icon bg-purple-100">
                        <i class="fas fa-upload text-purple-600 text-3xl"></i>
                    </div>
                    <h3 class="feature-title">データ連携・マッピング</h3>
                    <p class="feature-description">
                        CSV・Excel等のデータアップロード<br>
                        AI自動マッピングとデータ変換
                    </p>
                    <div class="feature-badge">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>

                <!-- データ連携・統合管理 -->
                <div class="feature-card" onclick="navigateTo('/data-integration')">
                    <div class="feature-icon bg-orange-100">
                        <i class="fas fa-database text-orange-600 text-3xl"></i>
                    </div>
                    <h3 class="feature-title">データ連携・統合管理</h3>
                    <p class="feature-description">
                        外部システムとのAPI連携<br>
                        IoTデバイス・ERP統合
                    </p>
                    <div class="feature-badge">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>

                <!-- レポート管理 -->
                <div class="feature-card" onclick="navigateTo('/report-management')">
                    <div class="feature-icon bg-red-100">
                        <i class="fas fa-file-alt text-red-600 text-3xl"></i>
                    </div>
                    <h3 class="feature-title">レポート管理</h3>
                    <p class="feature-description">
                        自動レポート生成・スケジュール配信<br>
                        カスタムレポート・共有機能
                    </p>
                    <div class="feature-badge">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>

                <!-- ライセンス・チーム管理 -->
                <div class="feature-card" onclick="navigateTo('/license-management')">
                    <div class="feature-icon bg-yellow-100">
                        <i class="fas fa-users-cog text-yellow-600 text-3xl"></i>
                    </div>
                    <h3 class="feature-title">ライセンス・チーム管理</h3>
                    <p class="feature-description">
                        プラン管理・課金処理<br>
                        ユーザー招待・権限設定
                    </p>
                    <div class="feature-badge">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>

            <!-- はじめ方ガイド -->
            <div class="bg-white rounded-xl shadow-lg p-8">
                <div class="text-center mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-rocket mr-3 text-blue-600"></i>
                        はじめ方ガイド
                    </h2>
                    <p class="text-gray-600">Core Firstを効果的にご利用いただくための推奨ステップ</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl font-bold text-blue-600">1</span>
                        </div>
                        <h3 class="font-semibold text-gray-900 mb-2">データのアップロード</h3>
                        <p class="text-sm text-gray-600">
                            配送データ・在庫データ・顧客マスタをアップロードして、AI分析の準備をしましょう
                        </p>
                    </div>

                    <div class="text-center">
                        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl font-bold text-green-600">2</span>
                        </div>
                        <h3 class="font-semibold text-gray-900 mb-2">AI分析の実行</h3>
                        <p class="text-sm text-gray-600">
                            積載効率改善・庫内作業改善・荷待ち時間短縮等のAI分析を実行して最適化案を取得
                        </p>
                    </div>

                    <div class="text-center">
                        <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl font-bold text-purple-600">3</span>
                        </div>
                        <h3 class="font-semibold text-gray-900 mb-2">レポート・共有</h3>
                        <p class="text-sm text-gray-600">
                            分析結果をレポート化し、チームメンバーと共有して改善活動を推進しましょう
                        </p>
                    </div>
                </div>

                <div class="text-center mt-8">
                    <button onclick="navigateTo('/data-mapping')" class="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105">
                        <i class="fas fa-upload mr-2"></i>
                        データアップロードから始める
                    </button>
                </div>
            </div>
        </main>

        <script>
            // ユーザーメニュー切り替え
            function toggleUserMenu() {
                const menu = document.getElementById('user-menu');
                if (menu) {
                    menu.classList.toggle('hidden');
                }
            }

            // メニュー外クリックで閉じる
            document.addEventListener('click', function(event) {
                const menu = document.getElementById('user-menu');
                const button = document.getElementById('user-menu-button');
                
                if (menu && button && !button.contains(event.target) && !menu.contains(event.target)) {
                    menu.classList.add('hidden');
                }
            });

            // 画面遷移
            function navigateTo(path) {
                window.location.href = path;
            }

            // ログアウト
            async function logout() {
                try {
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include'
                    });
                    window.location.href = '/login';
                } catch (error) {
                    console.error('Logout error:', error);
                    window.location.href = '/login';
                }
            }

            // 現在時刻更新
            function updateTime() {
                const now = new Date();
                const timeString = now.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const timeElement = document.getElementById('current-time');
                if (timeElement) {
                    timeElement.textContent = timeString;
                }
            }

            // 初期化
            document.addEventListener('DOMContentLoaded', function() {
                updateTime();
                setInterval(updateTime, 60000);
            });
        </script>
    </body>
    </html>
  `);
});

// メインダッシュボード画面（総合評価・利用状況）
app.get('/main-dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Core First - メインダッシュボード</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="/static/main-dashboard.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="flex h-screen overflow-hidden">
            <!-- サイドバー -->
            <aside id="sidebar" class="flex-shrink-0 w-80 bg-white transition-all duration-300 ease-in-out shadow-xl border-r border-gray-200">
                <div class="flex flex-col h-full">
                    <!-- ロゴ -->
                    <div class="flex items-center h-16 bg-white border-b border-gray-200 px-4">
                        <div class="flex items-center">
                            <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                                 alt="Core First Logo" 
                                 class="w-8 h-8 mr-3">
                            <h3 class="text-lg font-bold text-blue-900">Core First</h3>
                        </div>
                    </div>

                    <!-- ナビゲーションメニュー -->
                    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                        <a href="/dashboard" class="nav-item">
                            <i class="fas fa-home text-lg text-blue-600 nav-icon"></i>
                            <span class="font-medium">トップページ</span>
                        </a>
                        
                        <a href="/main-dashboard" class="nav-item active">
                            <i class="fas fa-tachometer-alt text-lg text-blue-600 nav-icon"></i>
                            <span class="font-medium">メインダッシュボード</span>
                        </a>
                        
                        <a href="/ai-analysis" class="nav-item">
                            <i class="fas fa-brain text-lg text-blue-600 nav-icon"></i>
                            <span class="font-medium">AI分析・チャット</span>
                        </a>
                        
                        <a href="/data-mapping" class="nav-item">
                            <i class="fas fa-upload text-lg text-blue-600 nav-icon"></i>
                            <span class="font-medium">データマッピング</span>
                        </a>
                        
                        <a href="/data-integration" class="nav-item">
                            <i class="fas fa-database text-lg text-blue-600 nav-icon"></i>
                            <span class="font-medium">データ統合管理</span>
                        </a>
                        
                        <a href="/report-management" class="nav-item">
                            <i class="fas fa-file-alt text-lg text-blue-600 nav-icon"></i>
                            <span class="font-medium">レポート管理</span>
                        </a>
                    </nav>

                    <!-- フッター -->
                    <div class="border-t border-gray-200 p-4">
                        <a href="/dashboard" class="flex items-center text-gray-600 hover:text-gray-900">
                            <i class="fas fa-arrow-left mr-3"></i>
                            <span>トップページに戻る</span>
                        </a>
                    </div>
                </div>
            </aside>

            <!-- メインコンテンツ -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- ヘッダー -->
                <header class="bg-white shadow-sm border-b h-16 flex items-center justify-between px-6">
                    <div class="flex items-center">
                        <h1 class="text-xl font-semibold text-gray-900">メインダッシュボード</h1>
                    </div>
                    
                    <div class="flex items-center space-x-4">
                        <div class="text-sm text-gray-600">
                            <span id="current-time"></span>
                        </div>
                        <div class="relative">
                            <button onclick="toggleUserMenu()" id="user-menu-button" class="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
                                <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                    <span class="text-white text-sm font-medium">C</span>
                                </div>
                                <i class="fas fa-chevron-down text-xs"></i>
                            </button>
                            
                            <div id="user-menu" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                                <a href="/admin-dashboard" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-cogs mr-3 text-gray-400"></i>管理者ダッシュボード
                                </a>
                                <div class="border-t border-gray-100 my-1"></div>
                                <a href="#" onclick="logout()" class="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                    <i class="fas fa-sign-out-alt mr-3"></i>ログアウト
                                </a>
                            </div>
                        </div>
                    </div>
                </header>

                <!-- コンテンツエリア -->
                <main class="flex-1 overflow-y-auto p-6">
                    <!-- タブメニュー -->
                    <div class="mb-6">
                        <div class="border-b border-gray-200">
                            <nav class="-mb-px flex space-x-8">
                                <button onclick="showTab('overview')" id="tab-overview" class="dashboard-tab active">
                                    <i class="fas fa-chart-pie mr-2"></i>
                                    総合評価ダッシュボード
                                </button>
                                <button onclick="showTab('usage')" id="tab-usage" class="dashboard-tab">
                                    <i class="fas fa-chart-bar mr-2"></i>
                                    利用状況ダッシュボード
                                </button>
                            </nav>
                        </div>
                    </div>

                    <!-- 総合評価ダッシュボード -->
                    <div id="overview-tab" class="tab-content">
                        <!-- KPIカード -->
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium text-gray-600">総合効率スコア</p>
                                        <p class="text-3xl font-bold text-green-600">87.5%</p>
                                    </div>
                                    <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                        <i class="fas fa-chart-line text-green-600 text-xl"></i>
                                    </div>
                                </div>
                                <div class="mt-2 flex items-center">
                                    <i class="fas fa-arrow-up text-green-500 text-sm mr-1"></i>
                                    <span class="text-sm text-green-600 font-medium">+2.3%</span>
                                    <span class="text-sm text-gray-500 ml-2">前月比</span>
                                </div>
                            </div>

                            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium text-gray-600">コスト削減額</p>
                                        <p class="text-3xl font-bold text-blue-600">¥2.3M</p>
                                    </div>
                                    <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <i class="fas fa-yen-sign text-blue-600 text-xl"></i>
                                    </div>
                                </div>
                                <div class="mt-2">
                                    <span class="text-sm text-gray-500">今月実績</span>
                                </div>
                            </div>

                            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium text-gray-600">積載効率</p>
                                        <p class="text-3xl font-bold text-orange-600">92.1%</p>
                                    </div>
                                    <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                                        <i class="fas fa-truck text-orange-600 text-xl"></i>
                                    </div>
                                </div>
                                <div class="mt-2">
                                    <span class="text-sm text-gray-500">平均積載率</span>
                                </div>
                            </div>

                            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium text-gray-600">AI活用度</p>
                                        <p class="text-3xl font-bold text-purple-600">78.3%</p>
                                    </div>
                                    <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <i class="fas fa-brain text-purple-600 text-xl"></i>
                                    </div>
                                </div>
                                <div class="mt-2">
                                    <span class="text-sm text-gray-500">月間利用率</span>
                                </div>
                            </div>
                        </div>

                        <!-- チャート -->
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900 mb-4">効率性トレンド</h3>
                                <div class="h-80">
                                    <canvas id="efficiencyChart"></canvas>
                                </div>
                            </div>

                            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900 mb-4">コスト分析</h3>
                                <div class="h-80">
                                    <canvas id="costChart"></canvas>
                                </div>
                            </div>
                        </div>

                        <!-- AI推奨アクション -->
                        <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                            <h3 class="text-lg font-semibold text-gray-900 mb-6">
                                <i class="fas fa-lightbulb text-yellow-500 mr-2"></i>
                                AI推奨アクション
                            </h3>
                            <div class="space-y-4">
                                <div class="flex items-start p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                                    <i class="fas fa-exclamation-circle text-blue-600 mt-1 mr-3"></i>
                                    <div>
                                        <p class="font-medium text-blue-900">積載効率改善の機会</p>
                                        <p class="text-sm text-blue-700 mt-1">ルートA-Bにおいて、積載率を15%向上できる可能性があります。詳細分析を実行してください。</p>
                                        <button class="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">詳細を確認 →</button>
                                    </div>
                                </div>
                                <div class="flex items-start p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
                                    <i class="fas fa-check-circle text-green-600 mt-1 mr-3"></i>
                                    <div>
                                        <p class="font-medium text-green-900">庫内作業最適化完了</p>
                                        <p class="text-sm text-green-700 mt-1">倉庫Cの作業効率が目標値に達しました。他の拠点への水平展開を検討してください。</p>
                                        <button class="mt-2 text-sm text-green-600 hover:text-green-800 font-medium">レポートを作成 →</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 利用状況ダッシュボード -->
                    <div id="usage-tab" class="tab-content hidden">
                        <div class="bg-white rounded-lg shadow-sm p-8 border border-gray-200 text-center">
                            <i class="fas fa-chart-bar text-4xl text-gray-400 mb-4"></i>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">利用状況ダッシュボード</h3>
                            <p class="text-gray-600 mb-4">AI分析カテゴリ別・ユーザー別利用頻度、データアップロード状況の詳細分析機能を開発中です。</p>
                            <div class="text-sm text-blue-600">近日公開予定</div>
                        </div>
                    </div>
                </main>
            </div>
        </div>

        <script src="/static/main-dashboard.js"></script>
    </body>
    </html>
  `);
});

// AI分析・チャット画面
app.get('/ai-analysis', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI分析・チャット - Core First</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="/static/ai-analysis.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- ヘッダー -->
            <header class="main-header bg-white shadow-sm border-b">
                <div class="flex items-center justify-between px-6 py-4">
                    <div class="flex items-center space-x-4">
                        <a href="/dashboard" class="flex items-center text-gray-600 hover:text-gray-900">
                            <i class="fas fa-arrow-left mr-2"></i>
                            ダッシュボードに戻る
                        </a>
                        <div class="flex items-center">
                            <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                                 alt="Core First Logo" 
                                 class="w-8 h-8 mr-3">
                            <h1 class="text-xl font-bold text-gray-900">AI分析・チャット</h1>
                        </div>
                    </div>

                    <!-- ユーザープロフィール -->
                    <div class="relative">
                        <button id="profile-button" class="flex items-center space-x-3 bg-gray-100 rounded-lg px-3 py-2 hover:bg-gray-200 transition-colors">
                            <img src="https://ui-avatars.com/api/?name=CLO+User&background=3b82f6&color=fff&size=32" 
                                 alt="Profile" 
                                 class="w-8 h-8 rounded-full">
                            <span class="font-medium text-gray-700">CLOユーザー</span>
                            <i class="fas fa-chevron-down text-gray-500"></i>
                        </button>

                        <!-- プロフィールドロップダウン -->
                        <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                            <div class="py-1">
                                <a href="/admin-dashboard" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-cog mr-2"></i>
                                    管理者ダッシュボード
                                </a>
                                <hr class="my-1">
                                <a href="/api/auth/logout" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-sign-out-alt mr-2"></i>
                                    ログアウト
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div class="flex">
                <!-- サイドナビゲーション -->
                <nav class="nav-container w-64 bg-slate-800 h-screen fixed">
                    <div class="p-4">
                        <div class="space-y-2">
                            <a href="/dashboard" class="nav-item">
                                <i class="fas fa-home"></i>
                                <span>ホーム</span>
                            </a>
                            <a href="/main-dashboard" class="nav-item">
                                <i class="fas fa-chart-line"></i>
                                <span>メインダッシュボード</span>
                            </a>
                            <a href="/ai-analysis" class="nav-item active">
                                <i class="fas fa-robot"></i>
                                <span>AI分析・チャット</span>
                            </a>
                            <a href="/data-mapping" class="nav-item">
                                <i class="fas fa-project-diagram"></i>
                                <span>データマッピング</span>
                            </a>
                            <a href="/data-integration" class="nav-item">
                                <i class="fas fa-database"></i>
                                <span>データ統合管理</span>
                            </a>
                            <a href="/report-management" class="nav-item">
                                <i class="fas fa-file-alt"></i>
                                <span>レポート管理</span>
                            </a>
                        </div>
                    </div>
                </nav>

                <!-- メインコンテンツ -->
                <main class="flex-1 ml-64 p-6">
                    <div class="max-w-7xl mx-auto">
                        <!-- AI分析セクション -->
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <!-- データ分析パネル -->
                            <div class="analysis-panel bg-white rounded-lg shadow-md">
                                <div class="panel-header">
                                    <h2 class="panel-title">
                                        <i class="fas fa-chart-bar mr-2"></i>
                                        データ分析
                                    </h2>
                                    <button id="refresh-analysis" class="btn-secondary">
                                        <i class="fas fa-sync-alt"></i>
                                        更新
                                    </button>
                                </div>
                                <div class="panel-content">
                                    <div id="analysis-charts">
                                        <canvas id="cost-analysis-chart"></canvas>
                                    </div>
                                    <div class="analysis-insights mt-4">
                                        <h3 class="insights-title">AI分析結果</h3>
                                        <div id="analysis-results" class="insights-list">
                                            <div class="insight-item">
                                                <div class="insight-icon positive">
                                                    <i class="fas fa-arrow-down"></i>
                                                </div>
                                                <div class="insight-content">
                                                    <div class="insight-title">コスト削減の機会</div>
                                                    <div class="insight-desc">配送ルートの最適化により15%のコスト削減が可能</div>
                                                </div>
                                            </div>
                                            <div class="insight-item">
                                                <div class="insight-icon warning">
                                                    <i class="fas fa-exclamation-triangle"></i>
                                                </div>
                                                <div class="insight-content">
                                                    <div class="insight-title">効率性の課題</div>
                                                    <div class="insight-desc">配送時間のばらつきが業界平均を上回っています</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 予測分析パネル -->
                            <div class="analysis-panel bg-white rounded-lg shadow-md">
                                <div class="panel-header">
                                    <h2 class="panel-title">
                                        <i class="fas fa-crystal-ball mr-2"></i>
                                        予測分析
                                    </h2>
                                    <select id="prediction-period" class="select-input">
                                        <option value="1">1ヶ月</option>
                                        <option value="3" selected>3ヶ月</option>
                                        <option value="6">6ヶ月</option>
                                    </select>
                                </div>
                                <div class="panel-content">
                                    <div id="prediction-charts">
                                        <canvas id="prediction-chart"></canvas>
                                    </div>
                                    <div class="prediction-summary mt-4">
                                        <div class="summary-cards">
                                            <div class="summary-card">
                                                <div class="summary-value">¥1.2M</div>
                                                <div class="summary-label">予測コスト</div>
                                                <div class="summary-trend positive">-5.2%</div>
                                            </div>
                                            <div class="summary-card">
                                                <div class="summary-value">92%</div>
                                                <div class="summary-label">予測精度</div>
                                                <div class="summary-trend positive">+2.1%</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- AIチャットセクション -->
                        <div class="chat-container bg-white rounded-lg shadow-md">
                            <div class="chat-header">
                                <h2 class="chat-title">
                                    <i class="fas fa-comments mr-2"></i>
                                    AI アシスタント
                                </h2>
                                <div class="chat-status">
                                    <div class="status-indicator online"></div>
                                    <span>オンライン</span>
                                </div>
                            </div>
                            
                            <div class="chat-content">
                                <div id="chat-messages" class="chat-messages">
                                    <!-- 初期メッセージ -->
                                    <div class="message assistant">
                                        <div class="message-avatar">
                                            <i class="fas fa-robot"></i>
                                        </div>
                                        <div class="message-content">
                                            <div class="message-text">
                                                こんにちは！物流データの分析やお悩みについて、お気軽にご質問ください。
                                                以下のような質問にお答えできます：<br>
                                                • コスト削減の提案<br>
                                                • 配送効率の改善<br>
                                                • データの解釈と分析<br>
                                                • 予測分析の詳細
                                            </div>
                                            <div class="message-time">
                                                ${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="chat-input-container">
                                    <div class="quick-questions">
                                        <button class="quick-btn" onclick="sendQuickQuestion('コスト削減の提案を教えてください')">
                                            <i class="fas fa-dollar-sign mr-1"></i>
                                            コスト削減
                                        </button>
                                        <button class="quick-btn" onclick="sendQuickQuestion('配送効率を改善する方法は？')">
                                            <i class="fas fa-shipping-fast mr-1"></i>
                                            効率改善
                                        </button>
                                        <button class="quick-btn" onclick="sendQuickQuestion('最新のデータ分析結果を見せてください')">
                                            <i class="fas fa-chart-line mr-1"></i>
                                            データ分析
                                        </button>
                                        <button class="quick-btn" onclick="sendQuickQuestion('リスク要因を教えてください')">
                                            <i class="fas fa-exclamation-triangle mr-1"></i>
                                            リスク分析
                                        </button>
                                    </div>
                                    
                                    <div class="chat-input-row">
                                        <div class="chat-input-wrapper">
                                            <input 
                                                type="text" 
                                                id="chat-input" 
                                                placeholder="メッセージを入力してください..."
                                                class="chat-input"
                                            >
                                            <button id="attach-btn" class="attach-btn">
                                                <i class="fas fa-paperclip"></i>
                                            </button>
                                        </div>
                                        <button id="send-btn" class="send-btn">
                                            <i class="fas fa-paper-plane"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>

        <script src="/static/ai-analysis.js"></script>
    </body>
    </html>
  `);
});

// データ連携・マッピング画面
app.get('/data-mapping', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>データ連携・マッピング - Core First</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/data-mapping.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- ヘッダー -->
            <header class="main-header bg-white shadow-sm border-b">
                <div class="flex items-center justify-between px-6 py-4">
                    <div class="flex items-center space-x-4">
                        <a href="/dashboard" class="flex items-center text-gray-600 hover:text-gray-900">
                            <i class="fas fa-arrow-left mr-2"></i>
                            ダッシュボードに戻る
                        </a>
                        <div class="flex items-center">
                            <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                                 alt="Core First Logo" 
                                 class="w-8 h-8 mr-3">
                            <h1 class="text-xl font-bold text-gray-900">データ連携・マッピング</h1>
                        </div>
                    </div>

                    <!-- ユーザープロフィール -->
                    <div class="relative">
                        <button id="profile-button" class="flex items-center space-x-3 bg-gray-100 rounded-lg px-3 py-2 hover:bg-gray-200 transition-colors">
                            <img src="https://ui-avatars.com/api/?name=CLO+User&background=3b82f6&color=fff&size=32" 
                                 alt="Profile" 
                                 class="w-8 h-8 rounded-full">
                            <span class="font-medium text-gray-700">CLOユーザー</span>
                            <i class="fas fa-chevron-down text-gray-500"></i>
                        </button>

                        <!-- プロフィールドロップダウン -->
                        <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                            <div class="py-1">
                                <a href="/admin-dashboard" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-cog mr-2"></i>
                                    管理者ダッシュボード
                                </a>
                                <hr class="my-1">
                                <a href="/api/auth/logout" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-sign-out-alt mr-2"></i>
                                    ログアウト
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div class="flex">
                <!-- サイドナビゲーション -->
                <nav class="nav-container w-64 bg-slate-800 h-screen fixed">
                    <div class="p-4">
                        <div class="space-y-2">
                            <a href="/dashboard" class="nav-item">
                                <i class="fas fa-home"></i>
                                <span>ホーム</span>
                            </a>
                            <a href="/main-dashboard" class="nav-item">
                                <i class="fas fa-chart-line"></i>
                                <span>メインダッシュボード</span>
                            </a>
                            <a href="/ai-analysis" class="nav-item">
                                <i class="fas fa-robot"></i>
                                <span>AI分析・チャット</span>
                            </a>
                            <a href="/data-mapping" class="nav-item active">
                                <i class="fas fa-project-diagram"></i>
                                <span>データマッピング</span>
                            </a>
                            <a href="/data-integration" class="nav-item">
                                <i class="fas fa-database"></i>
                                <span>データ統合管理</span>
                            </a>
                            <a href="/report-management" class="nav-item">
                                <i class="fas fa-file-alt"></i>
                                <span>レポート管理</span>
                            </a>
                        </div>
                    </div>
                </nav>

                <!-- メインコンテンツ -->
                <main class="flex-1 ml-64 p-6">
                    <div class="max-w-7xl mx-auto">
                        
                        <!-- コントロールパネル -->
                        <div class="control-panel bg-white rounded-lg shadow-md mb-6">
                            <div class="panel-header">
                                <h2 class="panel-title">
                                    <i class="fas fa-cogs mr-2"></i>
                                    データソース管理
                                </h2>
                                <div class="control-actions">
                                    <button id="add-source-btn" class="btn-primary">
                                        <i class="fas fa-plus mr-2"></i>
                                        新しいソース追加
                                    </button>
                                    <button id="refresh-mapping" class="btn-secondary">
                                        <i class="fas fa-sync-alt mr-2"></i>
                                        更新
                                    </button>
                                </div>
                            </div>
                            
                            <div class="panel-content">
                                <!-- データソース一覧 -->
                                <div class="sources-grid">
                                    <div class="source-card active" data-source="erp">
                                        <div class="source-icon">
                                            <i class="fas fa-building"></i>
                                        </div>
                                        <div class="source-info">
                                            <div class="source-name">ERPシステム</div>
                                            <div class="source-status connected">接続済み</div>
                                            <div class="source-desc">在庫・受注データ</div>
                                        </div>
                                    </div>
                                    
                                    <div class="source-card active" data-source="wms">
                                        <div class="source-icon">
                                            <i class="fas fa-warehouse"></i>
                                        </div>
                                        <div class="source-info">
                                            <div class="source-name">WMSシステム</div>
                                            <div class="source-status connected">接続済み</div>
                                            <div class="source-desc">倉庫管理データ</div>
                                        </div>
                                    </div>
                                    
                                    <div class="source-card active" data-source="tms">
                                        <div class="source-icon">
                                            <i class="fas fa-truck"></i>
                                        </div>
                                        <div class="source-info">
                                            <div class="source-name">TMSシステム</div>
                                            <div class="source-status connected">接続済み</div>
                                            <div class="source-desc">配送管理データ</div>
                                        </div>
                                    </div>
                                    
                                    <div class="source-card" data-source="csv">
                                        <div class="source-icon">
                                            <i class="fas fa-file-csv"></i>
                                        </div>
                                        <div class="source-info">
                                            <div class="source-name">CSVファイル</div>
                                            <div class="source-status disconnected">未接続</div>
                                            <div class="source-desc">外部データファイル</div>
                                        </div>
                                    </div>
                                    
                                    <div class="source-card" data-source="api">
                                        <div class="source-icon">
                                            <i class="fas fa-plug"></i>
                                        </div>
                                        <div class="source-info">
                                            <div class="source-name">外部API</div>
                                            <div class="source-status disconnected">未接続</div>
                                            <div class="source-desc">サードパーティAPI</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- マッピング設定エリア -->
                        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            
                            <!-- フィールドマッピング -->
                            <div class="mapping-panel bg-white rounded-lg shadow-md">
                                <div class="panel-header">
                                    <h3 class="panel-title">
                                        <i class="fas fa-arrows-alt-h mr-2"></i>
                                        フィールドマッピング
                                    </h3>
                                    <select id="source-selector" class="select-input">
                                        <option value="erp">ERPシステム</option>
                                        <option value="wms">WMSシステム</option>
                                        <option value="tms">TMSシステム</option>
                                    </select>
                                </div>
                                
                                <div class="panel-content">
                                    <div id="field-mapping-container">
                                        <!-- フィールドマッピングが動的に生成される -->
                                    </div>
                                </div>
                            </div>

                            <!-- データ変換ルール -->
                            <div class="transformation-panel bg-white rounded-lg shadow-md">
                                <div class="panel-header">
                                    <h3 class="panel-title">
                                        <i class="fas fa-magic mr-2"></i>
                                        データ変換ルール
                                    </h3>
                                    <button id="add-rule-btn" class="btn-secondary">
                                        <i class="fas fa-plus mr-1"></i>
                                        ルール追加
                                    </button>
                                </div>
                                
                                <div class="panel-content">
                                    <div id="transformation-rules">
                                        <!-- 変換ルールが動的に生成される -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- データプレビュー -->
                        <div class="preview-panel bg-white rounded-lg shadow-md mt-6">
                            <div class="panel-header">
                                <h3 class="panel-title">
                                    <i class="fas fa-eye mr-2"></i>
                                    データプレビュー
                                </h3>
                                <div class="preview-controls">
                                    <button id="preview-btn" class="btn-primary">
                                        <i class="fas fa-play mr-2"></i>
                                        プレビュー実行
                                    </button>
                                    <button id="validate-btn" class="btn-secondary">
                                        <i class="fas fa-check-circle mr-2"></i>
                                        検証
                                    </button>
                                </div>
                            </div>
                            
                            <div class="panel-content">
                                <div class="preview-tabs">
                                    <button class="preview-tab active" data-tab="source">
                                        ソースデータ
                                    </button>
                                    <button class="preview-tab" data-tab="transformed">
                                        変換後データ
                                    </button>
                                    <button class="preview-tab" data-tab="errors">
                                        エラー・警告
                                    </button>
                                </div>
                                
                                <div class="preview-content">
                                    <div id="source-preview" class="preview-table-container active">
                                        <table id="source-data-table" class="preview-table">
                                            <thead>
                                                <tr>
                                                    <th>注文ID</th>
                                                    <th>商品コード</th>
                                                    <th>数量</th>
                                                    <th>配送先</th>
                                                    <th>ステータス</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>ORD-2024-001</td>
                                                    <td>PROD-A001</td>
                                                    <td>50</td>
                                                    <td>東京都渋谷区</td>
                                                    <td>処理中</td>
                                                </tr>
                                                <tr>
                                                    <td>ORD-2024-002</td>
                                                    <td>PROD-B002</td>
                                                    <td>25</td>
                                                    <td>大阪府大阪市</td>
                                                    <td>配送中</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    <div id="transformed-preview" class="preview-table-container">
                                        <div class="loading-message">
                                            変換を実行してデータを表示
                                        </div>
                                    </div>
                                    
                                    <div id="errors-preview" class="preview-table-container">
                                        <div class="error-list">
                                            <!-- エラー・警告が表示される -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- マッピング履歴 -->
                        <div class="history-panel bg-white rounded-lg shadow-md mt-6">
                            <div class="panel-header">
                                <h3 class="panel-title">
                                    <i class="fas fa-history mr-2"></i>
                                    マッピング履歴
                                </h3>
                                <div class="history-controls">
                                    <select class="select-input">
                                        <option>過去7日</option>
                                        <option>過去30日</option>
                                        <option>過去90日</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="panel-content">
                                <div class="history-list">
                                    <div class="history-item">
                                        <div class="history-icon success">
                                            <i class="fas fa-check"></i>
                                        </div>
                                        <div class="history-info">
                                            <div class="history-title">ERPシステム - 注文データ同期</div>
                                            <div class="history-desc">1,234件のレコードを正常に処理</div>
                                            <div class="history-time">2024年1月15日 14:30</div>
                                        </div>
                                        <div class="history-status success">成功</div>
                                    </div>
                                    
                                    <div class="history-item">
                                        <div class="history-icon warning">
                                            <i class="fas fa-exclamation-triangle"></i>
                                        </div>
                                        <div class="history-info">
                                            <div class="history-title">WMSシステム - 在庫データ同期</div>
                                            <div class="history-desc">852件処理、12件の警告あり</div>
                                            <div class="history-time">2024年1月15日 13:15</div>
                                        </div>
                                        <div class="history-status warning">警告</div>
                                    </div>
                                    
                                    <div class="history-item">
                                        <div class="history-icon error">
                                            <i class="fas fa-times"></i>
                                        </div>
                                        <div class="history-info">
                                            <div class="history-title">TMSシステム - 配送データ同期</div>
                                            <div class="history-desc">接続エラーにより同期失敗</div>
                                            <div class="history-time">2024年1月15日 12:00</div>
                                        </div>
                                        <div class="history-status error">失敗</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>

        <script src="/static/data-mapping.js"></script>
    </body>
    </html>
  `);
});

// データ連携・統合管理画面
app.get('/data-integration', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>データ連携・統合管理 - Core First</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="/static/data-integration.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- ヘッダー -->
            <header class="main-header bg-white shadow-sm border-b">
                <div class="flex items-center justify-between px-6 py-4">
                    <div class="flex items-center space-x-4">
                        <a href="/dashboard" class="flex items-center text-gray-600 hover:text-gray-900">
                            <i class="fas fa-arrow-left mr-2"></i>
                            ダッシュボードに戻る
                        </a>
                        <div class="flex items-center">
                            <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                                 alt="Core First Logo" 
                                 class="w-8 h-8 mr-3">
                            <h1 class="text-xl font-bold text-gray-900">データ連携・統合管理</h1>
                        </div>
                    </div>

                    <!-- ユーザープロフィール -->
                    <div class="relative">
                        <button id="profile-button" class="flex items-center space-x-3 bg-gray-100 rounded-lg px-3 py-2 hover:bg-gray-200 transition-colors">
                            <img src="https://ui-avatars.com/api/?name=CLO+User&background=3b82f6&color=fff&size=32" 
                                 alt="Profile" 
                                 class="w-8 h-8 rounded-full">
                            <span class="font-medium text-gray-700">CLOユーザー</span>
                            <i class="fas fa-chevron-down text-gray-500"></i>
                        </button>

                        <!-- プロフィールドロップダウン -->
                        <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                            <div class="py-1">
                                <a href="/admin-dashboard" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-cog mr-2"></i>
                                    管理者ダッシュボード
                                </a>
                                <hr class="my-1">
                                <a href="/api/auth/logout" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-sign-out-alt mr-2"></i>
                                    ログアウト
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div class="flex">
                <!-- サイドナビゲーション -->
                <nav class="nav-container w-64 bg-slate-800 h-screen fixed">
                    <div class="p-4">
                        <div class="space-y-2">
                            <a href="/dashboard" class="nav-item">
                                <i class="fas fa-home"></i>
                                <span>ホーム</span>
                            </a>
                            <a href="/main-dashboard" class="nav-item">
                                <i class="fas fa-chart-line"></i>
                                <span>メインダッシュボード</span>
                            </a>
                            <a href="/ai-analysis" class="nav-item">
                                <i class="fas fa-robot"></i>
                                <span>AI分析・チャット</span>
                            </a>
                            <a href="/data-mapping" class="nav-item">
                                <i class="fas fa-project-diagram"></i>
                                <span>データマッピング</span>
                            </a>
                            <a href="/data-integration" class="nav-item active">
                                <i class="fas fa-database"></i>
                                <span>データ統合管理</span>
                            </a>
                            <a href="/report-management" class="nav-item">
                                <i class="fas fa-file-alt"></i>
                                <span>レポート管理</span>
                            </a>
                        </div>
                    </div>
                </nav>

                <!-- メインコンテンツ -->
                <main class="flex-1 ml-64 p-6">
                    <div class="max-w-7xl mx-auto">
                        
                        <!-- 統計概要 -->
                        <div class="stats-grid mb-6">
                            <div class="stat-card">
                                <div class="stat-icon blue">
                                    <i class="fas fa-database"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value">15</div>
                                    <div class="stat-label">データソース</div>
                                    <div class="stat-change positive">+2 今月</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon green">
                                    <i class="fas fa-sync-alt"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value">1.2M</div>
                                    <div class="stat-label">同期レコード</div>
                                    <div class="stat-change positive">+8.5%</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon purple">
                                    <i class="fas fa-clock"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value">5.2s</div>
                                    <div class="stat-label">平均同期時間</div>
                                    <div class="stat-change positive">-1.2s</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon orange">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value">3</div>
                                    <div class="stat-label">エラー</div>
                                    <div class="stat-change negative">+1</div>
                                </div>
                            </div>
                        </div>

                        <!-- メインコンテンツエリア -->
                        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            
                            <!-- データフロー管理 -->
                            <div class="xl:col-span-2">
                                <div class="dataflow-panel bg-white rounded-lg shadow-md">
                                    <div class="panel-header">
                                        <h2 class="panel-title">
                                            <i class="fas fa-project-diagram mr-2"></i>
                                            データフロー管理
                                        </h2>
                                        <div class="flow-controls">
                                            <button id="add-flow-btn" class="btn-primary">
                                                <i class="fas fa-plus mr-2"></i>
                                                フロー追加
                                            </button>
                                            <button id="refresh-flows" class="btn-secondary">
                                                <i class="fas fa-sync-alt mr-2"></i>
                                                更新
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="panel-content">
                                        <div id="dataflow-canvas" class="dataflow-canvas">
                                            <!-- データフローが描画される -->
                                        </div>
                                        
                                        <!-- フロー一覧 -->
                                        <div class="flows-list">
                                            <div class="flow-item active" data-flow="erp-wms">
                                                <div class="flow-status running"></div>
                                                <div class="flow-info">
                                                    <div class="flow-name">ERP → WMS 同期</div>
                                                    <div class="flow-desc">注文データの自動同期</div>
                                                    <div class="flow-schedule">毎時実行</div>
                                                </div>
                                                <div class="flow-actions">
                                                    <button class="action-btn" onclick="toggleFlow('erp-wms')">
                                                        <i class="fas fa-pause"></i>
                                                    </button>
                                                    <button class="action-btn" onclick="editFlow('erp-wms')">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div class="flow-item" data-flow="wms-tms">
                                                <div class="flow-status stopped"></div>
                                                <div class="flow-info">
                                                    <div class="flow-name">WMS → TMS 同期</div>
                                                    <div class="flow-desc">出荷指示データの連携</div>
                                                    <div class="flow-schedule">手動実行</div>
                                                </div>
                                                <div class="flow-actions">
                                                    <button class="action-btn" onclick="toggleFlow('wms-tms')">
                                                        <i class="fas fa-play"></i>
                                                    </button>
                                                    <button class="action-btn" onclick="editFlow('wms-tms')">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div class="flow-item" data-flow="tms-report">
                                                <div class="flow-status error"></div>
                                                <div class="flow-info">
                                                    <div class="flow-name">TMS → レポート生成</div>
                                                    <div class="flow-desc">配送実績レポート作成</div>
                                                    <div class="flow-schedule">日次実行</div>
                                                </div>
                                                <div class="flow-actions">
                                                    <button class="action-btn" onclick="toggleFlow('tms-report')">
                                                        <i class="fas fa-play"></i>
                                                    </button>
                                                    <button class="action-btn" onclick="editFlow('tms-report')">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 監視・アラート -->
                            <div class="monitoring-panel bg-white rounded-lg shadow-md">
                                <div class="panel-header">
                                    <h3 class="panel-title">
                                        <i class="fas fa-heartbeat mr-2"></i>
                                        リアルタイム監視
                                    </h3>
                                </div>
                                
                                <div class="panel-content">
                                    <!-- システム状態 -->
                                    <div class="system-status mb-6">
                                        <h4 class="status-title">システム状態</h4>
                                        <div class="status-indicators">
                                            <div class="status-item">
                                                <div class="status-dot online"></div>
                                                <span>ERPシステム</span>
                                            </div>
                                            <div class="status-item">
                                                <div class="status-dot online"></div>
                                                <span>WMSシステム</span>
                                            </div>
                                            <div class="status-item">
                                                <div class="status-dot offline"></div>
                                                <span>TMSシステム</span>
                                            </div>
                                            <div class="status-item">
                                                <div class="status-dot warning"></div>
                                                <span>外部API</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- アクティブアラート -->
                                    <div class="alerts-section">
                                        <h4 class="alerts-title">アクティブアラート</h4>
                                        <div class="alerts-list">
                                            <div class="alert-item error">
                                                <div class="alert-icon">
                                                    <i class="fas fa-exclamation-circle"></i>
                                                </div>
                                                <div class="alert-content">
                                                    <div class="alert-title">TMS接続エラー</div>
                                                    <div class="alert-desc">タイムアウトにより接続失敗</div>
                                                    <div class="alert-time">3分前</div>
                                                </div>
                                            </div>
                                            
                                            <div class="alert-item warning">
                                                <div class="alert-icon">
                                                    <i class="fas fa-exclamation-triangle"></i>
                                                </div>
                                                <div class="alert-content">
                                                    <div class="alert-title">データ遅延</div>
                                                    <div class="alert-desc">同期が5分遅れています</div>
                                                    <div class="alert-time">8分前</div>
                                                </div>
                                            </div>
                                            
                                            <div class="alert-item info">
                                                <div class="alert-icon">
                                                    <i class="fas fa-info-circle"></i>
                                                </div>
                                                <div class="alert-content">
                                                    <div class="alert-title">定期メンテナンス</div>
                                                    <div class="alert-desc">明日2:00-4:00予定</div>
                                                    <div class="alert-time">1時間前</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- パフォーマンス -->
                                    <div class="performance-section">
                                        <h4 class="performance-title">パフォーマンス</h4>
                                        <div class="performance-chart">
                                            <canvas id="performance-chart" width="100" height="60"></canvas>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 同期履歴・ログ -->
                        <div class="history-panel bg-white rounded-lg shadow-md mt-6">
                            <div class="panel-header">
                                <h3 class="panel-title">
                                    <i class="fas fa-history mr-2"></i>
                                    同期履歴・ログ
                                </h3>
                                <div class="history-controls">
                                    <select id="log-filter" class="select-input">
                                        <option value="all">全て</option>
                                        <option value="success">成功</option>
                                        <option value="error">エラー</option>
                                        <option value="warning">警告</option>
                                    </select>
                                    <select id="time-range" class="select-input">
                                        <option value="1h">過去1時間</option>
                                        <option value="1d">過去24時間</option>
                                        <option value="1w">過去1週間</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="panel-content">
                                <div class="logs-table-container">
                                    <table id="logs-table" class="logs-table">
                                        <thead>
                                            <tr>
                                                <th>時刻</th>
                                                <th>フロー名</th>
                                                <th>ステータス</th>
                                                <th>レコード数</th>
                                                <th>実行時間</th>
                                                <th>詳細</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>15:30:12</td>
                                                <td>ERP → WMS</td>
                                                <td><span class="status-badge success">成功</span></td>
                                                <td>1,234</td>
                                                <td>4.2s</td>
                                                <td><button class="details-btn" onclick="showLogDetails(1)">詳細</button></td>
                                            </tr>
                                            <tr>
                                                <td>15:15:08</td>
                                                <td>WMS → TMS</td>
                                                <td><span class="status-badge error">エラー</span></td>
                                                <td>0</td>
                                                <td>-</td>
                                                <td><button class="details-btn" onclick="showLogDetails(2)">詳細</button></td>
                                            </tr>
                                            <tr>
                                                <td>15:00:05</td>
                                                <td>ERP → WMS</td>
                                                <td><span class="status-badge warning">警告</span></td>
                                                <td>987</td>
                                                <td>6.8s</td>
                                                <td><button class="details-btn" onclick="showLogDetails(3)">詳細</button></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- データ品質ダッシュボード -->
                        <div class="quality-panel bg-white rounded-lg shadow-md mt-6">
                            <div class="panel-header">
                                <h3 class="panel-title">
                                    <i class="fas fa-chart-bar mr-2"></i>
                                    データ品質ダッシュボード
                                </h3>
                            </div>
                            
                            <div class="panel-content">
                                <div class="quality-metrics">
                                    <div class="quality-card">
                                        <div class="quality-header">
                                            <h4>データ完整性</h4>
                                            <div class="quality-score good">98.5%</div>
                                        </div>
                                        <div class="quality-chart">
                                            <canvas id="completeness-chart" width="100" height="60"></canvas>
                                        </div>
                                    </div>
                                    
                                    <div class="quality-card">
                                        <div class="quality-header">
                                            <h4>データ正確性</h4>
                                            <div class="quality-score average">87.2%</div>
                                        </div>
                                        <div class="quality-chart">
                                            <canvas id="accuracy-chart" width="100" height="60"></canvas>
                                        </div>
                                    </div>
                                    
                                    <div class="quality-card">
                                        <div class="quality-header">
                                            <h4>データ一貫性</h4>
                                            <div class="quality-score poor">76.8%</div>
                                        </div>
                                        <div class="quality-chart">
                                            <canvas id="consistency-chart" width="100" height="60"></canvas>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>

        <script src="/static/data-integration.js"></script>
    </body>
    </html>
  `);
});

// レポート管理画面
app.get('/report-management', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>レポート管理 - Core First</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="/static/report-management.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- ヘッダー -->
            <header class="main-header bg-white shadow-sm border-b">
                <div class="flex items-center justify-between px-6 py-4">
                    <div class="flex items-center space-x-4">
                        <a href="/dashboard" class="flex items-center text-gray-600 hover:text-gray-900">
                            <i class="fas fa-arrow-left mr-2"></i>
                            ダッシュボードに戻る
                        </a>
                        <div class="flex items-center">
                            <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                                 alt="Core First Logo" 
                                 class="w-8 h-8 mr-3">
                            <h1 class="text-xl font-bold text-gray-900">レポート管理</h1>
                        </div>
                    </div>

                    <!-- ユーザープロフィール -->
                    <div class="relative">
                        <button id="profile-button" class="flex items-center space-x-3 bg-gray-100 rounded-lg px-3 py-2 hover:bg-gray-200 transition-colors">
                            <img src="https://ui-avatars.com/api/?name=CLO+User&background=3b82f6&color=fff&size=32" 
                                 alt="Profile" 
                                 class="w-8 h-8 rounded-full">
                            <span class="font-medium text-gray-700">CLOユーザー</span>
                            <i class="fas fa-chevron-down text-gray-500"></i>
                        </button>

                        <!-- プロフィールドロップダウン -->
                        <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                            <div class="py-1">
                                <a href="/admin-dashboard" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-cog mr-2"></i>
                                    管理者ダッシュボード
                                </a>
                                <hr class="my-1">
                                <a href="/api/auth/logout" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-sign-out-alt mr-2"></i>
                                    ログアウト
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div class="flex">
                <!-- サイドナビゲーション -->
                <nav class="nav-container w-64 bg-slate-800 h-screen fixed">
                    <div class="p-4">
                        <div class="space-y-2">
                            <a href="/dashboard" class="nav-item">
                                <i class="fas fa-home"></i>
                                <span>ホーム</span>
                            </a>
                            <a href="/main-dashboard" class="nav-item">
                                <i class="fas fa-chart-line"></i>
                                <span>メインダッシュボード</span>
                            </a>
                            <a href="/ai-analysis" class="nav-item">
                                <i class="fas fa-robot"></i>
                                <span>AI分析・チャット</span>
                            </a>
                            <a href="/data-mapping" class="nav-item">
                                <i class="fas fa-project-diagram"></i>
                                <span>データマッピング</span>
                            </a>
                            <a href="/data-integration" class="nav-item">
                                <i class="fas fa-database"></i>
                                <span>データ統合管理</span>
                            </a>
                            <a href="/report-management" class="nav-item active">
                                <i class="fas fa-file-alt"></i>
                                <span>レポート管理</span>
                            </a>
                        </div>
                    </div>
                </nav>

                <!-- メインコンテンツ -->
                <main class="flex-1 ml-64 p-6">
                    <div class="max-w-7xl mx-auto">
                        
                        <!-- レポート作成・管理パネル -->
                        <div class="control-panel bg-white rounded-lg shadow-md mb-6">
                            <div class="panel-header">
                                <h2 class="panel-title">
                                    <i class="fas fa-chart-bar mr-2"></i>
                                    レポート作成・管理
                                </h2>
                                <div class="control-actions">
                                    <button id="create-report-btn" class="btn-primary">
                                        <i class="fas fa-plus mr-2"></i>
                                        新規レポート作成
                                    </button>
                                    <button id="template-btn" class="btn-secondary">
                                        <i class="fas fa-layer-group mr-2"></i>
                                        テンプレート
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            
                            <!-- レポートビルダー -->
                            <div class="xl:col-span-2">
                                <div class="report-builder bg-white rounded-lg shadow-md">
                                    <div class="panel-header">
                                        <h3 class="panel-title">
                                            <i class="fas fa-tools mr-2"></i>
                                            レポートビルダー
                                        </h3>
                                        <div class="builder-actions">
                                            <button id="preview-report" class="btn-secondary">
                                                <i class="fas fa-eye mr-2"></i>
                                                プレビュー
                                            </button>
                                            <button id="save-report" class="btn-primary">
                                                <i class="fas fa-save mr-2"></i>
                                                保存
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="panel-content">
                                        <!-- レポート設定 -->
                                        <div class="report-config mb-6">
                                            <div class="config-row">
                                                <div class="config-field">
                                                    <label class="config-label">レポート名</label>
                                                    <input type="text" id="report-name" class="config-input" placeholder="レポート名を入力">
                                                </div>
                                                <div class="config-field">
                                                    <label class="config-label">カテゴリー</label>
                                                    <select id="report-category" class="config-select">
                                                        <option value="logistics">物流分析</option>
                                                        <option value="cost">コスト分析</option>
                                                        <option value="performance">パフォーマンス</option>
                                                        <option value="custom">カスタム</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div class="config-row">
                                                <div class="config-field">
                                                    <label class="config-label">データソース</label>
                                                    <select id="data-source" class="config-select">
                                                        <option value="all">全データソース</option>
                                                        <option value="erp">ERPシステム</option>
                                                        <option value="wms">WMSシステム</option>
                                                        <option value="tms">TMSシステム</option>
                                                    </select>
                                                </div>
                                                <div class="config-field">
                                                    <label class="config-label">期間設定</label>
                                                    <select id="date-range" class="config-select">
                                                        <option value="last7days">過去7日</option>
                                                        <option value="last30days">過去30日</option>
                                                        <option value="last90days">過去90日</option>
                                                        <option value="custom">カスタム</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- チャート設定 -->
                                        <div class="chart-config mb-6">
                                            <h4 class="config-section-title">
                                                <i class="fas fa-chart-pie mr-2"></i>
                                                チャート設定
                                            </h4>
                                            <div class="chart-types">
                                                <div class="chart-type-item active" data-type="line">
                                                    <i class="fas fa-chart-line"></i>
                                                    <span>折れ線グラフ</span>
                                                </div>
                                                <div class="chart-type-item" data-type="bar">
                                                    <i class="fas fa-chart-bar"></i>
                                                    <span>棒グラフ</span>
                                                </div>
                                                <div class="chart-type-item" data-type="pie">
                                                    <i class="fas fa-chart-pie"></i>
                                                    <span>円グラフ</span>
                                                </div>
                                                <div class="chart-type-item" data-type="table">
                                                    <i class="fas fa-table"></i>
                                                    <span>テーブル</span>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- データフィールド選択 -->
                                        <div class="field-selection">
                                            <h4 class="config-section-title">
                                                <i class="fas fa-database mr-2"></i>
                                                データフィールド選択
                                            </h4>
                                            <div class="fields-grid">
                                                <div class="field-item" data-field="cost">
                                                    <input type="checkbox" id="field-cost" checked>
                                                    <label for="field-cost">総コスト</label>
                                                </div>
                                                <div class="field-item" data-field="orders">
                                                    <input type="checkbox" id="field-orders" checked>
                                                    <label for="field-orders">注文数</label>
                                                </div>
                                                <div class="field-item" data-field="delivery">
                                                    <input type="checkbox" id="field-delivery">
                                                    <label for="field-delivery">配送時間</label>
                                                </div>
                                                <div class="field-item" data-field="efficiency">
                                                    <input type="checkbox" id="field-efficiency">
                                                    <label for="field-efficiency">効率性</label>
                                                </div>
                                                <div class="field-item" data-field="quality">
                                                    <input type="checkbox" id="field-quality">
                                                    <label for="field-quality">品質スコア</label>
                                                </div>
                                                <div class="field-item" data-field="satisfaction">
                                                    <input type="checkbox" id="field-satisfaction">
                                                    <label for="field-satisfaction">顧客満足度</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- レポート一覧・管理 -->
                            <div class="reports-list bg-white rounded-lg shadow-md">
                                <div class="panel-header">
                                    <h3 class="panel-title">
                                        <i class="fas fa-folder-open mr-2"></i>
                                        保存済みレポート
                                    </h3>
                                </div>
                                
                                <div class="panel-content">
                                    <div class="reports-filter mb-4">
                                        <select id="category-filter" class="filter-select">
                                            <option value="all">全カテゴリー</option>
                                            <option value="logistics">物流分析</option>
                                            <option value="cost">コスト分析</option>
                                            <option value="performance">パフォーマンス</option>
                                        </select>
                                    </div>
                                    
                                    <div id="reports-list" class="reports-container">
                                        <!-- レポート一覧が動的に生成される -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- レポートプレビュー -->
                        <div class="preview-section bg-white rounded-lg shadow-md mt-6">
                            <div class="panel-header">
                                <h3 class="panel-title">
                                    <i class="fas fa-eye mr-2"></i>
                                    レポートプレビュー
                                </h3>
                                <div class="preview-actions">
                                    <button id="export-pdf" class="btn-secondary">
                                        <i class="fas fa-file-pdf mr-2"></i>
                                        PDF出力
                                    </button>
                                    <button id="export-excel" class="btn-secondary">
                                        <i class="fas fa-file-excel mr-2"></i>
                                        Excel出力
                                    </button>
                                    <button id="share-report" class="btn-primary">
                                        <i class="fas fa-share mr-2"></i>
                                        共有
                                    </button>
                                </div>
                            </div>
                            
                            <div class="panel-content">
                                <div id="report-preview" class="report-preview-container">
                                    <!-- プレビュー用チャート -->
                                    <div class="preview-chart-container">
                                        <canvas id="preview-chart" width="100" height="400"></canvas>
                                    </div>
                                    
                                    <!-- プレビュー用テーブル -->
                                    <div class="preview-table-container mt-6">
                                        <table id="preview-table" class="preview-table">
                                            <thead>
                                                <tr>
                                                    <th>日付</th>
                                                    <th>総コスト</th>
                                                    <th>注文数</th>
                                                    <th>効率性(%)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>2024-01-15</td>
                                                    <td>¥125,000</td>
                                                    <td>45</td>
                                                    <td>87.5%</td>
                                                </tr>
                                                <tr>
                                                    <td>2024-01-14</td>
                                                    <td>¥130,000</td>
                                                    <td>52</td>
                                                    <td>85.2%</td>
                                                </tr>
                                                <tr>
                                                    <td>2024-01-13</td>
                                                    <td>¥118,000</td>
                                                    <td>38</td>
                                                    <td>89.1%</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 自動レポート設定 -->
                        <div class="automation-panel bg-white rounded-lg shadow-md mt-6">
                            <div class="panel-header">
                                <h3 class="panel-title">
                                    <i class="fas fa-robot mr-2"></i>
                                    自動レポート設定
                                </h3>
                            </div>
                            
                            <div class="panel-content">
                                <div class="automation-list">
                                    <div class="automation-item">
                                        <div class="automation-info">
                                            <div class="automation-name">日次コストレポート</div>
                                            <div class="automation-desc">毎日9:00に前日のコスト分析レポートを自動生成</div>
                                            <div class="automation-schedule">
                                                <i class="fas fa-clock mr-1"></i>
                                                毎日 09:00
                                            </div>
                                        </div>
                                        <div class="automation-status">
                                            <div class="status-indicator active"></div>
                                            <span class="status-text">アクティブ</span>
                                        </div>
                                        <div class="automation-actions">
                                            <button class="action-btn edit" onclick="editAutomation(1)">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="action-btn toggle" onclick="toggleAutomation(1)">
                                                <i class="fas fa-pause"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="automation-item">
                                        <div class="automation-info">
                                            <div class="automation-name">週次パフォーマンスレポート</div>
                                            <div class="automation-desc">毎週月曜日に前週のパフォーマンス分析を自動生成</div>
                                            <div class="automation-schedule">
                                                <i class="fas fa-clock mr-1"></i>
                                                毎週月曜日 10:00
                                            </div>
                                        </div>
                                        <div class="automation-status">
                                            <div class="status-indicator inactive"></div>
                                            <span class="status-text">停止中</span>
                                        </div>
                                        <div class="automation-actions">
                                            <button class="action-btn edit" onclick="editAutomation(2)">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="action-btn toggle" onclick="toggleAutomation(2)">
                                                <i class="fas fa-play"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="add-automation-section mt-4">
                                    <button id="add-automation-btn" class="btn-outline">
                                        <i class="fas fa-plus mr-2"></i>
                                        新しい自動レポートを追加
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>

        <script src="/static/report-management.js"></script>
    </body>
    </html>
  `);
});

// サービス利用者側テナント管理ダッシュボード（テナント企業内の管理機能）
app.get('/tenant-dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>テナント管理ダッシュボード - Core First</title>
        <link rel="icon" type="image/svg+xml" href="/static/logos/corefirst-favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex flex-col">
            <!-- ヘッダー -->
            <header class="bg-white shadow-sm border-b">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex items-center justify-between h-16">
                        <div class="flex items-center">
                            <img src="https://page.gensparksite.com/v1/base64_upload/1451b4a92bc5d668e9aec41baf8664c4" 
                                 alt="Core First Logo" 
                                 class="w-8 h-8 mr-3">
                            <div>
                                <h1 class="text-xl font-bold text-gray-900">Core First</h1>
                                <p class="text-sm text-gray-600">テナント管理ダッシュボード</p>
                            </div>
                        </div>
                        
                        <div class="flex items-center space-x-4">
                            <div class="text-sm text-gray-600">
                                <span class="font-medium">ABC物流株式会社</span>
                                <span class="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Standardプラン</span>
                            </div>
                            
                            <button onclick="switchToProviderView()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors">
                                <i class="fas fa-crown mr-2"></i>
                                統合管理画面
                            </button>
                            
                            <button onclick="logout()" class="text-gray-600 hover:text-gray-900">
                                <i class="fas fa-sign-out-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            
            <!-- メインコンテンツ -->
            <main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-2">テナント管理機能</h2>
                    <p class="text-gray-600">自社テナント内のユーザー・権限・設定を管理します</p>
                </div>
                
                <!-- 機能カード -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div class="flex items-center mb-4">
                            <div class="p-3 bg-blue-50 rounded-lg">
                                <i class="fas fa-users text-blue-600 text-xl"></i>
                            </div>
                            <div class="ml-4">
                                <h3 class="text-lg font-semibold text-gray-900">ユーザー管理</h3>
                                <p class="text-sm text-gray-600">自社内ユーザーの管理</p>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">総ユーザー数</span>
                                <span class="font-semibold">23名</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">アクティブユーザー</span>
                                <span class="font-semibold text-green-600">21名</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">利用可能枠</span>
                                <span class="font-semibold text-blue-600">50名まで</span>
                            </div>
                        </div>
                        <button class="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md text-sm transition-colors">
                            ユーザー管理を開く
                        </button>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div class="flex items-center mb-4">
                            <div class="p-3 bg-purple-50 rounded-lg">
                                <i class="fas fa-shield-alt text-purple-600 text-xl"></i>
                            </div>
                            <div class="ml-4">
                                <h3 class="text-lg font-semibold text-gray-900">権限管理</h3>
                                <p class="text-sm text-gray-600">ロール・アクセス制御</p>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">管理者</span>
                                <span class="font-semibold">3名</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">一般ユーザー</span>
                                <span class="font-semibold">18名</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">ゲスト</span>
                                <span class="font-semibold">2名</span>
                            </div>
                        </div>
                        <button class="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-md text-sm transition-colors">
                            権限管理を開く
                        </button>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div class="flex items-center mb-4">
                            <div class="p-3 bg-green-50 rounded-lg">
                                <i class="fas fa-chart-bar text-green-600 text-xl"></i>
                            </div>
                            <div class="ml-4">
                                <h3 class="text-lg font-semibold text-gray-900">利用状況</h3>
                                <p class="text-sm text-gray-600">使用量・制限確認</p>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">データ使用量</span>
                                <span class="font-semibold">2.4GB / 10GB</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">API利用量</span>
                                <span class="font-semibold">8,450 / 50,000</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                                <div class="bg-green-600 h-2 rounded-full" style="width: 24%"></div>
                            </div>
                        </div>
                        <button class="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2 rounded-md text-sm transition-colors">
                            詳細を確認
                        </button>
                    </div>
                </div>
                
                <!-- アラート・お知らせ -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
                    <div class="flex items-center">
                        <i class="fas fa-info-circle text-blue-600 mr-3"></i>
                        <div>
                            <h4 class="text-blue-900 font-semibold">テナント管理機能について</h4>
                            <p class="text-blue-800 text-sm mt-1">
                                この画面では、自社テナント内のユーザー管理・権限設定・利用状況確認ができます。
                                全テナント横断の管理は「統合管理画面」をご利用ください。
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- 最近の活動 -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div class="p-6 border-b border-gray-200">
                        <h3 class="text-lg font-semibold text-gray-900">最近の活動</h3>
                        <p class="text-sm text-gray-600">自社テナント内の活動履歴</p>
                    </div>
                    <div class="p-6">
                        <div class="space-y-4">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-user-plus text-green-600 text-xs"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="text-sm font-medium text-gray-900">新規ユーザー追加</p>
                                    <p class="text-xs text-gray-500">山田太郎さんが倉庫管理者として追加されました</p>
                                </div>
                                <span class="text-xs text-gray-400">1時間前</span>
                            </div>
                            
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-key text-blue-600 text-xs"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="text-sm font-medium text-gray-900">権限変更</p>
                                    <p class="text-xs text-gray-500">佐藤花子さんの権限がユーザーから管理者に変更されました</p>
                                </div>
                                <span class="text-xs text-gray-400">3時間前</span>
                            </div>
                            
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-exclamation-triangle text-yellow-600 text-xs"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="text-sm font-medium text-gray-900">利用量アラート</p>
                                    <p class="text-xs text-gray-500">データ使用量が制限の80%に達しました</p>
                                </div>
                                <span class="text-xs text-gray-400">1日前</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <script>
            function switchToProviderView() {
                if (confirm('統合管理画面に切り替えますか？\n（サービス提供者側の管理機能に移動します）')) {
                    window.location.href = '/admin-dashboard';
                }
            }
            
            function logout() {
                if (confirm('ログアウトしますか？')) {
                    localStorage.removeItem('authToken');
                    window.location.href = '/login';
                }
            }
        </script>
    </body>
    </html>
  `);
});

export default app;