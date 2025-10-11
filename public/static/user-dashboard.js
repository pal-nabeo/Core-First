// CLO向けユーザーダッシュボード JavaScript

// グローバル変数
let currentSection = 'overview';
let charts = {
    efficiencyChart: null,
    costChart: null
};

// DOMContentLoaded イベント
document.addEventListener('DOMContentLoaded', function() {
    initializeUserDashboard();
    setupEventListeners();
    loadInitialData();
    updateTime();
});

// ダッシュボード初期化
function initializeUserDashboard() {
    // サイドバーの状態を復元
    const savedSidebarState = localStorage.getItem('userSidebarCollapsed');
    if (savedSidebarState === 'true') {
        // 初期状態で折りたたみ状態に設定
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('sidebar-collapsed');
            sidebar.classList.remove('w-80');
            // ツールチップイベントリスナーを設定
            setupTooltipListeners();
        }
    } else {
        // 展開状態の場合は幅80に設定
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('w-80');
            sidebar.classList.remove('sidebar-collapsed');
        }
    }

    // 前回のセクションを復元
    const savedSection = localStorage.getItem('userCurrentSection');
    if (savedSection && savedSection !== 'overview') {
        showSection(savedSection);
    }

    // チャート初期化
    initializeCharts();
}

// イベントリスナー設定
function setupEventListeners() {
    // サイドバートグルボタンのイベントリスナー設定
    const toggleButton = document.querySelector('button[onclick="toggleSidebar()"]');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleSidebar);
    }

    // モーダル外クリックで閉じる
    document.addEventListener('click', function(e) {
        const modals = document.querySelectorAll('[id$="-modal"]');
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });

    // ESCキーでモーダルを閉じる
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const visibleModals = document.querySelectorAll('[id$="-modal"]:not(.hidden)');
            visibleModals.forEach(modal => {
                modal.classList.add('hidden');
            });
        }
    });

    // レスポンシブ対応
    window.addEventListener('resize', handleResize);
}

// 初期データ読み込み
async function loadInitialData() {
    try {
        // サンプルデータでKPIを更新
        updateKPICards();
        loadDashboardCharts();
    } catch (error) {
        console.error('初期データ読み込み中にエラー:', error);
        showNotification('データの読み込みに失敗しました', 'warning');
    }
}

// KPIカード更新
function updateKPICards() {
    // サンプルデータでKPIカードを更新
    const kpis = {
        efficiencyScore: '87.5%',
        costSavings: '¥2.3M',
        loadingEfficiency: '92.1%',
        aiUsage: '78.3%'
    };

    Object.keys(kpis).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            element.textContent = kpis[key];
        }
    });
}

// チャート初期化
function initializeCharts() {
    initializeEfficiencyChart();
    initializeCostChart();
}

// 効率性チャート初期化
function initializeEfficiencyChart() {
    const ctx = document.getElementById('efficiencyChart');
    if (!ctx) return;

    charts.efficiencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
            datasets: [{
                label: '総合効率スコア',
                data: [82.1, 84.3, 85.8, 86.2, 87.1, 87.5],
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 80,
                    max: 90,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// コストチャート初期化
function initializeCostChart() {
    const ctx = document.getElementById('costChart');
    if (!ctx) return;

    charts.costChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['配送コスト', '倉庫コスト', '人件費', 'システム費'],
            datasets: [{
                label: 'コスト（百万円）',
                data: [12.5, 8.3, 15.2, 3.1],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(139, 92, 246, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// ダッシュボードチャートデータ読み込み
function loadDashboardCharts() {
    // 実際のAPIからデータを取得する際の処理
    // 現在はサンプルデータで初期化済み
    console.log('チャートデータ読み込み完了');
}

// セクション表示切り替え
window.showSection = function showSection(sectionName) {
    console.log('showSection called with:', sectionName);
    // 全てのセクションを非表示
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });

    // 全てのナビゲーションアイテムの active クラスを削除
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // 指定されたセクションを表示
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    // 対応するナビゲーションアイテムに active クラスを追加
    const navItem = document.querySelector(`[data-section="${sectionName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // ページタイトル更新
    updatePageTitle(sectionName);
    
    // セクション変更時の処理
    handleSectionChange(sectionName);
    
    // 現在のセクションを保存
    currentSection = sectionName;
    localStorage.setItem('userCurrentSection', sectionName);
}

// ページタイトル更新
function updatePageTitle(sectionName) {
    const titles = {
        overview: '総合評価ダッシュボード',
        usage: '利用状況ダッシュボード',
        'ai-logistics': '積載効率改善',
        'ai-warehouse': '庫内作業改善',
        'ai-waiting': '荷待ち時間短縮',
        'ai-chat': 'AIチャット',
        'data-upload': 'データアップロード',
        reports: 'レポート管理',
        license: 'ライセンス管理',
        team: 'チーム管理',
        profile: 'プロファイル設定',
        security: 'セキュリティ設定'
    };

    const titleElement = document.getElementById('page-title');
    if (titleElement) {
        titleElement.textContent = titles[sectionName] || 'ダッシュボード';
    }
}

// セクション変更時の処理
function handleSectionChange(sectionName) {
    switch (sectionName) {
        case 'overview':
            // チャートを再描画
            if (charts.efficiencyChart) charts.efficiencyChart.update();
            if (charts.costChart) charts.costChart.update();
            break;
        case 'usage':
            // 利用状況データ読み込み
            console.log('利用状況データ読み込み');
            break;
        // 他のセクション用の処理を追加
    }
}

// サイドバー切り替え
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
    
    if (isCollapsed) {
        // 展開状態に切り替え
        sidebar.classList.remove('sidebar-collapsed');
        sidebar.classList.add('w-80');
        localStorage.setItem('userSidebarCollapsed', 'false');
        
        // ツールチップを非表示にする
        hideAllTooltips();
        
        // ホバーイベントリスナーを削除
        removeTooltipListeners();
    } else {
        // 折りたたみ状態に切り替え
        sidebar.classList.remove('w-80');
        sidebar.classList.add('sidebar-collapsed');
        localStorage.setItem('userSidebarCollapsed', 'true');
        
        // ツールチップイベントリスナーを追加
        setupTooltipListeners();
    }
}

// ツールチップイベントリスナー設定
function setupTooltipListeners() {
    const navItems = document.querySelectorAll('.nav-item[data-tooltip]');
    
    navItems.forEach(item => {
        item.addEventListener('mouseenter', showTooltip);
        item.addEventListener('mouseleave', hideTooltip);
    });
}

// ツールチップイベントリスナー削除
function removeTooltipListeners() {
    const navItems = document.querySelectorAll('.nav-item[data-tooltip]');
    
    navItems.forEach(item => {
        item.removeEventListener('mouseenter', showTooltip);
        item.removeEventListener('mouseleave', hideTooltip);
    });
}

// ツールチップ表示
function showTooltip(event) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar.classList.contains('sidebar-collapsed')) return;
    
    const element = event.currentTarget;
    const tooltipText = element.getAttribute('data-tooltip');
    if (!tooltipText) return;
    
    // 既存のツールチップを削除
    hideAllTooltips();
    
    // 新しいツールチップを作成
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipText;
    tooltip.id = 'nav-tooltip';
    
    // ツールチップを要素に追加
    element.style.position = 'relative';
    element.appendChild(tooltip);
    
    // アニメーション用の遅延
    setTimeout(() => {
        tooltip.style.opacity = '1';
    }, 100);
}

// ツールチップ非表示
function hideTooltip(event) {
    const tooltip = document.getElementById('nav-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        setTimeout(() => {
            if (tooltip.parentElement) {
                tooltip.remove();
            }
        }, 200);
    }
}

// 全ツールチップ非表示
function hideAllTooltips() {
    const tooltips = document.querySelectorAll('.tooltip');
    tooltips.forEach(tooltip => {
        tooltip.style.opacity = '0';
        setTimeout(() => {
            if (tooltip.parentElement) {
                tooltip.remove();
            }
        }, 200);
    });
}

// ユーザーメニュー切り替え
function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// ユーザーメニュー外クリックで閉じる
document.addEventListener('click', function(event) {
    const menu = document.getElementById('user-menu');
    const button = document.getElementById('user-menu-button');
    
    if (menu && button && !button.contains(event.target) && !menu.contains(event.target)) {
        menu.classList.add('hidden');
    }
});

// 通知表示
function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full`;
    
    const bgColors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    notification.classList.add(bgColors[type] || bgColors.info);
    notification.innerHTML = `
        <div class="flex items-center text-white">
            <i class="${icons[type] || icons.info} mr-3"></i>
            <span class="flex-1">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(notification);
    
    // アニメーション
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);

    // 自動削除
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }, duration);
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
    
    setTimeout(updateTime, 60000); // 1分ごとに更新
}

// レスポンシブ対応
function handleResize() {
    if (window.innerWidth < 768) {
        // モバイル表示時の処理
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.classList.contains('sidebar-collapsed')) {
            sidebar.classList.add('sidebar-collapsed');
            sidebar.classList.remove('w-80');
        }
    }
}

// ログアウト処理
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