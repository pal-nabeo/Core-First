// PAL物流SaaS 管理画面JavaScript

let currentUser = null;
let currentTenant = null;
let currentRoles = [];

// 認証状態をチェック
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                currentUser = data.user;
                currentTenant = data.tenant;
                currentRoles = data.roles;
                
                // 管理者権限チェック
                const isAdmin = currentRoles.some(role => 
                    role.name === 'super_admin' || role.name === 'admin'
                );

                if (!isAdmin) {
                    showError('管理者権限が必要です。');
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                    return false;
                }

                return true;
            }
        }
        
        // 認証失敗
        window.location.href = '/login';
        return false;
        
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
        return false;
    }
}

// 管理画面のメインコンテンツをレンダリング
function renderAdminPanel() {
    const app = document.getElementById('admin-app');
    
    app.innerHTML = `
        <!-- ヘッダー -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <!-- ロゴとタイトル -->
                    <div class="flex items-center">
                        <div class="flex items-center">
                            <i class="fas fa-truck-moving text-blue-600 text-2xl mr-3"></i>
                            <h1 class="text-xl font-bold text-gray-900">PAL物流SaaS 管理画面</h1>
                        </div>
                        <div class="ml-6 text-sm text-gray-500">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                ${currentTenant.name}
                            </span>
                        </div>
                    </div>

                    <!-- ユーザーメニュー -->
                    <div class="flex items-center space-x-4">
                        <div class="text-sm text-gray-700">
                            <i class="fas fa-user-circle mr-1"></i>
                            ${currentUser.display_name}
                        </div>
                        <button onclick="logout()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- サイドバーとメインコンテンツ -->
        <div class="flex h-screen bg-gray-100">
            <!-- サイドバー -->
            <nav class="w-64 bg-white shadow-sm">
                <div class="p-4">
                    <ul class="space-y-2" id="nav-menu">
                        <li>
                            <a href="#dashboard" onclick="showSection('dashboard')" class="nav-item flex items-center px-4 py-2 text-sm font-medium text-gray-900 rounded-md bg-gray-100">
                                <i class="fas fa-tachometer-alt mr-3"></i>
                                ダッシュボード
                            </a>
                        </li>
                        <li>
                            <a href="#users" onclick="showSection('users')" class="nav-item flex items-center px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100">
                                <i class="fas fa-users mr-3"></i>
                                ユーザー管理
                            </a>
                        </li>
                        <li>
                            <a href="#invitations" onclick="showSection('invitations')" class="nav-item flex items-center px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100">
                                <i class="fas fa-user-plus mr-3"></i>
                                招待管理
                            </a>
                        </li>
                        <li>
                            <a href="#roles" onclick="showSection('roles')" class="nav-item flex items-center px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100">
                                <i class="fas fa-shield-alt mr-3"></i>
                                権限管理
                            </a>
                        </li>
                        <li>
                            <a href="#security" onclick="showSection('security')" class="nav-item flex items-center px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100">
                                <i class="fas fa-lock mr-3"></i>
                                セキュリティ設定
                            </a>
                        </li>
                        <li>
                            <a href="#audit" onclick="showSection('audit')" class="nav-item flex items-center px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100">
                                <i class="fas fa-history mr-3"></i>
                                監査ログ
                            </a>
                        </li>
                        ${currentRoles.some(role => role.name === 'super_admin') ? `
                        <li>
                            <a href="#billing" onclick="showSection('billing')" class="nav-item flex items-center px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100">
                                <i class="fas fa-credit-card mr-3"></i>
                                課金・プラン
                            </a>
                        </li>
                        ` : ''}
                    </ul>
                </div>
            </nav>

            <!-- メインコンテンツ -->
            <main class="flex-1 overflow-y-auto">
                <div class="p-8">
                    <!-- エラー・成功メッセージ -->
                    <div id="message-area"></div>

                    <!-- コンテンツエリア -->
                    <div id="content-area">
                        <!-- 初期表示はダッシュボード -->
                    </div>
                </div>
            </main>
        </div>
    `;

    // 初期表示
    showSection('dashboard');
}

// セクション切り替え
function showSection(sectionName) {
    // ナビゲーションの状態更新
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('text-gray-900', 'bg-gray-100');
        item.classList.add('text-gray-600', 'hover:bg-gray-100');
    });
    
    const activeItem = document.querySelector(`a[href="#${sectionName}"]`);
    if (activeItem) {
        activeItem.classList.remove('text-gray-600', 'hover:bg-gray-100');
        activeItem.classList.add('text-gray-900', 'bg-gray-100');
    }

    // コンテンツの切り替え
    const contentArea = document.getElementById('content-area');
    
    switch (sectionName) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'users':
            renderUserManagement();
            break;
        case 'invitations':
            renderInvitationManagement();
            break;
        case 'roles':
            renderRoleManagement();
            break;
        case 'security':
            renderSecuritySettings();
            break;
        case 'audit':
            renderAuditLogs();
            break;
        case 'billing':
            renderBillingManagement();
            break;
        default:
            contentArea.innerHTML = '<p class="text-gray-500">コンテンツが見つかりません。</p>';
    }
}

// ダッシュボードをレンダリング
function renderDashboard() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">ダッシュボード</h2>
            <p class="text-gray-600">企業の利用状況とシステム概要を確認できます。</p>
        </div>

        <!-- 統計カード -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <i class="fas fa-users text-blue-600 text-2xl"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">総ユーザー数</p>
                        <p class="text-2xl font-bold text-gray-900" id="total-users">-</p>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <i class="fas fa-user-check text-green-600 text-2xl"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">アクティブユーザー</p>
                        <p class="text-2xl font-bold text-gray-900" id="active-users">-</p>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <i class="fas fa-envelope text-yellow-600 text-2xl"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">保留中の招待</p>
                        <p class="text-2xl font-bold text-gray-900" id="pending-invitations">-</p>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <i class="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">セキュリティアラート</p>
                        <p class="text-2xl font-bold text-gray-900" id="security-alerts">0</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 最近のアクティビティ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-medium text-gray-900 mb-4">
                    <i class="fas fa-history mr-2"></i>
                    最近のログイン
                </h3>
                <div id="recent-logins" class="space-y-3">
                    <p class="text-gray-500">読み込み中...</p>
                </div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-medium text-gray-900 mb-4">
                    <i class="fas fa-chart-line mr-2"></i>
                    システム情報
                </h3>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-gray-600">プラン</span>
                        <span class="font-medium">${currentTenant.plan_id.toUpperCase()}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">企業タイプ</span>
                        <span class="font-medium">${currentTenant.company_type || '未設定'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">企業規模</span>
                        <span class="font-medium">${currentTenant.company_size || '未設定'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">作成日</span>
                        <span class="font-medium">${new Date(currentTenant.created_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // ダッシュボードデータを読み込み
    loadDashboardData();
}

// その他のセクションのレンダリング関数（簡略化）
function renderUserManagement() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">ユーザー管理</h2>
            <p class="text-gray-600">企業内のユーザーの管理と権限設定を行えます。</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
            <p class="text-gray-500">ユーザー管理機能は次のフェーズで実装予定です。</p>
        </div>
    `;
}

function renderInvitationManagement() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">招待管理</h2>
            <p class="text-gray-600">新しいユーザーの招待と招待状況の管理を行えます。</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
            <p class="text-gray-500">招待管理機能は次のフェーズで実装予定です。</p>
        </div>
    `;
}

function renderRoleManagement() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">権限管理</h2>
            <p class="text-gray-600">ユーザーロールと権限の設定を管理できます。</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
            <p class="text-gray-500">権限管理機能は次のフェーズで実装予定です。</p>
        </div>
    `;
}

function renderSecuritySettings() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">セキュリティ設定</h2>
            <p class="text-gray-600">パスワードポリシーや2要素認証の設定を管理できます。</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
            <p class="text-gray-500">セキュリティ設定機能は次のフェーズで実装予定です。</p>
        </div>
    `;
}

function renderAuditLogs() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">監査ログ</h2>
            <p class="text-gray-600">システムの利用履歴とセキュリティログを確認できます。</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
            <p class="text-gray-500">監査ログ機能は次のフェーズで実装予定です。</p>
        </div>
    `;
}

function renderBillingManagement() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">課金・プラン管理</h2>
            <p class="text-gray-600">プランの変更と課金情報を管理できます。</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
            <p class="text-gray-500">課金・プラン管理機能は次のフェーズで実装予定です。</p>
        </div>
    `;
}

// ダッシュボードデータを読み込み
async function loadDashboardData() {
    try {
        // 実際のAPIが実装されるまでのダミーデータ
        document.getElementById('total-users').textContent = '12';
        document.getElementById('active-users').textContent = '8';
        document.getElementById('pending-invitations').textContent = '3';
        document.getElementById('security-alerts').textContent = '0';

        // 最近のログインダミーデータ
        document.getElementById('recent-logins').innerHTML = `
            <div class="flex items-center justify-between py-2">
                <div>
                    <p class="font-medium text-gray-900">田中 太郎</p>
                    <p class="text-sm text-gray-500">admin@abc-logistics.co.jp</p>
                </div>
                <p class="text-sm text-gray-500">2時間前</p>
            </div>
            <div class="flex items-center justify-between py-2">
                <div>
                    <p class="font-medium text-gray-900">佐藤 花子</p>
                    <p class="text-sm text-gray-500">manager@abc-logistics.co.jp</p>
                </div>
                <p class="text-sm text-gray-500">5時間前</p>
            </div>
            <div class="flex items-center justify-between py-2">
                <div>
                    <p class="font-medium text-gray-900">鈴木 次郎</p>
                    <p class="text-sm text-gray-500">staff1@abc-logistics.co.jp</p>
                </div>
                <p class="text-sm text-gray-500">1日前</p>
            </div>
        `;

    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showError('ダッシュボードデータの読み込みに失敗しました。');
    }
}

// ログアウト
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        window.location.href = '/login';
    }
}

// エラー表示
function showError(message) {
    const messageArea = document.getElementById('message-area');
    messageArea.innerHTML = `
        <div class="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span>${message}</span>
            </div>
        </div>
    `;
}

// 成功メッセージ表示
function showSuccess(message) {
    const messageArea = document.getElementById('message-area');
    messageArea.innerHTML = `
        <div class="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md">
            <div class="flex items-center">
                <i class="fas fa-check-circle mr-2"></i>
                <span>${message}</span>
            </div>
        </div>
    `;
}

// 初期化
document.addEventListener('DOMContentLoaded', async function() {
    const loading = document.getElementById('loading');
    
    // 認証チェック
    const isAuthenticated = await checkAuth();
    
    if (isAuthenticated) {
        loading.style.display = 'none';
        renderAdminPanel();
    }
});