// Core First サービス提供者統合管理システム JavaScript
console.log('JavaScript file loaded');

// グローバル変数
let currentSection = 'overview';
let dashboardData = {};
let realTimeInterval = null;

// ページ読み込み時の初期化
function initializeWhenReady() {
    console.log('initializeWhenReady called');
    console.log('Document ready state:', document.readyState);
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOMContentLoaded event fired');
            performInitialization();
        });
    } else {
        console.log('Document already ready, initializing immediately');
        performInitialization();
    }
}

function performInitialization() {
    console.log('performInitialization called');
    try {
        initializeDashboard();
        loadDashboardData();
        startRealTimeUpdates();
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// スクリプト読み込み時に実行
initializeWhenReady();

// ダッシュボード初期化
function initializeDashboard() {
    console.log('Initializing dashboard...');
    
    // DOMの状態を確認
    console.log('Document ready state:', document.readyState);
    console.log('Sidebar element:', document.getElementById('sidebar'));
    console.log('Overview section element:', document.getElementById('overview-section'));
    
    // サイドバー初期化
    setupSidebar();
    
    // イベントリスナー設定
    setupEventListeners();
    
    // 初期セクション表示（少し遅らせる）
    setTimeout(() => {
        console.log('Checking initial section state...');
        const overviewSection = document.getElementById('overview-section');
        if (overviewSection && !overviewSection.classList.contains('hidden')) {
            console.log('Overview section already visible, skipping showSection');
            // ナビゲーションのアクティブ状態だけ更新
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            const activeNavItem = document.querySelector('[data-section="overview"]');
            if (activeNavItem) {
                activeNavItem.classList.add('active');
            }
        } else {
            console.log('Showing initial overview section...');
            showSection('overview');
        }
    }, 100);
}

// セクション表示制御
function showSection(sectionId) {
    console.log('showSection called with:', sectionId);
    
    // ローディングスピナーを表示
    showLoadingSpinner();
    
    // 全セクションを非表示
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });
    
    // 指定セクションを表示（-sectionサフィックス付きで検索）
    let targetSection = document.getElementById(sectionId + '-section');
    
    if (!targetSection) {
        // サフィックスなしでも検索
        targetSection = document.getElementById(sectionId);
    }
    
    if (!targetSection) {
        // セクションが存在しない場合は動的に作成
        console.warn('Section not found, creating:', sectionId);
        const mainContent = document.querySelector('main');
        if (mainContent) {
            targetSection = document.createElement('div');
            targetSection.id = sectionId + '-section';
            targetSection.className = 'content-section';
            mainContent.appendChild(targetSection);
            console.log('Created new section:', targetSection.id);
        }
    }
    
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
        console.log('Showing section:', targetSection.id);
    } else {
        console.error('Could not find or create section:', sectionId);
    }
    
    // ナビゲーションアクティブ状態更新
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeNavItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
        console.log('Set active nav item:', activeNavItem);
    } else {
        console.error('Could not find nav item with data-section:', sectionId);
    }
    
    // ページタイトル更新
    updatePageTitle(sectionId);
    
    // セクション別データ読み込み（非同期で実行してスピナーを表示）
    setTimeout(() => {
        loadSectionData(sectionId);
        // データ読み込み完了後、スピナーを非表示
        setTimeout(() => {
            hideLoadingSpinner();
        }, 100);
    }, 50);
    
    currentSection = sectionId;
}

// ページタイトル更新
function updatePageTitle(sectionId) {
    const titles = {
        'overview': '統合ダッシュボード - 全テナント概要',
        'realtime-monitoring': 'リアルタイム監視 - システム状況',
        'tenant-management': 'テナント管理 - 企業・プラン管理',
        'cross-tenant-users': '横断ユーザー管理 - 全テナント検索',
        'usage-analytics': '利用分析 - テナント別利用状況',
        'revenue-dashboard': '売上ダッシュボード - 収益分析',
        'billing-management': '請求管理 - 一括発行・支払い状況',
        'subscription-management': 'サブスクリプション管理 - プラン変更',
        'support-tickets': 'サポートチケット - 問い合わせ管理',
        'customer-success': 'カスタマーサクセス - 健全性分析',
        'system-monitoring': 'システム監視 - パフォーマンス',
        'audit-logs': '監査ログ - セキュリティ・コンプライアンス',
        'backup-management': 'バックアップ管理 - データ保護',
        'admin-users': '管理者管理 - 提供者側アカウント',
        'role-permissions': '権限管理 - ロール・アクセス制御',
        'profile': 'プロフィール設定 - 管理者アカウント管理'
    };
    
    document.getElementById('page-title').textContent = 'Core First 統合管理システム';
    document.getElementById('page-subtitle').textContent = titles[sectionId] || 'サービス提供者ダッシュボード';
}

// ローディングスピナー表示
function showLoadingSpinner() {
    let spinner = document.getElementById('loading-spinner-overlay');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'loading-spinner-overlay';
        spinner.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.3); z-index: 9999; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px 40px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #3b82f6; margin-bottom: 15px;"></i>
                    <p style="font-size: 16px; color: #4b5563; margin: 0;">データを読み込み中...</p>
                </div>
            </div>
        `;
        document.body.appendChild(spinner);
    }
    spinner.style.display = 'flex';
}

// ローディングスピナー非表示
function hideLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner-overlay');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

// サイドバー設定
function setupSidebar() {
    // サイドバー折りたたみ
    window.toggleSidebar = function() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        
        // 折りたたみ状態をローカルストレージに保存
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed);
    };
    
    // ページ読み込み時に前回の状態を復元
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed) {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.add('collapsed');
    }
}

// イベントリスナー設定
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // サイドバーメニューアイテムにクリックイベントを追加
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    console.log('Found nav items:', navItems.length);
    
    if (navItems.length === 0) {
        console.error('No nav items found! Checking DOM...');
        console.log('Available elements with nav-item class:', document.getElementsByClassName('nav-item'));
        console.log('Available elements with data-section:', document.querySelectorAll('[data-section]'));
        // DOMがまだ準備されていない可能性があるため、少し待って再試行
        setTimeout(() => {
            console.log('Retrying nav item setup...');
            setupEventListeners();
        }, 500);
        return;
    }
    
    navItems.forEach((item, index) => {
        const sectionId = item.getAttribute('data-section');
        console.log(`Setting up nav item ${index}: ${sectionId}`);
        
        item.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Nav item clicked:', sectionId);
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });
    
    // テナント管理画面への切り替え
    const switchToTenantButton = document.getElementById('switch-to-tenant');
    if (switchToTenantButton) {
        console.log('Found switch-to-tenant button');
        switchToTenantButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Switch to tenant button clicked');
            if (confirm('テナント管理画面に切り替えますか？\n（サービス利用者側の管理機能に移動します）')) {
                console.log('Redirecting to /tenant-dashboard');
                window.location.href = '/tenant-dashboard';
            }
        });
    } else {
        console.log('Switch to tenant button not found');
    }
    
    // ユーザーメニューのドロップダウン機能
    setupUserMenuDropdown();
    
    // プロフィール設定ボタン
    const profileButton = document.getElementById('profile-button');
    if (profileButton) {
        profileButton.addEventListener('click', function() {
            showSection('profile');
        });
    }
    
    // ログアウトボタン
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            if (confirm('ログアウトしますか？')) {
                fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include'
                }).then(() => {
                    window.location.href = '/login';
                }).catch(() => {
                    window.location.href = '/login';
                });
            }
        });
    }
    
    // サイドバー折りたたみボタンのイベント
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
}

// ダッシュボードデータ読み込み
async function loadDashboardData() {
    try {
        // KPIデータをAPIから取得
        const response = await fetch('/api/provider-dashboard/kpi');
        if (!response.ok) {
            // 認証エラーの場合は静かにフォールバック
            if (response.status === 403 || response.status === 401) {
                console.log('認証が必要です。サンプルデータを使用します。');
                throw new Error('AUTH_REQUIRED');
            }
            throw new Error('KPIデータの取得に失敗しました');
        }
        const kpiData = await response.json();
        
        // 売上データを取得
        const revenueResponse = await fetch('/api/provider-dashboard/revenue');
        const revenueData = revenueResponse.ok ? await revenueResponse.json() : null;
        
        // チャート用のアクティビティデータを取得
        const activityResponse = await fetch('/api/provider-dashboard/charts/user-activity');
        const activityData = activityResponse.ok ? await activityResponse.json() : null;
        
        dashboardData = {
            overview: {
                totalTenants: kpiData.success ? kpiData.data.totalTenants : 0,
                activeTenants: kpiData.success ? kpiData.data.activeTenants : 0,
                totalUsers: kpiData.success ? kpiData.data.totalUsers : 0,
                activeUsers: kpiData.success ? kpiData.data.activeUsers : 0,
                monthlyRevenue: revenueData?.success ? revenueData.data.totalMonthlyRevenue : 0,
                systemUptime: kpiData.success ? kpiData.data.systemUptime : 0,
                licenseUsage: kpiData.success ? kpiData.data.licenseUsage : { percentage: 0 },
                alertCount: 2 // 疑似データ
            },
            tenants: generateSampleTenants(),
            systemMetrics: generateSystemMetrics(),
            revenueData: revenueData?.success ? revenueData.data.revenueHistory : generateRevenueData(),
            activityData: activityData?.success ? activityData.data.activityData : null,
            supportTickets: generateSupportTickets()
        };
        
        renderOverviewSection();
    } catch (error) {
        console.error('データ読み込みエラー:', error);
        
        // 認証エラーの場合はアラートを表示しない
        if (error.message !== 'AUTH_REQUIRED') {
            showAlert('データの読み込みに失敗しました', 'error');
        }
        
        // フォールバック：サンプルデータを使用
        dashboardData = {
            overview: {
                totalTenants: 0,
                activeTenants: 0,
                totalUsers: 0,
                activeUsers: 0,
                monthlyRevenue: 0,
                systemUptime: 0,
                licenseUsage: { percentage: 0 },
                alertCount: 0
            },
            tenants: [],
            systemMetrics: generateSystemMetrics(),
            revenueData: generateRevenueData(),
            supportTickets: []
        };
        renderOverviewSection();
    }
}

// セクション別データ読み込み
function loadSectionData(sectionId) {
    console.log('loadSectionData called for:', sectionId);
    
    switch (sectionId) {
        case 'overview':
            renderOverviewSection();
            break;
        case 'realtime-monitoring':
            renderRealTimeMonitoring();
            break;
        case 'tenant-management':
            renderTenantManagement();
            break;
        case 'cross-tenant-users':
            renderCrossTenantUsers();
            break;
        case 'usage-analytics':
            renderUsageAnalytics();
            break;
        case 'revenue-dashboard':
            renderRevenueDashboard();
            break;
        case 'billing-management':
            renderBillingManagement();
            break;
        case 'subscription-management':
            renderSubscriptionManagement();
            break;
        case 'support-tickets':
            renderSupportTickets();
            break;
        case 'customer-success':
            renderCustomerSuccess();
            break;
        case 'system-monitoring':
            renderSystemMonitoring();
            break;
        case 'audit-logs':
            renderAuditLogs();
            break;
        case 'backup-management':
            renderBackupManagement();
            break;
        case 'admin-users':
            renderAdminUsers();
            break;
        case 'role-permissions':
            renderRolePermissions();
            break;
        case 'profile':
            renderProfile();
            break;
        default:
            console.log('Unknown section:', sectionId);
            const section = document.getElementById(sectionId) || document.getElementById(sectionId + '-section');
            if (section) {
                section.innerHTML = `
                    <div class="p-6">
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">${sectionId}</h2>
                        <p class="text-gray-600">この機能は現在実装中です...</p>
                    </div>
                `;
            }
            break;
    }
}

// 統合ダッシュボードセクション描画
function renderOverviewSection() {
    let section = document.getElementById('overview');
    if (!section) {
        section = document.getElementById('overview-section');
        if (section) {
            section.id = 'overview'; // IDを変更
        }
    }
    if (!section) {
        console.log('Creating overview section...');
        section = document.createElement('div');
        section.id = 'overview';
        section.className = 'content-section';
        const main = document.querySelector('main');
        if (main) {
            main.appendChild(section);
        }
    }
    
    if (!dashboardData.overview) {
        console.log('No dashboard data, loading...');
        section.innerHTML = '<div class="p-6"><div class="text-center"><i class="fas fa-spinner fa-spin text-2xl mb-4"></i><p>データを読み込み中...</p></div></div>';
        return;
    }
    
    const data = dashboardData.overview;
    console.log('Rendering overview with data:', data);
    
    section.innerHTML = `
        <div class="p-6">
            <!-- KPI概要 -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <i class="fas fa-building text-2xl text-blue-600 mr-3"></i>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900">総テナント数</h3>
                                <p class="text-sm text-gray-600">アクティブ: ${data.activeTenants}</p>
                            </div>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-blue-600">${data.totalTenants.toLocaleString()}</div>
                    <div class="text-sm text-green-600 mt-2">
                        <i class="fas fa-arrow-up mr-1"></i>+8.5% vs 先月
                    </div>
                </div>
                
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <i class="fas fa-users text-2xl text-green-600 mr-3"></i>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900">総ユーザー数</h3>
                                <p class="text-sm text-gray-600">アクティブ: ${data.activeUsers.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-green-600">${data.totalUsers.toLocaleString()}</div>
                    <div class="text-sm text-green-600 mt-2">
                        <i class="fas fa-arrow-up mr-1"></i>+12.3% vs 先月
                    </div>
                </div>
                
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <i class="fas fa-yen-sign text-2xl text-purple-600 mr-3"></i>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900">月間売上</h3>
                                <p class="text-sm text-gray-600">ARR: ${(data.monthlyRevenue * 12).toLocaleString()}円</p>
                            </div>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-purple-600">¥${data.monthlyRevenue.toLocaleString()}</div>
                    <div class="text-sm text-green-600 mt-2">
                        <i class="fas fa-arrow-up mr-1"></i>+15.7% vs 先月
                    </div>
                </div>
                
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <i class="fas fa-server text-2xl text-orange-600 mr-3"></i>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900">システム稼働率</h3>
                                <p class="text-sm text-gray-600">ライセンス使用率: ${data.licenseUsage?.percentage || 0}%</p>
                            </div>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-orange-600">${typeof data.systemUptime === 'number' ? data.systemUptime.toFixed(2) : '0.00'}%</div>
                    <div class="text-sm text-green-600 mt-2">
                        <i class="fas fa-check mr-1"></i>SLA目標達成
                    </div>
                </div>
            </div>
            
            <!-- アラート・通知 -->
            ${data.alertCount > 0 ? `
            <div class="alert-box alert-warning mb-6">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle mr-3"></i>
                    <div>
                        <h4 class="font-semibold">要注意事項 (${data.alertCount}件)</h4>
                        <p class="text-sm">システム監視で検出されたアラートがあります。詳細は「リアルタイム監視」をご確認ください。</p>
                    </div>
                    <button onclick="showSection('realtime-monitoring')" class="btn-primary ml-auto">
                        <i class="fas fa-eye"></i>確認
                    </button>
                </div>
            </div>
            ` : ''}
            
            <!-- チャート・グラフエリア -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div class="chart-container">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">
                        <i class="fas fa-chart-line mr-2 text-blue-600"></i>
                        月間売上推移
                    </h3>
                    <canvas id="revenueChart" width="400" height="200"></canvas>
                </div>
                
                <div class="chart-container">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">
                        <i class="fas fa-pie-chart mr-2 text-green-600"></i>
                        テナントプラン分布
                    </h3>
                    <canvas id="planDistributionChart" width="400" height="200"></canvas>
                </div>
            </div>
            
            <!-- クイックアクション -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-bolt mr-2 text-yellow-600"></i>
                    クイックアクション
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button onclick="showSection('tenant-management')" class="btn-primary">
                        <i class="fas fa-plus"></i>新規テナント登録
                    </button>
                    <button onclick="showSection('billing-management')" class="btn-secondary">
                        <i class="fas fa-file-invoice"></i>請求書一括発行
                    </button>
                    <button onclick="showSection('support-tickets')" class="btn-secondary">
                        <i class="fas fa-ticket-alt"></i>サポート対応
                    </button>
                    <button onclick="showSection('system-monitoring')" class="btn-secondary">
                        <i class="fas fa-cogs"></i>システム状況
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // チャート描画
    setTimeout(() => {
        renderRevenueChart();
        renderPlanDistributionChart();
    }, 100);
}

// リアルタイム監視セクション描画
function renderRealTimeMonitoring() {
    let section = document.getElementById('realtime-monitoring-section');
    if (!section) {
        console.log('Creating realtime-monitoring section...');
        section = document.createElement('div');
        section.id = 'realtime-monitoring-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    
    section.innerHTML = `
        <div class="p-6">
            <div class="alert-box alert-info mb-6">
                <div class="flex items-center">
                    <i class="fas fa-info-circle mr-3"></i>
                    <div>
                        <h4 class="font-semibold">リアルタイム監視システム</h4>
                        <p class="text-sm">システム全体の状況を24時間監視しています。異常検知時は自動的にアラートを発信します。</p>
                    </div>
                </div>
            </div>
            
            <!-- システム状況概要 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <div class="status-indicator status-active pulse"></div>
                            <h3 class="text-lg font-semibold text-gray-900">全体稼働率</h3>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-green-600">99.97%</div>
                    <div class="progress-bar mt-3">
                        <div class="progress-fill" style="width: 99.97%"></div>
                    </div>
                </div>
                
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <div class="status-indicator status-warning"></div>
                            <h3 class="text-lg font-semibold text-gray-900">平均応答時間</h3>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-orange-600">245ms</div>
                    <div class="text-sm text-gray-600 mt-2">目標: <300ms</div>
                </div>
                
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <div class="status-indicator status-active"></div>
                            <h3 class="text-lg font-semibold text-gray-900">アクティブセッション</h3>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-blue-600">8,743</div>
                    <div class="text-sm text-green-600 mt-2">
                        <i class="fas fa-arrow-up mr-1"></i>+5.2% vs 1時間前
                    </div>
                </div>
            </div>
            
            <!-- アラート一覧 -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-bell mr-2 text-red-600"></i>
                    アクティブアラート
                </h3>
                <div class="space-y-3">
                    <div class="alert-box alert-warning">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <i class="fas fa-exclamation-triangle mr-3"></i>
                                <div>
                                    <h4 class="font-semibold">CPU使用率 警告</h4>
                                    <p class="text-sm">Web Server #3 - CPU使用率が80%を超過しています</p>
                                    <p class="text-xs text-gray-500">2分前 • 優先度: 中</p>
                                </div>
                            </div>
                            <div class="flex space-x-2">
                                <button class="btn-secondary">詳細</button>
                                <button class="btn-primary">対処</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="alert-box alert-error">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <i class="fas fa-times-circle mr-3"></i>
                                <div>
                                    <h4 class="font-semibold">データベース接続エラー</h4>
                                    <p class="text-sm">テナント #1234 - データベース接続に断続的な失敗</p>
                                    <p class="text-xs text-gray-500">15分前 • 優先度: 高</p>
                                </div>
                            </div>
                            <div class="flex space-x-2">
                                <button class="btn-secondary">詳細</button>
                                <button class="btn-primary">対処</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// サンプルデータ生成関数
function generateSampleTenants() {
    const companies = ['ABC物流', 'XYZ運輸', 'DEF配送', 'GHI倉庫', 'JKL輸送'];
    const plans = ['Free', 'Standard', 'Plus', 'Pro', 'Enterprise'];
    const statuses = ['active', 'suspended', 'cancelled'];
    
    return Array.from({length: 50}, (_, i) => ({
        id: i + 1,
        companyName: `${companies[i % companies.length]} ${Math.floor(i/companies.length) + 1}`,
        plan: plans[Math.floor(Math.random() * plans.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        userCount: Math.floor(Math.random() * 100) + 1,
        dataUsage: (Math.random() * 10).toFixed(2),
        monthlyRevenue: Math.floor(Math.random() * 50000) + 5000,
        lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('ja-JP'),
        healthScore: (Math.random() * 0.4 + 0.6).toFixed(2)
    }));
}

function generateSystemMetrics() {
    return {
        cpu: Math.floor(Math.random() * 30) + 45,
        memory: Math.floor(Math.random() * 25) + 60,
        disk: Math.floor(Math.random() * 20) + 30,
        network: Math.floor(Math.random() * 40) + 20
    };
}

function generateRevenueData() {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月'];
    return months.map((month, i) => ({
        month,
        revenue: Math.floor(Math.random() * 500000) + 2000000 + (i * 100000)
    }));
}

function generateSupportTickets() {
    const categories = ['technical', 'billing', 'general'];
    const priorities = ['low', 'medium', 'high', 'urgent'];
    const statuses = ['open', 'in_progress', 'resolved', 'closed'];
    
    return Array.from({length: 20}, (_, i) => ({
        id: i + 1,
        title: `サポート案件 #${i + 1}`,
        category: categories[Math.floor(Math.random() * categories.length)],
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        tenantName: `テナント企業 ${i + 1}`,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ja-JP')
    }));
}

// チャート描画関数
function renderRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx || !dashboardData.revenueData) return;
    
    // チャートデータを準備
    const chartData = dashboardData.revenueData;
    const labels = chartData.map(d => d.month || d.label || 'N/A');
    const revenues = chartData.map(d => d.revenue || d.value || 0);
    
    // 既存のチャートがあれば破棄
    if (window.revenueChartInstance) {
        window.revenueChartInstance.destroy();
    }
    
    window.revenueChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '月間売上',
                data: revenues,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return '月間売上: ¥' + context.parsed.y.toLocaleString() + '円';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '¥' + (value / 1000000).toFixed(1) + 'M';
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

async function renderPlanDistributionChart() {
    const ctx = document.getElementById('planDistributionChart');
    if (!ctx) return;
    
    // プラン分布データを取得
    let planData = {};
    
    try {
        const response = await fetch('/api/provider-dashboard/revenue');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.revenueBreakdown) {
                data.data.revenueBreakdown.forEach(plan => {
                    planData[plan.plan] = plan.tenantCount;
                });
            }
        }
    } catch (error) {
        console.error('プラン分布データ取得エラー:', error);
    }
    
    // フォールバックデータ
    if (Object.keys(planData).length === 0) {
        planData = {
            'Free': 5,
            'Standard': 8,
            'Plus': 4,
            'Pro': 2,
            'Enterprise': 1
        };
    }
    
    // 既存のチャートがあれば破棄
    if (window.planChartInstance) {
        window.planChartInstance.destroy();
    }
    
    window.planChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(planData),
            datasets: [{
                data: Object.values(planData),
                backgroundColor: [
                    '#10b981', // Free - Green
                    '#3b82f6', // Standard - Blue
                    '#f59e0b', // Plus - Orange
                    '#8b5cf6', // Pro - Purple
                    '#ef4444'  // Enterprise - Red
                ],
                borderWidth: 3,
                borderColor: '#ffffff',
                hoverBorderWidth: 4,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 12
                        },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                            return data.labels.map((label, i) => {
                                const value = data.datasets[0].data[i];
                                const percentage = ((value / total) * 100).toFixed(1);
                                return {
                                    text: `${label}: ${value}件 (${percentage}%)`,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    strokeStyle: data.datasets[0].backgroundColor[i],
                                    lineWidth: 0,
                                    pointStyle: 'circle',
                                    index: i
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value}テナント (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%',
            radius: '90%'
        }
    });
}

// ユーザーアクティビティチャート描画
async function renderActivityChart() {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;
    
    // アクティビティデータを取得
    let activityData = [];
    
    try {
        const response = await fetch('/api/provider-dashboard/charts/user-activity');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.activityData) {
                activityData = data.data.activityData;
            }
        }
    } catch (error) {
        console.error('アクティビティデータ取得エラー:', error);
    }
    
    // フォールバックデータ
    if (activityData.length === 0) {
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            activityData.push({
                date: date.toISOString().split('T')[0],
                logins: Math.floor(Math.random() * 50) + 20
            });
        }
    }
    
    // チャートデータを準備
    const labels = activityData.map(d => {
        const date = new Date(d.date);
        return (date.getMonth() + 1) + '/' + date.getDate();
    });
    const loginCounts = activityData.map(d => d.logins);
    
    // 既存のチャートがあれば破棄
    if (window.activityChartInstance) {
        window.activityChartInstance.destroy();
    }
    
    window.activityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'ログイン数',
                data: loginCounts,
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                borderColor: '#22c55e',
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
                maxBarThickness: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#22c55e',
                    borderWidth: 1,
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            const date = activityData[index].date;
                            return new Date(date).toLocaleDateString('ja-JP');
                        },
                        label: function(context) {
                            return 'ログイン数: ' + context.parsed.y + '回';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        stepSize: 10
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// リアルタイム更新
function startRealTimeUpdates() {
    realTimeInterval = setInterval(() => {
        if (currentSection === 'overview' || currentSection === 'realtime-monitoring') {
            updateRealTimeData();
        }
    }, 30000); // 30秒間隔
}

function updateRealTimeData() {
    // リアルタイムデータ更新ロジック
    if (dashboardData.overview) {
        // わずかな変動をシミュレート
        dashboardData.overview.systemUptime = (99.95 + Math.random() * 0.05).toFixed(2);
        dashboardData.overview.activeUsers = dashboardData.overview.totalUsers - Math.floor(Math.random() * 1000);
    }
    
    // 現在表示中のセクションを再描画
    loadSectionData(currentSection);
}

// アラート表示関数
function showAlert(message, type = 'info') {
    const alertClass = `alert-${type}`;
    const iconClass = {
        'success': 'fa-check-circle',
        'warning': 'fa-exclamation-triangle',
        'error': 'fa-times-circle',
        'info': 'fa-info-circle'
    }[type] || 'fa-info-circle';
    
    const alertHtml = `
        <div class="alert-box ${alertClass} fixed top-4 right-4 z-50 max-w-md shadow-lg" id="tempAlert">
            <div class="flex items-center">
                <i class="fas ${iconClass} mr-3"></i>
                <span>${message}</span>
                <button onclick="document.getElementById('tempAlert').remove()" class="ml-auto text-lg">×</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    // 5秒後に自動削除
    setTimeout(() => {
        const alert = document.getElementById('tempAlert');
        if (alert) alert.remove();
    }, 5000);
}

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', function() {
    if (realTimeInterval) {
        clearInterval(realTimeInterval);
    }
});

// テナント管理セクション描画
async function renderTenantManagement() {
    let section = document.getElementById('tenant-management-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'tenant-management-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    
    // テナント一覧データを取得
    let tenantsData = null;
    try {
        const response = await fetch('/api/provider-dashboard/tenants');
        if (response.ok) {
            tenantsData = await response.json();
        }
    } catch (error) {
        console.error('テナントデータ取得エラー:', error);
    }
    
    section.innerHTML = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">テナント管理</h2>
                    <p class="text-gray-600">全テナントの管理・監視・プラン設定を行います</p>
                </div>
                <button onclick="openNewTenantModal()" class="btn-primary">
                    <i class="fas fa-plus mr-2"></i>新規テナント追加
                </button>
            </div>
            
            <!-- フィルター・検索 -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input type="text" id="tenant-search" placeholder="企業名・サブドメインで検索" class="filter-input">
                        <select id="plan-filter" class="filter-input">
                            <option value="">すべてのプラン</option>
                            <option value="free">Free</option>
                            <option value="standard">Standard</option>
                            <option value="plus">Plus</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                        <select id="status-filter" class="filter-input">
                            <option value="">すべてのステータス</option>
                            <option value="active">アクティブ</option>
                            <option value="trial">トライアル</option>
                            <option value="suspended">停止</option>
                            <option value="cancelled">キャンセル</option>
                        </select>
                        <button onclick="filterTenants()" class="btn-primary">
                            <i class="fas fa-search mr-2"></i>検索
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- テナント一覧テーブル -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">企業情報</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">プラン</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ユーザー数</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最終アクティビティ</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody id="tenants-table-body" class="bg-white divide-y divide-gray-200">
                            ${renderTenantsTable(tenantsData)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderTenantsTable(tenantsData) {
    if (!tenantsData?.success || !tenantsData.data.tenants.length) {
        return `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    <i class="fas fa-info-circle mr-2"></i>
                    テナントデータを読み込み中またはデータがありません
                </td>
            </tr>
        `;
    }
    
    return tenantsData.data.tenants.map(tenant => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <i class="fas fa-building text-blue-600"></i>
                        </div>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${tenant.name}</div>
                        <div class="text-sm text-gray-500">${tenant.subdomain}.core-first.com</div>
                        <div class="text-xs text-gray-400">${tenant.company_type || ''}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="plan-${tenant.plan_id} text-xs px-2 py-1 rounded-full">
                    ${tenant.plan_id?.toUpperCase() || 'UNKNOWN'}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${tenant.user_count || 0} 名</div>
                <div class="text-xs text-gray-500">アクティブ: ${tenant.active_user_count || 0}</div>
            </td>
            <td class="px-6 py-4">
                <span class="status-${tenant.status} text-xs px-2 py-1 rounded-full">
                    ${getStatusLabel(tenant.status)}
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                ${tenant.last_activity ? formatDate(tenant.last_activity) : '未記録'}
            </td>
            <td class="px-6 py-4 text-sm font-medium">
                <div class="flex space-x-2">
                    <button onclick="viewTenantDetails('${tenant.id}')" class="btn-secondary-sm">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="editTenant('${tenant.id}')" class="btn-secondary-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="manageTenantUsers('${tenant.id}')" class="btn-secondary-sm">
                        <i class="fas fa-users"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getStatusLabel(status) {
    const labels = {
        'active': 'アクティブ',
        'trial': 'トライアル',
        'suspended': '停止',
        'cancelled': 'キャンセル',
        'disabled': '無効'
    };
    return labels[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
}

// 横断ユーザー管理セクション描画
async function renderCrossTenantUsers() {
    let section = document.getElementById('cross-tenant-users-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'cross-tenant-users-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    
    // 横断ユーザーデータを取得
    let usersData = null;
    try {
        const response = await fetch('/api/provider-dashboard/cross-tenant-users');
        if (response.ok) {
            usersData = await response.json();
        }
    } catch (error) {
        console.error('横断ユーザーデータ取得エラー:', error);
    }
    
    section.innerHTML = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">横断ユーザー管理</h2>
                    <p class="text-gray-600">全テナントのユーザーを横断的に検索・管理します</p>
                </div>
            </div>
            
            <!-- 検索・フィルター -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input type="text" id="cross-user-search" placeholder="名前・メールアドレス・テナント名で検索" class="filter-input">
                        <select id="cross-user-status-filter" class="filter-input">
                            <option value="">すべてのステータス</option>
                            <option value="active">アクティブ</option>
                            <option value="disabled">無効</option>
                            <option value="frozen">凍結</option>
                        </select>
                        <select id="cross-user-role-filter" class="filter-input">
                            <option value="">すべての権限</option>
                            <option value="super_admin">スーパー管理者</option>
                            <option value="admin">管理者</option>
                            <option value="site_manager">サイト管理者</option>
                            <option value="user">一般ユーザー</option>
                        </select>
                        <button onclick="searchCrossTenantUsers()" class="btn-primary">
                            <i class="fas fa-search mr-2"></i>検索
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- ユーザー一覧テーブル -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ユーザー</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">テナント</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">権限</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最終ログイン</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody id="cross-users-table-body" class="bg-white divide-y divide-gray-200">
                            ${renderCrossUsersTable(usersData)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderCrossUsersTable(usersData) {
    if (!usersData?.success || !usersData.data.users.length) {
        return `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    <i class="fas fa-info-circle mr-2"></i>
                    ユーザーデータを読み込み中またはデータがありません
                </td>
            </tr>
        `;
    }
    
    return usersData.data.users.map(user => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <div class="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                            <i class="fas fa-user text-gray-600"></i>
                        </div>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${user.display_name}</div>
                        <div class="text-sm text-gray-500">${user.email}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${user.tenant_name}</div>
                <div class="text-xs text-gray-500">${user.subdomain}</div>
                <span class="plan-${user.plan_id} text-xs px-2 py-1 rounded-full">${user.plan_id?.toUpperCase() || 'N/A'}</span>
            </td>
            <td class="px-6 py-4">
                <span class="text-xs text-gray-600">${user.roles || '権限なし'}</span>
            </td>
            <td class="px-6 py-4">
                <span class="status-${user.status} text-xs px-2 py-1 rounded-full">
                    ${getStatusLabel(user.status)}
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                ${user.last_login_at ? formatDate(user.last_login_at) : '未ログイン'}
            </td>
            <td class="px-6 py-4 text-sm font-medium">
                <div class="flex space-x-2">
                    <button onclick="viewUserDetails('${user.id}')" class="btn-secondary-sm">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="editCrossUser('${user.id}')" class="btn-secondary-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="resetUserPassword('${user.id}')" class="btn-secondary-sm text-yellow-600">
                        <i class="fas fa-key"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// 横断ユーザー検索
async function searchCrossTenantUsers() {
    const searchQuery = document.getElementById('cross-user-search').value;
    const status = document.getElementById('cross-user-status-filter').value;
    const role = document.getElementById('cross-user-role-filter').value;
    
    try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('q', searchQuery);
        if (status) params.append('status', status);
        if (role) params.append('role', role);
        
        const response = await fetch(`/api/provider-dashboard/cross-tenant-users?${params}`);
        if (response.ok) {
            const usersData = await response.json();
            document.getElementById('cross-users-table-body').innerHTML = renderCrossUsersTable(usersData);
        }
    } catch (error) {
        console.error('ユーザー検索エラー:', error);
        showAlert('ユーザー検索に失敗しました', 'error');
    }
}

function renderUsageAnalytics() {
    let section = document.getElementById('usage-analytics-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'usage-analytics-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    section.innerHTML = `<div class="p-6"><h2 class="text-2xl font-bold mb-4">利用分析</h2><p class="text-gray-600">テナント別利用状況の分析機能を実装中...</p></div>`;
}

function renderRevenueDashboard() {
    let section = document.getElementById('revenue-dashboard-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'revenue-dashboard-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    section.innerHTML = `<div class="p-6"><h2 class="text-2xl font-bold mb-4">売上ダッシュボード</h2><p class="text-gray-600">売上分析・予測機能を実装中...</p></div>`;
}

function renderBillingManagement() {
    let section = document.getElementById('billing-management-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'billing-management-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    section.innerHTML = `<div class="p-6"><h2 class="text-2xl font-bold mb-4">請求管理</h2><p class="text-gray-600">一括請求書発行・支払い管理機能を実装中...</p></div>`;
}

function renderSubscriptionManagement() {
    let section = document.getElementById('subscription-management-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'subscription-management-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    section.innerHTML = `<div class="p-6"><h2 class="text-2xl font-bold mb-4">サブスクリプション管理</h2><p class="text-gray-600">プラン変更・キャンセル管理機能を実装中...</p></div>`;
}

// サポートチケット管理セクション描画
async function renderSupportTickets() {
    let section = document.getElementById('support-tickets-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'support-tickets-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    
    // サポートチケットデータを取得
    let ticketsData = null;
    try {
        const response = await fetch('/api/provider-dashboard/support-tickets');
        if (response.ok) {
            ticketsData = await response.json();
        }
    } catch (error) {
        console.error('サポートチケットデータ取得エラー:', error);
    }
    
    const summary = ticketsData?.success ? ticketsData.data.summary : { total: 0, open: 0, inProgress: 0, resolved: 0 };
    
    section.innerHTML = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">サポートチケット管理</h2>
                    <p class="text-gray-600">顧客からの問い合わせとサポート対応を管理します</p>
                </div>
                <button onclick="createTicket()" class="btn-primary">
                    <i class="fas fa-plus mr-2"></i>新規チケット作成
                </button>
            </div>
            
            <!-- サポート統計 -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <i class="fas fa-ticket-alt text-2xl text-blue-600 mr-3"></i>
                            <h3 class="text-lg font-semibold text-gray-900">総チケット数</h3>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-blue-600">${summary.total}</div>
                </div>
                
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <i class="fas fa-clock text-2xl text-red-600 mr-3"></i>
                            <h3 class="text-lg font-semibold text-gray-900">未対応</h3>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-red-600">${summary.open}</div>
                </div>
                
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <i class="fas fa-spinner text-2xl text-orange-600 mr-3"></i>
                            <h3 class="text-lg font-semibold text-gray-900">対応中</h3>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-orange-600">${summary.inProgress}</div>
                </div>
                
                <div class="kpi-card">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <i class="fas fa-check-circle text-2xl text-green-600 mr-3"></i>
                            <h3 class="text-lg font-semibold text-gray-900">解決済み</h3>
                        </div>
                    </div>
                    <div class="text-3xl font-bold text-green-600">${summary.resolved}</div>
                </div>
            </div>
            
            <!-- チケット一覧 -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="p-4 border-b border-gray-200">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-semibold text-gray-900">チケット一覧</h3>
                        <div class="flex space-x-2">
                            <select class="filter-input">
                                <option value="">すべてのステータス</option>
                                <option value="open">未対応</option>
                                <option value="in_progress">対応中</option>
                                <option value="resolved">解決済み</option>
                            </select>
                            <select class="filter-input">
                                <option value="">すべての優先度</option>
                                <option value="urgent">緊急</option>
                                <option value="high">高</option>
                                <option value="medium">中</option>
                                <option value="low">低</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">チケット</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">テナント</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">優先度</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">作成日</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody id="tickets-table-body" class="bg-white divide-y divide-gray-200">
                            ${renderTicketsTable(ticketsData)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderTicketsTable(ticketsData) {
    if (!ticketsData?.success || !ticketsData.data.tickets.length) {
        return `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    <i class="fas fa-info-circle mr-2"></i>
                    サポートチケットがありません
                </td>
            </tr>
        `;
    }
    
    return ticketsData.data.tickets.map(ticket => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4">
                <div>
                    <div class="text-sm font-medium text-gray-900">${ticket.title}</div>
                    <div class="text-sm text-gray-500">${ticket.description}</div>
                    <div class="text-xs text-gray-400">ID: ${ticket.id}</div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${ticket.tenantName}</div>
                <div class="text-xs text-gray-500">${ticket.requesterEmail}</div>
            </td>
            <td class="px-6 py-4">
                <span class="priority-${ticket.priority} text-xs px-2 py-1 rounded-full">
                    ${getPriorityLabel(ticket.priority)}
                </span>
            </td>
            <td class="px-6 py-4">
                <span class="status-${ticket.status} text-xs px-2 py-1 rounded-full">
                    ${getTicketStatusLabel(ticket.status)}
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                ${formatDate(ticket.createdAt)}
            </td>
            <td class="px-6 py-4 text-sm font-medium">
                <div class="flex space-x-2">
                    <button onclick="viewTicket('${ticket.id}')" class="btn-secondary-sm">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="editTicket('${ticket.id}')" class="btn-secondary-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="assignTicket('${ticket.id}')" class="btn-secondary-sm">
                        <i class="fas fa-user"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getPriorityLabel(priority) {
    const labels = {
        'urgent': '緊急',
        'high': '高',
        'medium': '中',
        'low': '低'
    };
    return labels[priority] || priority;
}

function getTicketStatusLabel(status) {
    const labels = {
        'open': '未対応',
        'in_progress': '対応中',
        'resolved': '解決済み',
        'closed': '完了'
    };
    return labels[status] || status;
}

function renderCustomerSuccess() {
    let section = document.getElementById('customer-success-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'customer-success-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    section.innerHTML = `<div class="p-6"><h2 class="text-2xl font-bold mb-4">カスタマーサクセス</h2><p class="text-gray-600">テナント健全性・チャーン予測機能を実装中...</p></div>`;
}

function renderSystemMonitoring() {
    console.log('renderSystemMonitoring called');
    
    // HTMLにすでにセクションが存在する場合はそれを使用
    let section = document.getElementById('system-monitoring-section');
    if (section) {
        console.log('Using existing system-monitoring-section from HTML');
        
        // loadSystemMonitoring関数の存在を確認し、利用可能になるまで待機
        const tryLoadMonitoring = (retries = 0) => {
            console.log(`Attempt ${retries + 1}: Checking window.loadSystemMonitoring...`);
            
            if (typeof window.loadSystemMonitoring === 'function') {
                console.log('✅ window.loadSystemMonitoring found! Calling it now...');
                window.loadSystemMonitoring();
                
                // 自動更新を開始
                if (typeof window.startMonitoringAutoRefresh === 'function') {
                    console.log('✅ window.startMonitoringAutoRefresh found! Calling it now...');
                    window.startMonitoringAutoRefresh();
                }
            } else if (retries < 10) {
                // 最大10回、100ms間隔で再試行
                console.log(`⏳ window.loadSystemMonitoring not ready yet. Retrying in 100ms... (${retries + 1}/10)`);
                setTimeout(() => tryLoadMonitoring(retries + 1), 100);
            } else {
                console.error('❌ window.loadSystemMonitoring is still not available after 10 retries!');
                console.log('Available window functions:', Object.keys(window).filter(k => k.toLowerCase().includes('system') || k.toLowerCase().includes('monitoring') || k.toLowerCase().includes('load')));
            }
        };
        
        // 初回試行
        tryLoadMonitoring();
        return;
    }
    
    // セクションが存在しない場合はエラーログ
    console.error('system-monitoring-section not found in HTML');
}

function renderBillingManagement() {
    console.log('renderBillingManagement called');
    
    // HTMLにすでにセクションが存在する場合はそれを使用
    let section = document.getElementById('billing-management-section');
    if (section) {
        console.log('Using existing billing-management-section from HTML');
        
        // loadBillingManagement関数の存在を確認し、利用可能になるまで待機
        const tryLoadBilling = (retries = 0) => {
            console.log(`Attempt ${retries + 1}: Checking window.loadBillingManagement...`);
            
            if (typeof window.loadBillingManagement === 'function') {
                console.log('✅ window.loadBillingManagement found! Calling it now...');
                window.loadBillingManagement();
            } else if (retries < 10) {
                // 最大10回、100ms間隔で再試行
                console.log(`⏳ window.loadBillingManagement not ready yet. Retrying in 100ms... (${retries + 1}/10)`);
                setTimeout(() => tryLoadBilling(retries + 1), 100);
            } else {
                console.error('❌ window.loadBillingManagement is still not available after 10 retries!');
                console.log('Available window functions:', Object.keys(window).filter(k => k.toLowerCase().includes('billing') || k.toLowerCase().includes('invoice')));
            }
        };
        
        // 初回試行
        tryLoadBilling();
        return;
    }
    
    // セクションが存在しない場合はエラーログ
    console.error('billing-management-section not found in HTML');
}

function renderAuditLogs() {
    let section = document.getElementById('audit-logs-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'audit-logs-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    section.innerHTML = `<div class="p-6"><h2 class="text-2xl font-bold mb-4">監査ログ</h2><p class="text-gray-600">セキュリティ・コンプライアンス監査機能を実装中...</p></div>`;
}

function renderBackupManagement() {
    let section = document.getElementById('backup-management-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'backup-management-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    section.innerHTML = `<div class="p-6"><h2 class="text-2xl font-bold mb-4">バックアップ管理</h2><p class="text-gray-600">データ保護・復旧管理機能を実装中...</p></div>`;
}

function renderAdminUsers() {
    let section = document.getElementById('admin-users-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'admin-users-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    section.innerHTML = `<div class="p-6"><h2 class="text-2xl font-bold mb-4">管理者管理</h2><p class="text-gray-600">提供者側管理者アカウント管理機能を実装中...</p></div>`;
}

function renderRolePermissions() {
    let section = document.getElementById('role-permissions-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'role-permissions-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    section.innerHTML = `<div class="p-6"><h2 class="text-2xl font-bold mb-4">権限管理</h2><p class="text-gray-600">ロール・アクセス制御管理機能を実装中...</p></div>`;
}

// プロフィール設定画面描画
function renderProfile() {
    let section = document.getElementById('profile-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'profile-section';
        section.className = 'content-section';
        document.querySelector('main').appendChild(section);
    }
    section.innerHTML = `
        <div class="p-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">
                <i class="fas fa-user-edit mr-3 text-blue-600"></i>
                プロフィール設定
            </h2>
            
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div class="alert-box alert-info mb-6">
                    <div class="flex items-center">
                        <i class="fas fa-info-circle mr-3"></i>
                        <div>
                            <h4 class="font-semibold">管理者プロフィール管理</h4>
                            <p class="text-sm">サービス提供者側の管理者アカウント設定を管理できます。</p>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-4">基本情報</h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">表示名</label>
                                <input type="text" value="システム統合管理者" class="filter-input w-full">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">メールアドレス</label>
                                <input type="email" value="system@corefirst.com" class="filter-input w-full" readonly>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">ロール</label>
                                <div class="role-super-admin text-sm px-3 py-1 rounded-full inline-block">スーパー管理者</div>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-4">セキュリティ設定</h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">パスワード変更</label>
                                <button class="btn-secondary">パスワードを変更</button>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">二要素認証</label>
                                <button class="btn-primary">有効化</button>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">アクセスログ</label>
                                <button class="btn-secondary">ログを確認</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                    <button class="btn-secondary">キャンセル</button>
                    <button class="btn-primary">設定を保存</button>
                </div>
            </div>
        </div>
    `;
}

// ユーザーメニューのドロップダウン機能
function toggleUserMenu() {
    const userMenu = document.getElementById('user-menu');
    if (userMenu) {
        if (userMenu.classList.contains('hidden')) {
            userMenu.classList.remove('hidden');
            console.log('User menu opened');
        } else {
            userMenu.classList.add('hidden');
            console.log('User menu closed');
        }
    } else {
        console.log('User menu element not found');
    }
}

function setupUserMenuDropdown() {
    // ユーザーメニューボタンにイベントリスナーを追加
    const userMenuButton = document.getElementById('user-menu-button');
    if (userMenuButton) {
        userMenuButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleUserMenu();
        });
        console.log('User menu button event listener added');
    } else {
        console.log('User menu button not found');
    }
    
    // ドキュメント全体のクリックでメニューを閉じる
    document.addEventListener('click', function(e) {
        const userMenu = document.getElementById('user-menu');
        const userMenuButton = document.getElementById('user-menu-button');
        
        if (userMenu && userMenuButton && 
            !userMenu.contains(e.target) && 
            !userMenuButton.contains(e.target)) {
            userMenu.classList.add('hidden');
        }
    });
    
    console.log('User menu dropdown setup completed');
}

// サイドバー折りたたみ機能
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarLogo = document.getElementById('sidebar-logo');
    const sidebarLogoCollapsed = document.getElementById('sidebar-logo-collapsed');
    
    if (sidebar) {
        if (sidebar.classList.contains('collapsed')) {
            // 展開する
            sidebar.classList.remove('collapsed');
            if (sidebarLogo) {
                sidebarLogo.classList.remove('hidden');
            }
            if (sidebarLogoCollapsed) {
                sidebarLogoCollapsed.classList.add('hidden');
            }
            console.log('Sidebar expanded');
        } else {
            // 折りたたむ
            sidebar.classList.add('collapsed');
            if (sidebarLogo) {
                sidebarLogo.classList.add('hidden');
            }
            if (sidebarLogoCollapsed) {
                sidebarLogoCollapsed.classList.remove('hidden');
            }
            console.log('Sidebar collapsed');
        }
    }
}

// ========================================
// グローバル関数（HTMLのonclick属性から呼び出し可能）
// ========================================

// ログアウト関数
window.logout = async function() {
    console.log('logout function called');
    if (confirm('ログアウトしますか？')) {
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
};

// ユーザーメニュー切り替え
window.toggleUserMenu = function() {
    console.log('toggleUserMenu function called');
    const menu = document.getElementById('user-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
};

// ナビゲーション関数
window.navigateTo = function(path) {
    console.log('navigateTo function called with:', path);
    window.location.href = path;
};

// セクション表示関数をグローバルにエクスポート
window.showSection = showSection;
// ========================================
// 請求管理機能
// ========================================

// 請求管理データの状態管理
let currentBillingPage = 1;
const itemsPerPage = 10;
let allInvoices = [];
let filteredInvoices = [];

// ダミー請求書データ生成
window.generateDummyInvoices = function() {
    console.log('🔵 generateDummyInvoices() called');
    const tenants = [
        { id: 'tenant_abc', name: 'ABC物流株式会社', plan: 'Standard' },
        { id: 'tenant_xyz', name: 'XYZ配送サービス', plan: 'Plus' },
        { id: 'tenant_demo', name: 'デモ物流企業', plan: 'Pro' }
    ];
    
    const statuses = ['paid', 'pending', 'overdue', 'failed'];
    const invoices = [];
    const now = new Date();
    
    for (let i = 0; i < 50; i++) {
        const tenant = tenants[Math.floor(Math.random() * tenants.length)];
        const monthOffset = Math.floor(Math.random() * 12);
        const invoiceDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        const planPrices = { 'Standard': 50000, 'Plus': 150000, 'Pro': 300000 };
        const amount = planPrices[tenant.plan] || 50000;
        const tax = Math.round(amount * 0.1);
        
        invoices.push({
            id: `INV-2024${String(i + 1).padStart(4, '0')}`,
            tenantName: tenant.name,
            plan: tenant.plan,
            invoiceDate: invoiceDate,
            dueDate: new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000),
            amount: amount,
            tax: tax,
            total: amount + tax,
            status: status
        });
    }
    
    return invoices.sort((a, b) => b.invoiceDate - a.invoiceDate);
};

// 請求管理データ読み込み
window.loadBillingManagement = function() {
    console.log('🔵 loadBillingManagement() が呼ばれました');
    
    allInvoices = window.generateDummyInvoices();
    filteredInvoices = [...allInvoices];
    
    window.updateBillingKPIs();
    window.updateRevenueChart();
    window.updateInvoicesTable();
};

// KPI更新
window.updateBillingKPIs = function() {
    console.log('🔵 updateBillingKPIs() 開始');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // 当月の請求書
    const currentMonthInvoices = allInvoices.filter(inv => 
        inv.invoiceDate.getMonth() === currentMonth && inv.invoiceDate.getFullYear() === currentYear
    );
    
    // 先月の請求書（成長率計算用）
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const lastMonthInvoices = allInvoices.filter(inv => 
        inv.invoiceDate.getMonth() === lastMonth && inv.invoiceDate.getFullYear() === lastMonthYear
    );
    
    // 月間売上
    const monthlyRevenue = currentMonthInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const lastMonthRevenue = lastMonthInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const growth = lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1) : 0;
    
    const revenueElem = document.getElementById('monthly-revenue');
    const growthElem = document.getElementById('monthly-revenue-growth');
    if (revenueElem) revenueElem.textContent = '¥' + monthlyRevenue.toLocaleString();
    if (growthElem) growthElem.textContent = growth;
    
    // MRR（月次経常収益）- 全アクティブテナントの当月分
    const mrr = currentMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const mrrElem = document.getElementById('mrr');
    if (mrrElem) {
        mrrElem.textContent = '¥' + mrr.toLocaleString();
        console.log('✅ MRRを更新しました:', mrr);
    }
    
    // 未収金額（支払い待ち・期限超過・失敗の合計）
    const outstanding = allInvoices.filter(inv => inv.status !== 'paid');
    const outstandingAmount = outstanding.reduce((sum, inv) => sum + inv.total, 0);
    const outstandingAmountElem = document.getElementById('outstanding-amount');
    const outstandingCountElem = document.getElementById('outstanding-count');
    if (outstandingAmountElem) {
        outstandingAmountElem.textContent = '¥' + outstandingAmount.toLocaleString();
        console.log('✅ 未収金額を更新しました:', outstandingAmount);
    }
    if (outstandingCountElem) {
        outstandingCountElem.textContent = outstanding.length;
    }
    
    // 支払い完了率（当月の支払い済み / 当月の全請求書）
    const paidCount = currentMonthInvoices.filter(inv => inv.status === 'paid').length;
    const paymentRate = currentMonthInvoices.length > 0 
        ? (paidCount / currentMonthInvoices.length * 100).toFixed(1) 
        : 0;
    const paymentRateElem = document.getElementById('payment-rate');
    if (paymentRateElem) {
        paymentRateElem.textContent = paymentRate + '%';
        console.log('✅ 支払い完了率を更新しました:', paymentRate + '%');
    }
    
    console.log('✅ updateBillingKPIs() 完了');
};

// グラフ更新（最適化版）
window.updateRevenueChart = function() {
    console.log('🔵 updateRevenueChart() 開始');
    const canvas = document.getElementById('revenue-chart');
    if (!canvas) {
        console.error('❌ revenue-chart要素が見つかりません');
        return;
    }
    
    // 既存のグラフがあれば破棄
    if (window.revenueChartInstance) {
        window.revenueChartInstance.destroy();
    }
    
    // 実際のデータから月別売上を計算
    const now = new Date();
    const monthlyData = [];
    const monthLabels = [];
    
    for (let i = 11; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthInvoices = allInvoices.filter(inv => 
            inv.invoiceDate.getFullYear() === month.getFullYear() &&
            inv.invoiceDate.getMonth() === month.getMonth()
        );
        
        const monthTotal = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);
        monthlyData.push(monthTotal);
        monthLabels.push(`${month.getMonth() + 1}月`);
    }
    
    // データの最大値を取得してY軸の範囲を設定
    const maxValue = Math.max(...monthlyData);
    const suggestedMax = Math.ceil(maxValue * 1.2 / 100000) * 100000; // 20%余裕を持たせて10万円単位で切り上げ
    
    window.revenueChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [{
                label: '売上（円）',
                data: monthlyData,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgb(59, 130, 246)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 12 },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '売上: ¥' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: suggestedMax,
                    ticks: {
                        callback: function(value) {
                            return '¥' + (value / 10000).toFixed(0) + '万';
                        },
                        stepSize: suggestedMax / 5, // 5段階に分割
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: { size: 11 }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    console.log('✅ グラフを作成しました（データポイント数:', monthlyData.length, '）');
};

// テーブル更新
window.updateInvoicesTable = function() {
    console.log('🔵 updateInvoicesTable() 開始');
    const tbody = document.getElementById('invoices-table-body');
    if (!tbody) {
        console.error('❌ invoices-table-body要素が見つかりません');
        return;
    }
    
    const pageData = filteredInvoices.slice(0, 10);
    tbody.innerHTML = pageData.map(inv => `
        <tr><td class="px-6 py-4">${inv.id}</td>
        <td class="px-6 py-4">${inv.tenantName}</td>
        <td class="px-6 py-4">¥${inv.total.toLocaleString()}</td></tr>
    `).join('');
    console.log('✅ テーブルを更新しました、${pageData.length}件');
};

console.log('✅ Billing management functions loaded in external JS file');

// ========================================
// システム監視機能
// ========================================

// 自動更新用のインターバルID
let monitoringInterval = null;

// システム監視データ読み込み（メイン関数）
window.loadSystemMonitoring = async function() {
    console.log('🔵 loadSystemMonitoring() が呼ばれました');
    
    // 即座にダミーデータを表示（API呼び出しを待たない）
    console.log('🔵 即座にダミーデータを表示します');
    window.useDummyMonitoringData();
    
    // 最終更新時刻を表示
    const updateTimeEl = document.getElementById('monitoring-last-update');
    if (updateTimeEl) {
        const now = new Date();
        updateTimeEl.textContent = now.toLocaleString('ja-JP');
        console.log('✅ 最終更新時刻を設定しました:', now.toLocaleString('ja-JP'));
    } else {
        console.error('❌ monitoring-last-update 要素が見つかりません');
    }
    
    // バックグラウンドで実データの取得を試みる（オプション）
    try {
        console.log('🔵 バックグラウンドでAPI呼び出しを試みます...');
        const healthResponse = await fetch('/api/admin/system-monitoring/health');
        
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            
            if (healthData.success) {
                console.log('✅ 実データを取得しました。表示を更新します。');
                
                const alertsResponse = await fetch('/api/admin/system-monitoring/alerts/active');
                const alertsData = await alertsResponse.json();
                
                window.updateHealthCards(healthData);
                window.updateAlerts(alertsData);
                await window.updateCharts();
            }
        } else {
            console.log('ℹ️ API呼び出しが失敗しました（ダミーデータを使用中）');
        }
    } catch (error) {
        console.log('ℹ️ API呼び出し中にエラーが発生しました（ダミーデータを使用中）:', error.message);
    }
};

// ダミーデータを使用してシステム監視を表示
window.useDummyMonitoringData = function() {
    console.log('🔵 useDummyMonitoringData() が呼ばれました');
    
    // ダミーヘルスデータ
    const dummyHealthData = {
        success: true,
        overall_status: 'healthy',
        services: {
            api: { status: 'healthy', response_time: 45 },
            database: { status: 'healthy', response_time: 12 },
            worker: { status: 'healthy', response_time: 23 },
            storage: { status: 'healthy', response_time: 18 },
            overall: { status: 'healthy', uptime: 99.97 }
        },
        last_check: new Date().toISOString()
    };
    
    // ダミーアラートデータ
    const dummyAlertsData = {
        success: true,
        alerts: [
            {
                id: 'alert-1',
                severity: 'warning',
                service_name: 'database',
                message: 'クエリ応答時間が平均より15%高くなっています',
                status: 'active',
                created_at: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 'alert-2',
                severity: 'info',
                service_name: 'storage',
                message: 'ストレージ使用率が70%に達しました',
                status: 'active',
                created_at: new Date(Date.now() - 7200000).toISOString()
            }
        ],
        summary: { total: 2, critical: 0, warning: 1, info: 1 }
    };
    
    console.log('🔵 ダミーデータを適用します...');
    console.log('ヘルスデータ:', dummyHealthData);
    console.log('アラートデータ:', dummyAlertsData);
    
    window.updateHealthCards(dummyHealthData);
    window.updateAlerts(dummyAlertsData);
    window.updateChartsWithDummyData();
};

// ダミーデータでチャートを更新
window.updateChartsWithDummyData = function() {
    console.log('🔵 updateChartsWithDummyData() が呼ばれました');
    const now = Date.now();
    const hours = 12;
    const interval = 5 * 60 * 1000; // 5分間隔
    const points = Math.floor(hours * 60 / 5);
    
    // CPU使用率のダミーデータ
    const cpuData = [];
    for (let i = 0; i < points; i++) {
        cpuData.push({
            value: 30 + Math.random() * 40 + Math.sin(i / 10) * 15,
            recorded_at: new Date(now - (points - i) * interval).toISOString()
        });
    }
    
    // メモリ使用率のダミーデータ
    const memoryData = [];
    for (let i = 0; i < points; i++) {
        memoryData.push({
            value: 50 + Math.random() * 30 + Math.cos(i / 8) * 10,
            recorded_at: new Date(now - (points - i) * interval).toISOString()
        });
    }
    
    // 応答時間のダミーデータ
    const responseTimeData = [];
    for (let i = 0; i < points; i++) {
        responseTimeData.push({
            value: 20 + Math.random() * 80 + Math.sin(i / 12) * 30,
            recorded_at: new Date(now - (points - i) * interval).toISOString()
        });
    }
    
    // エラー率のダミーデータ
    const errorRateData = [];
    for (let i = 0; i < points; i++) {
        errorRateData.push({
            value: Math.random() * 2 + Math.abs(Math.sin(i / 15)) * 1.5,
            recorded_at: new Date(now - (points - i) * interval).toISOString()
        });
    }
    
    console.log('🔵 チャートデータを生成しました。ポイント数:', cpuData.length);
    
    window.updateLineChart('cpu-chart', cpuData, 'CPU使用率 (%)', 'rgb(59, 130, 246)');
    window.updateLineChart('memory-chart', memoryData, 'メモリ使用率 (%)', 'rgb(34, 197, 94)');
    window.updateLineChart('response-time-chart', responseTimeData, '応答時間 (ms)', 'rgb(168, 85, 247)');
    window.updateLineChart('error-rate-chart', errorRateData, 'エラー率 (%)', 'rgb(239, 68, 68)');
};

// ヘルスカード更新
window.updateHealthCards = function(healthData) {
    console.log('🔵 updateHealthCards() が呼ばれました');
    console.log('healthData:', healthData);
    
    if (!healthData.success) {
        console.warn('⚠️ healthData.success が false です');
        return;
    }
    
    const services = ['api', 'database', 'worker', 'storage', 'overall'];
    services.forEach(service => {
        const card = document.getElementById('health-' + service);
        console.log('カード要素 (health-' + service + '):', card ? '✅ 存在' : '❌ 見つかりません');
        if (!card) return;
        
        const serviceData = healthData.services[service];
        const statusIcon = card.querySelector('.health-status i');
        const valueEl = card.querySelector('.text-2xl');
        const responseTimeEl = card.querySelector('.response-time');
        const uptimeEl = card.querySelector('.uptime');
        
        console.log('  - statusIcon:', statusIcon ? '✅' : '❌');
        console.log('  - valueEl:', valueEl ? '✅' : '❌');
        console.log('  - responseTimeEl:', responseTimeEl ? '✅' : '❌');
        console.log('  - uptimeEl:', uptimeEl ? '✅' : '❌');
        console.log('  - serviceData:', serviceData);
        
        if (serviceData) {
            // ステータスアイコンの色を更新
            statusIcon.className = 'fas fa-circle';
            if (serviceData.status === 'healthy') {
                statusIcon.classList.add('text-green-500');
                valueEl.textContent = '正常';
                valueEl.className = 'text-2xl font-bold text-green-600';
            } else if (serviceData.status === 'degraded') {
                statusIcon.classList.add('text-yellow-500');
                valueEl.textContent = '低下';
                valueEl.className = 'text-2xl font-bold text-yellow-600';
            } else {
                statusIcon.classList.add('text-red-500');
                valueEl.textContent = '停止';
                valueEl.className = 'text-2xl font-bold text-red-600';
            }
            
            // 応答時間または稼働率を表示
            if (responseTimeEl && serviceData.response_time) {
                responseTimeEl.textContent = serviceData.response_time;
            }
            if (uptimeEl && serviceData.uptime) {
                uptimeEl.textContent = serviceData.uptime.toFixed(2);
            }
        }
    });
};

// アラート更新
window.updateAlerts = function(alertsData) {
    console.log('🔵 updateAlerts() が呼ばれました');
    console.log('alertsData:', alertsData);
    
    if (!alertsData.success) {
        console.warn('⚠️ alertsData.success が false です');
        return;
    }
    
    // アラート数を更新
    const criticalEl = document.getElementById('alert-critical-count');
    const warningEl = document.getElementById('alert-warning-count');
    const infoEl = document.getElementById('alert-info-count');
    
    console.log('アラート数要素:', {
        critical: criticalEl ? '✅' : '❌',
        warning: warningEl ? '✅' : '❌',
        info: infoEl ? '✅' : '❌'
    });
    
    if (criticalEl) criticalEl.textContent = alertsData.summary.critical;
    if (warningEl) warningEl.textContent = alertsData.summary.warning;
    if (infoEl) infoEl.textContent = alertsData.summary.info;
    
    // アラート一覧を表示
    const container = document.getElementById('alerts-container');
    console.log('アラートコンテナ:', container ? '✅ 存在' : '❌ 見つかりません');
    
    if (!container) {
        console.error('❌ alerts-container が見つかりません');
        return;
    }
    
    if (alertsData.alerts.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">アクティブなアラートはありません</p>';
        return;
    }
    
    container.innerHTML = alertsData.alerts.map(alert => {
        let severityClass, severityIcon;
        if (alert.severity === 'critical') {
            severityClass = 'bg-red-50 border-red-200 text-red-800';
            severityIcon = 'fa-exclamation-circle text-red-600';
        } else if (alert.severity === 'warning') {
            severityClass = 'bg-yellow-50 border-yellow-200 text-yellow-800';
            severityIcon = 'fa-exclamation-triangle text-yellow-600';
        } else {
            severityClass = 'bg-blue-50 border-blue-200 text-blue-800';
            severityIcon = 'fa-info-circle text-blue-600';
        }
        
        return '<div class="flex items-center justify-between p-4 border rounded-lg ' + severityClass + '">' +
            '<div class="flex items-center space-x-3">' +
                '<i class="fas ' + severityIcon + '"></i>' +
                '<div>' +
                    '<p class="font-medium">' + alert.service_name + ': ' + alert.message + '</p>' +
                    '<p class="text-xs mt-1">' + new Date(alert.created_at).toLocaleString('ja-JP') + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="flex space-x-2">' +
                (alert.status === 'active' ? 
                    '<button onclick="acknowledgeAlert(\'' + alert.id + '\')" ' +
                            'class="px-3 py-1 text-xs bg-white border border-current rounded hover:bg-opacity-50">' +
                        '確認' +
                    '</button>' +
                    '<button onclick="resolveAlert(\'' + alert.id + '\')" ' +
                            'class="px-3 py-1 text-xs bg-white border border-current rounded hover:bg-opacity-50">' +
                        '解決' +
                    '</button>'
                : '') +
            '</div>' +
        '</div>';
    }).join('');
};

// アラート確認
window.acknowledgeAlert = async function(alertId) {
    try {
        const response = await fetch('/api/admin/system-monitoring/alerts/' + alertId + '/acknowledge', {
            method: 'POST'
        });
        if (response.ok) {
            await window.loadSystemMonitoring();
        }
    } catch (error) {
        console.error('アラート確認エラー:', error);
    }
};

// アラート解決
window.resolveAlert = async function(alertId) {
    try {
        const response = await fetch('/api/admin/system-monitoring/alerts/' + alertId + '/resolve', {
            method: 'POST'
        });
        if (response.ok) {
            await window.loadSystemMonitoring();
        }
    } catch (error) {
        console.error('アラート解決エラー:', error);
    }
};

// チャート更新（実データ取得）
window.updateCharts = async function() {
    try {
        // CPU使用率
        const cpuResponse = await fetch('/api/admin/system-monitoring/metrics/timeseries?metric_type=cpu&service_name=overall&hours=1');
        const cpuData = await cpuResponse.json();
        window.updateLineChart('cpu-chart', cpuData.data, 'CPU使用率 (%)', 'rgb(59, 130, 246)');
        
        // メモリ使用率
        const memoryResponse = await fetch('/api/admin/system-monitoring/metrics/timeseries?metric_type=memory&service_name=overall&hours=1');
        const memoryData = await memoryResponse.json();
        window.updateLineChart('memory-chart', memoryData.data, 'メモリ使用率 (%)', 'rgb(34, 197, 94)');
        
        // 応答時間
        const responseTimeResponse = await fetch('/api/admin/system-monitoring/metrics/timeseries?metric_type=response_time&service_name=api&hours=1');
        const responseTimeData = await responseTimeResponse.json();
        window.updateLineChart('response-time-chart', responseTimeData.data, '応答時間 (ms)', 'rgb(168, 85, 247)');
        
        // エラー率
        const errorRateResponse = await fetch('/api/admin/system-monitoring/metrics/timeseries?metric_type=error_rate&service_name=overall&hours=1');
        const errorRateData = await errorRateResponse.json();
        window.updateLineChart('error-rate-chart', errorRateData.data, 'エラー率 (%)', 'rgb(239, 68, 68)');
        
    } catch (error) {
        console.error('チャート更新エラー:', error);
        // エラー時はダミーデータにフォールバック
        console.log('ℹ️ ダミーチャートデータにフォールバックします');
        window.updateChartsWithDummyData();
    }
};

// 折れ線グラフ更新（最適化版）
window.updateLineChart = function(canvasId, data, label, color) {
    console.log('🔵 updateLineChart() が呼ばれました:', canvasId);
    const ctx = document.getElementById(canvasId);
    console.log('Canvas要素 (' + canvasId + '):', ctx ? '✅ 存在' : '❌ 見つかりません');
    
    if (!ctx) {
        console.error('❌ Canvas要素が見つかりません:', canvasId);
        return;
    }
    
    console.log('データポイント数:', data.length);
    
    // データの値を取得
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    
    // Y軸の範囲を計算（データに基づいて適切な範囲を設定）
    let suggestedMin, suggestedMax, stepSize;
    
    if (label.includes('CPU') || label.includes('メモリ') || label.includes('エラー')) {
        // パーセンテージ系は0-100の範囲
        suggestedMin = 0;
        suggestedMax = 100;
        stepSize = 20; // 0, 20, 40, 60, 80, 100
    } else if (label.includes('応答時間')) {
        // 応答時間はmsで、データに基づいて範囲を決定
        suggestedMin = 0;
        suggestedMax = Math.ceil(maxValue * 1.2 / 50) * 50; // 50ms単位で切り上げ、20%余裕
        stepSize = suggestedMax / 5;
    } else {
        // その他のメトリクスは自動計算
        const range = maxValue - minValue;
        suggestedMin = Math.max(0, minValue - range * 0.1);
        suggestedMax = maxValue + range * 0.1;
        stepSize = (suggestedMax - suggestedMin) / 5;
    }
    
    const chartData = {
        labels: data.map(d => new Date(d.recorded_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })),
        datasets: [{
            label: label,
            data: values,
            borderColor: color,
            backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 2,
            pointHoverRadius: 4,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 1
        }]
    };
    
    // 既存のチャートを破棄
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }
    
    // 新しいチャートを作成
    new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let labelText = context.dataset.label + ': ' + context.parsed.y.toFixed(1);
                            if (label.includes('応答時間')) {
                                labelText += ' ms';
                            } else if (label.includes('CPU') || label.includes('メモリ') || label.includes('エラー')) {
                                labelText += ' %';
                            }
                            return labelText;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMin: suggestedMin,
                    suggestedMax: suggestedMax,
                    ticks: {
                        stepSize: stepSize,
                        font: { size: 11 },
                        callback: function(value) {
                            if (label.includes('応答時間')) {
                                return value.toFixed(0) + ' ms';
                            } else if (label.includes('CPU') || label.includes('メモリ') || label.includes('エラー')) {
                                return value.toFixed(0) + '%';
                            }
                            return value.toFixed(1);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: { size: 10 },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    },
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    console.log('✅ グラフを作成しました:', canvasId, '（範囲: ' + suggestedMin.toFixed(0) + ' - ' + suggestedMax.toFixed(0) + '）');
};

// 30秒間隔の自動更新を開始
window.startMonitoringAutoRefresh = function() {
    console.log('🔵 startMonitoringAutoRefresh() が呼ばれました');
    
    // 既存のインターバルをクリア
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    // 30秒ごとに更新
    monitoringInterval = setInterval(() => {
        const currentSection = document.querySelector('.content-section:not(.hidden)');
        if (currentSection && currentSection.id === 'system-monitoring-section') {
            console.log('⏰ 自動更新を実行します（30秒経過）');
            window.loadSystemMonitoring();
        }
    }, 30000);
    
    console.log('✅ 自動更新インターバルを設定しました（30秒）');
};

console.log('✅ System monitoring functions loaded in external JS file');
