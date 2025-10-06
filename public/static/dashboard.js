// 管理者ダッシュボード JavaScript

// グローバル変数
let currentSection = 'overview';
let charts = {
    activityChart: null,
    licenseChart: null
};
let usersData = [];
let currentPage = 1;
let totalPages = 1;

// DOMContentLoaded イベント
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupEventListeners();
    loadInitialData();
    startRealTimeUpdates();
    updateTime();
});

// ダッシュボード初期化
function initializeDashboard() {
    // サイドバーの状態を復元
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState === 'true') {
        toggleSidebar();
    }

    // 前回のセクションを復元
    const savedSection = localStorage.getItem('currentSection');
    if (savedSection && savedSection !== 'overview') {
        showSection(savedSection);
    }

    // グラフ初期化
    initializeCharts();
    
    // フィルターイベントリスナー設定
    setupFilterEventListeners();
}

// イベントリスナー設定
function setupEventListeners() {
    // 招待フォーム送信イベント
    const inviteUserForm = document.getElementById('invite-user-form');
    if (inviteUserForm) {
        inviteUserForm.addEventListener('submit', handleInviteUser);
    }

    const editUserForm = document.getElementById('edit-user-form');
    if (editUserForm) {
        editUserForm.addEventListener('submit', handleEditUser);
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
        // エラーが発生しても他のデータ読み込みを続行
        const results = await Promise.allSettled([
            loadDashboardStats(),
            loadUsersData(),
            loadLicenseData(),
            loadRecentActivities()
        ]);
        
        // 失敗した読み込みを確認
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const names = ['統計', 'ユーザー', 'ライセンス', 'アクティビティ'];
                console.error(`${names[index]}データの読み込みに失敗:`, result.reason);
            }
        });
    } catch (error) {
        console.error('初期データ読み込み中にエラー:', error);
        showNotification('一部のデータが読み込めませんでした', 'warning');
    }
}

// ダッシュボード統計読み込み
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/users/stats/summary', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (data.success) {
            updateDashboardStats(data.data);
        } else {
            console.error('統計データの読み込みに失敗:', data.error);
            // エラーでもデフォルト値で統計を表示
            updateDashboardStats({
                total_users: 0,
                active_users: 0,
                new_users_this_month: 0,
                role_distribution: []
            });
        }
    } catch (error) {
        console.error('統計データの読み込み中にエラー:', error);
        // エラーでもデフォルト値で統計を表示
        updateDashboardStats({
            total_users: 0,
            active_users: 0,
            new_users_this_month: 0,
            role_distribution: []
        });
    }
}

// ダッシュボード統計更新
function updateDashboardStats(stats) {
    // 統計値を更新
    updateElement('total-users', stats.total_users || 0);
    updateElement('active-users', stats.active_users || 0);
    updateElement('users-growth', `+${stats.new_users_this_month || 0}`);

    // アクティビティチャート更新
    if (charts.activityChart) {
        updateActivityChart(stats);
    }
}

// ユーザーデータ読み込み
async function loadUsersData(page = 1, search = '', role = '', status = '') {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '10',
            search: search,
            role: role,
            status: status
        });

        const response = await fetch(`/api/users?${params}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (data.success) {
            usersData = data.data.users || [];
            currentPage = data.data.pagination?.current_page || 1;
            totalPages = data.data.pagination?.total_pages || 1;
            
            updateUsersTable();
            updatePagination();
        } else {
            console.error('ユーザーデータエラー:', data.error);
            showNotification(`ユーザーデータの読み込みに失敗: ${data.error}`, 'error');
            // エラーでも空のテーブルを表示
            usersData = [];
            currentPage = 1;
            totalPages = 1;
            updateUsersTable();
            updatePagination();
        }
    } catch (error) {
        console.error('ユーザーデータの読み込み中にエラー:', error);
        showNotification(`ネットワークエラー: ${error.message}`, 'error');
        // エラーでも空のテーブルを表示
        usersData = [];
        currentPage = 1;
        totalPages = 1;
        updateUsersTable();
        updatePagination();
    }
}

// ライセンスデータ読み込み
async function loadLicenseData() {
    try {
        const response = await fetch('/api/licenses/stats', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            updateLicenseStats(data.data);
        } else {
            console.error('ライセンスデータの読み込みに失敗:', data.error);
        }
    } catch (error) {
        console.error('ライセンスデータの読み込み中にエラー:', error);
    }
}

// ライセンス統計更新
function updateLicenseStats(licenseData) {
    const info = licenseData.license_info;
    
    updateElement('license-usage', `${info.usage_percentage}%`);
    updateElement('total-licenses', info.max_users);
    updateElement('used-licenses', info.current_users);
    updateElement('available-licenses', info.available_licenses);

    // ライセンス使用率バー更新
    const licenseBar = document.getElementById('license-bar');
    if (licenseBar) {
        licenseBar.style.width = `${info.usage_percentage}%`;
        
        // 色を使用率に応じて変更
        licenseBar.className = 'h-2 rounded-full transition-all duration-300';
        if (info.usage_percentage >= 90) {
            licenseBar.classList.add('bg-red-500');
        } else if (info.usage_percentage >= 80) {
            licenseBar.classList.add('bg-yellow-500');
        } else {
            licenseBar.classList.add('bg-green-500');
        }
    }

    // ライセンスチャート更新
    if (charts.licenseChart) {
        updateLicenseChart(licenseData);
    }
}

// 最近のアクティビティ読み込み
async function loadRecentActivities() {
    try {
        // 実際のAPIが実装されるまではサンプルデータを表示
        const activities = [
            {
                type: 'login',
                message: '管理者がログインしました',
                time: '2分前',
                icon: 'fas fa-sign-in-alt',
                color: 'blue'
            },
            {
                type: 'user_created',
                message: '新しいユーザーが登録されました',
                time: '5分前',
                icon: 'fas fa-user-plus',
                color: 'green'
            },
            {
                type: 'license_warning',
                message: 'ライセンス使用率が80%に達しました',
                time: '15分前',
                icon: 'fas fa-exclamation-triangle',
                color: 'yellow'
            }
        ];

        updateRecentActivities(activities);
    } catch (error) {
        console.error('アクティビティデータの読み込み中にエラー:', error);
    }
}

// 最近のアクティビティ更新
function updateRecentActivities(activities) {
    const container = document.getElementById('recent-activities');
    if (!container) return;

    container.innerHTML = activities.map(activity => `
        <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-${activity.color}-100 rounded-full flex items-center justify-center">
                <i class="${activity.icon} text-${activity.color}-600 text-xs"></i>
            </div>
            <div class="flex-1">
                <p class="text-sm font-medium text-gray-900">${activity.message}</p>
            </div>
            <span class="text-xs text-gray-400">${activity.time}</span>
        </div>
    `).join('');
}

// ユーザーテーブル更新
function updateUsersTable() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = usersData.map(user => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span class="text-sm font-medium text-blue-600">${(user.display_name || user.name).charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${escapeHtml(user.display_name || user.name)}</div>
                        <div class="text-sm text-gray-500">${escapeHtml(user.email)}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}">
                    ${getRoleLabel(user.role)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(user.status)}">
                    ${getStatusLabel(user.status)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${user.last_login ? formatDate(user.last_login.date) : '未ログイン'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editUser(${user.id})" class="text-blue-600 hover:text-blue-900 mr-3">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteUser(${user.id}, '${escapeHtml(user.display_name || user.name)}')" class="text-red-600 hover:text-red-900">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ページネーション更新
function updatePagination() {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = '<div class="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">';
    
    // ページ情報表示
    const startIndex = (currentPage - 1) * 10 + 1;
    const endIndex = Math.min(currentPage * 10, usersData.length);
    const totalUsers = totalPages * 10; // APIから返されるページネーション情報を使用
    
    paginationHTML += `
        <div class="flex justify-between items-center w-full">
            <div>
                <p class="text-sm text-gray-700">
                    <span class="font-medium">${startIndex}</span> - <span class="font-medium">${endIndex}</span> 件を表示中
                </p>
            </div>
            <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
    `;

    // 前のページボタン
    const prevDisabled = currentPage <= 1;
    paginationHTML += `
        <button onclick="changePage(${currentPage - 1})" ${prevDisabled ? 'disabled' : ''} 
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${prevDisabled ? 'cursor-not-allowed opacity-50' : 'hover:text-gray-700'}">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    // ページ番号ボタン
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // 調整
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        paginationHTML += `
            <button onclick="changePage(${i})" 
                    class="relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        isActive 
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' 
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    }">
                ${i}
            </button>
        `;
    }

    // 次のページボタン
    const nextDisabled = currentPage >= totalPages;
    paginationHTML += `
        <button onclick="changePage(${currentPage + 1})" ${nextDisabled ? 'disabled' : ''} 
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${nextDisabled ? 'cursor-not-allowed opacity-50' : 'hover:text-gray-700'}">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    paginationHTML += '</nav></div></div>';
    paginationContainer.innerHTML = paginationHTML;
}

// ページ変更処理
function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    currentPage = page;
    
    // 現在のフィルター設定を保持してページ変更
    const search = document.getElementById('user-search')?.value || '';
    const role = document.getElementById('role-filter')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';
    
    loadUsersData(currentPage, search, role, status);
}

// フィルタリング適用
function applyUserFilters() {
    const search = document.getElementById('user-search')?.value || '';
    const role = document.getElementById('role-filter')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';
    
    currentPage = 1; // フィルタリング時は1ページ目に戻る
    loadUsersData(currentPage, search, role, status);
}

// Enterキーでフィルター実行
function setupFilterEventListeners() {
    const searchInput = document.getElementById('user-search');
    if (searchInput) {
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                applyUserFilters();
            }
        });
    }
}

// セクション表示切り替え
function showSection(sectionName) {
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
    localStorage.setItem('currentSection', sectionName);
}

// ページタイトル更新
function updatePageTitle(sectionName) {
    const titles = {
        overview: '管理者ダッシュボード',
        users: 'ユーザー管理',
        licenses: 'ライセンス管理',
        roles: '権限管理',
        audit: '監査ログ',
        settings: 'システム設定',
        reports: 'レポート'
    };

    const titleElement = document.getElementById('page-title');
    if (titleElement) {
        titleElement.textContent = titles[sectionName] || 'ダッシュボード';
    }
}

// セクション変更時の処理
function handleSectionChange(sectionName) {
    switch (sectionName) {
        case 'users':
            if (usersData.length === 0) {
                loadUsersData();
            }
            break;
        case 'licenses':
            loadLicenseData();
            break;
        case 'overview':
            loadDashboardStats();
            break;
    }
}

// サイドバー切り替え
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.contains('w-16');
    
    if (isCollapsed) {
        sidebar.classList.remove('w-16');
        sidebar.classList.add('w-64');
        localStorage.setItem('sidebarCollapsed', 'false');
    } else {
        sidebar.classList.remove('w-64');
        sidebar.classList.add('w-16');
        localStorage.setItem('sidebarCollapsed', 'true');
    }
}

// ユーザー追加処理
async function handleAddUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        name: formData.get('name'),
        email: formData.get('email'),
        role: formData.get('role'),
        password: formData.get('password')
    };

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (data.success) {
            showNotification('ユーザーが正常に追加されました', 'success');
            document.getElementById('add-user-modal').classList.add('hidden');
            e.target.reset();
            loadUsersData(currentPage);
            loadDashboardStats();
        } else {
            showNotification(data.error || 'ユーザーの追加に失敗しました', 'error');
        }
    } catch (error) {
        console.error('ユーザー追加エラー:', error);
        showNotification('ユーザー追加中にエラーが発生しました', 'error');
    }
}

// ユーザー編集
async function editUser(userId) {
    try {
        // ユーザー情報を取得
        const response = await fetch(`/api/users/${userId}`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success && data.user) {
            const user = data.user;
            
            // フォームにデータを設定
            document.getElementById('edit-user-id').value = user.id;
            document.getElementById('edit-name').value = user.display_name || user.name;
            document.getElementById('edit-email').value = user.email;
            document.getElementById('edit-role').value = user.role || 'user';
            document.getElementById('edit-status').value = user.status || 'active';
            
            // モーダルを表示
            document.getElementById('edit-user-modal').classList.remove('hidden');
        } else {
            showNotification('ユーザー情報の取得に失敗しました', 'error');
        }
    } catch (error) {
        console.error('ユーザー編集エラー:', error);
        showNotification('ユーザー編集中にエラーが発生しました', 'error');
    }
}

// ユーザー編集フォーム送信処理
async function handleEditUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userId = formData.get('user_id');
    const userData = {
        display_name: formData.get('display_name'),
        email: formData.get('email'),
        role: formData.get('role'),
        status: formData.get('status')
    };

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (data.success) {
            showNotification('ユーザー情報が正常に更新されました', 'success');
            document.getElementById('edit-user-modal').classList.add('hidden');
            loadUsersData(currentPage);
            loadDashboardStats();
        } else {
            showNotification(data.error || 'ユーザーの更新に失敗しました', 'error');
        }
    } catch (error) {
        console.error('ユーザー更新エラー:', error);
        showNotification('ユーザー更新中にエラーが発生しました', 'error');
    }
}

// ユーザー削除
async function deleteUser(userId) {
    if (!confirm('このユーザーを削除してもよろしいですか？')) {
        return;
    }

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('ユーザーが正常に削除されました', 'success');
            loadUsersData(currentPage);
            loadDashboardStats();
        } else {
            showNotification(data.error || 'ユーザーの削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('ユーザー削除エラー:', error);
        showNotification('ユーザー削除中にエラーが発生しました', 'error');
    }
}

// グラフ初期化
function initializeCharts() {
    initializeActivityChart();
    initializeLicenseChart();
}

// アクティビティチャート初期化
function initializeActivityChart() {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;

    charts.activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'アクティブユーザー数',
                data: [],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
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

// ライセンスチャート初期化
function initializeLicenseChart() {
    const ctx = document.getElementById('licenseChart');
    if (!ctx) return;

    charts.licenseChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'ライセンス使用数',
                data: [],
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

// ユーティリティ関数
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getRoleBadgeClass(role) {
    const classes = {
        super_admin: 'bg-purple-100 text-purple-800',
        admin: 'bg-blue-100 text-blue-800',
        site_manager: 'bg-green-100 text-green-800',
        user: 'bg-gray-100 text-gray-800'
    };
    return classes[role] || classes.user;
}

function getRoleLabel(role) {
    const labels = {
        super_admin: 'スーパー管理者',
        admin: '管理者',
        site_manager: 'サイト管理者',
        user: '一般ユーザー'
    };
    return labels[role] || role;
}

function getStatusBadgeClass(status) {
    const classes = {
        active: 'bg-green-100 text-green-800',
        inactive: 'bg-gray-100 text-gray-800',
        suspended: 'bg-red-100 text-red-800'
    };
    return classes[status] || classes.inactive;
}

function getStatusLabel(status) {
    const labels = {
        active: 'アクティブ',
        inactive: '非アクティブ',
        suspended: '停止'
    };
    return labels[status] || status;
}

// ライセンス管理
function refreshLicenseData() {
    loadLicenseData();
}

// リアルタイム更新
function startRealTimeUpdates() {
    // 30秒ごとに統計を更新
    setInterval(() => {
        if (currentSection === 'overview') {
            loadDashboardStats();
        }
    }, 30000);

    // 5分ごとにライセンスデータを更新
    setInterval(() => {
        if (currentSection === 'licenses') {
            loadLicenseData();
        }
    }, 300000);
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
        if (sidebar && !sidebar.classList.contains('w-16')) {
            sidebar.classList.add('w-16');
            sidebar.classList.remove('w-64');
        }
    }
}

// 招待処理
async function handleInviteUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const invitationData = {
        email: formData.get('email'),
        role: formData.get('role'),
        message: formData.get('message'),
        expires_in: formData.get('expires_in')
    };

    // バリデーション
    if (!invitationData.email || !invitationData.role) {
        showNotification('メールアドレスと権限は必須項目です', 'error');
        return;
    }

    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(invitationData.email)) {
        showNotification('正しいメールアドレス形式を入力してください', 'error');
        return;
    }

    try {
        const response = await fetch('/api/invitations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(invitationData)
        });

        const result = await response.json();

        if (result.success) {
            showNotification(`招待メールを ${invitationData.email} に送信しました`, 'success');
            
            // フォームをリセット
            e.target.reset();
            
            // モーダルを閉じる
            document.getElementById('add-user-modal').classList.add('hidden');
            
            // ユーザーリストを更新
            if (currentSection === 'users') {
                loadUsers();
            }
        } else {
            showNotification(result.error || '招待送信に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Invitation error:', error);
        showNotification('招待送信中にエラーが発生しました', 'error');
    }
}

// ユーザー編集処理
async function editUser(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'GET',
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success && result.user) {
            const user = result.user;
            
            // モーダルにデータを設定
            document.getElementById('edit-user-id').value = user.id;
            document.getElementById('edit-name').value = user.display_name || user.name || '';
            document.getElementById('edit-email').value = user.email || '';
            document.getElementById('edit-role').value = user.role || 'user';
            document.getElementById('edit-status').value = user.status || 'active';
            
            // モーダルを表示
            document.getElementById('edit-user-modal').classList.remove('hidden');
        } else {
            showNotification('ユーザー情報の取得に失敗しました', 'error');
        }
    } catch (error) {
        console.error('User fetch error:', error);
        showNotification('ユーザー情報の取得中にエラーが発生しました', 'error');
    }
}

// ユーザー編集フォーム処理
async function handleEditUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userId = formData.get('user_id');
    const userData = {
        display_name: formData.get('display_name'),
        email: formData.get('email'),
        role: formData.get('role'),
        status: formData.get('status')
    };

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (result.success) {
            showNotification('ユーザー情報を更新しました', 'success');
            
            // モーダルを閉じる
            document.getElementById('edit-user-modal').classList.add('hidden');
            
            // ユーザーリストを更新
            if (currentSection === 'users') {
                loadUsers();
            }
        } else {
            showNotification(result.error || 'ユーザー更新に失敗しました', 'error');
        }
    } catch (error) {
        console.error('User update error:', error);
        showNotification('ユーザー更新中にエラーが発生しました', 'error');
    }
}

// ユーザー削除処理
async function deleteUser(userId, userName) {
    if (!confirm(`ユーザー「${userName}」を削除しますか？\n\nこの操作は取り消せません。`)) {
        return;
    }

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            showNotification(`ユーザー「${userName}」を削除しました`, 'success');
            
            // ユーザーリストを更新
            if (currentSection === 'users') {
                loadUsers();
            }
        } else {
            showNotification(result.error || 'ユーザー削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('User delete error:', error);
        showNotification('ユーザー削除中にエラーが発生しました', 'error');
    }
}

// イベントリスナーを編集フォームにも追加
document.addEventListener('DOMContentLoaded', function() {
    const editUserForm = document.getElementById('edit-user-form');
    if (editUserForm) {
        editUserForm.addEventListener('submit', handleEditUser);
    }
});

// アップグレード関連の変数
let currentUpgradeData = null;
let availablePlans = [];
let selectedPlanId = null;

// アップグレードデータ読み込み
async function loadUpgradeData() {
    try {
        // 現在のプラン状況を取得
        const statusResponse = await fetch('/api/upgrade/status', {
            credentials: 'include'
        });
        const statusData = await statusResponse.json();

        if (statusData.success) {
            currentUpgradeData = statusData;
            updateCurrentPlanUI(statusData);
        }

        // 利用可能なプラン一覧を取得
        const plansResponse = await fetch('/api/upgrade/plans', {
            credentials: 'include'
        });
        const plansData = await plansResponse.json();

        if (plansData.success) {
            availablePlans = plansData.plans;
            updateAvailablePlansUI(plansData.plans);
        }

    } catch (error) {
        console.error('Upgrade data load error:', error);
        showNotification('アップグレード情報の取得に失敗しました', 'error');
    }
}

// 現在のプラン表示更新
function updateCurrentPlanUI(data) {
    const { subscription, usage, limits } = data;
    const plan = subscription.currentPlan;

    // プラン基本情報
    document.getElementById('current-plan-name').textContent = plan.displayName;
    document.getElementById('current-plan-price').textContent = 
        plan.price === 0 ? '無料' : `月額 ¥${plan.price.toLocaleString()}`;

    // 日付情報
    document.getElementById('plan-start-date').textContent = 
        formatDate(subscription.planStartedAt);
    
    if (subscription.planExpiresAt) {
        document.getElementById('plan-expires-date').textContent = 
            formatDate(subscription.planExpiresAt);
        
        // 残り日数表示
        const statusElement = document.getElementById('plan-status');
        const statusContainer = document.getElementById('plan-status-info');
        
        if (subscription.daysRemaining >= 0) {
            statusElement.textContent = `残り${subscription.daysRemaining}日`;
            statusContainer.className = 'flex items-center';
            
            if (subscription.daysRemaining <= 7) {
                statusContainer.className = 'flex items-center text-red-600';
                statusElement.parentElement.innerHTML = 
                    '<i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>' +
                    `<span class="text-sm text-red-600">残り${subscription.daysRemaining}日（まもなく期限切れ）</span>`;
            }
        } else {
            statusElement.textContent = '期限切れ';
            statusContainer.className = 'flex items-center text-red-600';
        }
    } else {
        document.getElementById('plan-expires-date').textContent = '無制限';
        document.getElementById('plan-status').textContent = 'アクティブ';
    }

    // 利用状況
    const userUsage = usage.maxUsers > 0 ? 
        `${usage.currentUsers} / ${usage.maxUsers}名` : 
        `${usage.currentUsers}名（無制限）`;
    document.getElementById('user-usage').textContent = userUsage;

    const storageUsage = usage.maxStorage > 0 ? 
        `${usage.storageUsed}MB / ${usage.maxStorage}MB` : 
        `${usage.storageUsed}MB（無制限）`;
    document.getElementById('storage-usage').textContent = storageUsage;

    // 利用率バー
    const userPercent = usage.maxUsers > 0 ? 
        Math.min((usage.currentUsers / usage.maxUsers) * 100, 100) : 0;
    document.getElementById('user-usage-bar').style.width = `${userPercent}%`;

    const storagePercent = usage.maxStorage > 0 ? 
        Math.min((usage.storageUsed / usage.maxStorage) * 100, 100) : 0;
    document.getElementById('storage-usage-bar').style.width = `${storagePercent}%`;

    // 制限警告
    const warningsContainer = document.getElementById('usage-warnings');
    const userWarning = document.getElementById('user-limit-warning');
    const storageWarning = document.getElementById('storage-limit-warning');

    if (limits.userLimitReached || limits.storageLimitReached) {
        warningsContainer.classList.remove('hidden');
        
        if (limits.userLimitReached) {
            userWarning.classList.remove('hidden');
        }
        
        if (limits.storageLimitReached) {
            storageWarning.classList.remove('hidden');
        }
    } else {
        warningsContainer.classList.add('hidden');
        userWarning.classList.add('hidden');
        storageWarning.classList.add('hidden');
    }
}

// 利用可能プラン表示更新
function updateAvailablePlansUI(plans) {
    const container = document.getElementById('available-plans');
    
    container.innerHTML = plans.map(plan => {
        const isCurrentPlan = currentUpgradeData?.subscription?.currentPlan?.id === plan.id;
        const isRecommended = plan.recommended;
        
        return `
            <div class="relative border ${isCurrentPlan ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} 
                     ${isRecommended ? 'ring-2 ring-orange-500' : ''} rounded-lg p-6 hover:shadow-lg transition-shadow">
                ${isRecommended ? `
                    <div class="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span class="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                            おすすめ
                        </span>
                    </div>
                ` : ''}
                
                ${isCurrentPlan ? `
                    <div class="absolute -top-3 right-3">
                        <span class="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                            現在のプラン
                        </span>
                    </div>
                ` : ''}

                <div class="text-center">
                    <h4 class="text-xl font-bold text-gray-900 mb-2">${plan.displayName}</h4>
                    <div class="text-3xl font-bold text-gray-900 mb-1">
                        ${plan.price === 0 ? '無料' : `¥${plan.price.toLocaleString()}`}
                    </div>
                    <div class="text-sm text-gray-600 mb-4">
                        ${plan.duration > 0 ? `${plan.duration}日間` : '月額'}
                    </div>
                    <p class="text-sm text-gray-600 mb-6">${plan.description}</p>

                    <ul class="text-left space-y-2 mb-6">
                        <li class="flex items-center text-sm">
                            <i class="fas fa-users text-green-500 mr-2"></i>
                            ${plan.maxUsers > 0 ? `${plan.maxUsers}名まで` : '無制限ユーザー'}
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-hdd text-green-500 mr-2"></i>
                            ${plan.maxStorage > 0 ? `${plan.maxStorage}GB` : '無制限ストレージ'}
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-${plan.features.twoFactor ? 'check' : 'times'} 
                               text-${plan.features.twoFactor ? 'green' : 'gray'}-500 mr-2"></i>
                            2要素認証
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-${plan.features.ipRestriction ? 'check' : 'times'} 
                               text-${plan.features.ipRestriction ? 'green' : 'gray'}-500 mr-2"></i>
                            IP制限
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-${plan.features.sso !== false ? 'check' : 'times'} 
                               text-${plan.features.sso !== false ? 'green' : 'gray'}-500 mr-2"></i>
                            SSO連携${plan.features.sso === 'google' ? '（Google）' : 
                                    plan.features.sso === 'multiple' ? '（複数）' : 
                                    plan.features.sso === 'custom' ? '（カスタム）' : ''}
                        </li>
                    </ul>

                    ${!isCurrentPlan ? `
                        <button onclick="showPlanChangeConfirm('${plan.id}')" 
                                class="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
                            このプランに変更
                        </button>
                    ` : `
                        <button class="w-full bg-blue-100 text-blue-800 py-2 px-4 rounded-lg font-medium cursor-not-allowed">
                            現在のプラン
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// プラン変更確認モーダル表示
function showPlanChangeConfirm(planId) {
    selectedPlanId = planId;
    const selectedPlan = availablePlans.find(p => p.id === planId);
    const currentPlan = currentUpgradeData?.subscription?.currentPlan;
    
    if (!selectedPlan || !currentPlan) {
        showNotification('プラン情報の取得に失敗しました', 'error');
        return;
    }

    const isUpgrade = selectedPlan.price > currentPlan.price;
    const isDowngrade = selectedPlan.price < currentPlan.price;

    const content = document.getElementById('plan-change-content');
    content.innerHTML = `
        <div class="text-center mb-4">
            <i class="fas fa-${isUpgrade ? 'arrow-up' : isDowngrade ? 'arrow-down' : 'exchange-alt'} 
               text-4xl text-${isUpgrade ? 'green' : isDowngrade ? 'orange' : 'blue'}-500 mb-4"></i>
            <h4 class="text-lg font-semibold">
                ${isUpgrade ? 'プランアップグレード' : isDowngrade ? 'プランダウングレード' : 'プラン変更'}
            </h4>
        </div>

        <div class="bg-gray-50 rounded-lg p-4 mb-4">
            <div class="grid grid-cols-2 gap-4 text-center">
                <div>
                    <div class="text-sm text-gray-600">現在のプラン</div>
                    <div class="font-semibold text-gray-900">${currentPlan.displayName}</div>
                    <div class="text-sm text-gray-600">
                        ${currentPlan.price === 0 ? '無料' : `月額 ¥${currentPlan.price.toLocaleString()}`}
                    </div>
                </div>
                <div>
                    <div class="text-sm text-gray-600">変更後プラン</div>
                    <div class="font-semibold text-gray-900">${selectedPlan.displayName}</div>
                    <div class="text-sm text-gray-600">
                        ${selectedPlan.price === 0 ? '無料' : `月額 ¥${selectedPlan.price.toLocaleString()}`}
                    </div>
                </div>
            </div>
        </div>

        <div class="space-y-2 text-sm">
            <div class="flex justify-between">
                <span>ユーザー数上限:</span>
                <span>${currentPlan.maxUsers > 0 ? `${currentPlan.maxUsers}名` : '無制限'} 
                      → ${selectedPlan.maxUsers > 0 ? `${selectedPlan.maxUsers}名` : '無制限'}</span>
            </div>
            <div class="flex justify-between">
                <span>ストレージ容量:</span>
                <span>${currentPlan.maxStorage > 0 ? `${currentPlan.maxStorage}GB` : '無制限'} 
                      → ${selectedPlan.maxStorage > 0 ? `${selectedPlan.maxStorage}GB` : '無制限'}</span>
            </div>
        </div>

        ${isDowngrade ? `
            <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg mt-4">
                <i class="fas fa-exclamation-triangle mr-1"></i>
                <strong>注意:</strong> ダウングレード後は一部機能が制限される場合があります。
            </div>
        ` : ''}

        <div class="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg mt-4">
            <i class="fas fa-info-circle mr-1"></i>
            プラン変更は即座に有効となります。
        </div>
    `;

    document.getElementById('change-plan-modal').classList.remove('hidden');
}

// プラン変更実行
async function confirmPlanChange() {
    if (!selectedPlanId) {
        showNotification('プランが選択されていません', 'error');
        return;
    }

    const confirmBtn = document.getElementById('confirm-plan-change-btn');
    const originalText = confirmBtn.innerHTML;
    
    try {
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>変更中...';
        confirmBtn.disabled = true;

        const response = await fetch('/api/upgrade/change-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                planId: selectedPlanId
            })
        });

        const result = await response.json();

        if (result.success) {
            showNotification(result.message, 'success');
            
            // モーダルを閉じる
            document.getElementById('change-plan-modal').classList.add('hidden');
            
            // データを再読み込み
            await loadUpgradeData();
            
        } else {
            showNotification(result.error || 'プラン変更に失敗しました', 'error');
        }

    } catch (error) {
        console.error('Plan change error:', error);
        showNotification('プラン変更中にエラーが発生しました', 'error');
    } finally {
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    }
}

// 課金履歴読み込み
async function loadBillingHistory() {
    try {
        const response = await fetch('/api/upgrade/history', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            updateBillingHistoryUI(data.history);
        } else {
            showNotification('課金履歴の取得に失敗しました', 'error');
        }

    } catch (error) {
        console.error('Billing history load error:', error);
        showNotification('課金履歴の取得中にエラーが発生しました', 'error');
    }
}

// 課金履歴表示更新
function updateBillingHistoryUI(history) {
    const tbody = document.getElementById('billing-history-table');
    
    if (history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                    プラン変更履歴がありません
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = history.map(record => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm text-gray-900">
                ${formatDate(record.date)}
            </td>
            <td class="px-6 py-4 text-sm">
                <div class="flex items-center">
                    <i class="fas fa-arrow-right text-gray-400 mr-2"></i>
                    <span class="text-gray-600">${record.fromPlan.displayName || record.fromPlan.id}</span>
                    <i class="fas fa-arrow-right text-blue-500 mx-2"></i>
                    <span class="font-medium text-gray-900">${record.toPlan.displayName || record.toPlan.id}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-900">
                ${record.price === 0 ? '無料' : `¥${record.price.toLocaleString()}`}
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">
                ${record.actorName}
            </td>
        </tr>
    `).join('');
}

// セクション表示時のデータ読み込み
const originalShowSection = window.showSection || (() => {});
window.showSection = function(sectionName) {
    // 元の関数を実行
    originalShowSection(sectionName);
    
    // アップグレード関連セクションの場合、データを読み込み
    if (sectionName === 'upgrade' && !currentUpgradeData) {
        loadUpgradeData();
    }
    
    if (sectionName === 'billing') {
        loadBillingHistory();
    }
};

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

// ==============================================
// アカウント管理機能
// ==============================================

// プロフィール情報読み込み
async function loadProfile() {
    try {
        const response = await fetch('/api/account/profile', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            const profile = data.profile;
            
            // フォーム要素に値を設定
            document.getElementById('display-name').value = profile.displayName || '';
            document.getElementById('email').value = profile.email || '';
            document.getElementById('phone-number').value = profile.phoneNumber || '';
            document.getElementById('locale').value = profile.locale || 'ja-JP';
            document.getElementById('timezone').value = profile.timezone || 'Asia/Tokyo';
            
            // 作成日を表示
            if (profile.createdAt) {
                const createdDate = new Date(profile.createdAt);
                document.getElementById('created-at').value = createdDate.toLocaleString('ja-JP');
            }
            
            // ロール情報を表示
            updateUserRoles(profile.roles, profile.tenantName);
            
            // 2FA状態を更新
            update2FAStatus(profile.twoFaEnabled);
            
            showNotification('プロフィール情報を読み込みました', 'success');
        } else {
            throw new Error(data.error || 'プロフィール読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Profile load error:', error);
        showNotification('プロフィール読み込み中にエラーが発生しました: ' + error.message, 'error');
    }
}

// ユーザーロール情報を表示
function updateUserRoles(roles, tenantName) {
    const rolesContainer = document.getElementById('user-roles');
    
    if (!roles || roles.length === 0) {
        rolesContainer.innerHTML = '<p class="text-gray-500">ロールが割り当てられていません</p>';
        return;
    }
    
    const roleColors = {
        'スーパー管理者': 'bg-red-100 text-red-800',
        '管理者': 'bg-orange-100 text-orange-800',
        'サイト管理者': 'bg-blue-100 text-blue-800',
        '一般ユーザー': 'bg-gray-100 text-gray-800'
    };
    
    const roleItems = roles.map(role => {
        const colorClass = roleColors[role] || 'bg-gray-100 text-gray-800';
        return `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center">
                    <i class="fas fa-shield-alt mr-3 text-green-600"></i>
                    <div>
                        <span class="inline-block px-2 py-1 text-xs font-medium rounded-full ${colorClass}">
                            ${role}
                        </span>
                        <p class="text-sm text-gray-600 mt-1">組織: ${tenantName}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    rolesContainer.innerHTML = roleItems;
}

// プロフィール更新フォーム送信
document.addEventListener('DOMContentLoaded', function() {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordChange);
    }
});

// プロフィール更新処理
async function handleProfileUpdate(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const profileData = {
            displayName: formData.get('displayName'),
            phoneNumber: formData.get('phoneNumber'),
            locale: formData.get('locale'),
            timezone: formData.get('timezone')
        };
        
        const response = await fetch('/api/account/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('プロフィールを更新しました', 'success');
        } else {
            throw new Error(data.error || 'プロフィール更新に失敗しました');
        }
    } catch (error) {
        console.error('Profile update error:', error);
        showNotification('プロフィール更新中にエラーが発生しました: ' + error.message, 'error');
    }
}

// パスワード変更処理
async function handlePasswordChange(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const passwordData = {
            currentPassword: formData.get('currentPassword'),
            newPassword: formData.get('newPassword'),
            confirmPassword: formData.get('confirmPassword')
        };
        
        // パスワード確認
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            throw new Error('新しいパスワードが一致しません');
        }
        
        const response = await fetch('/api/account/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(passwordData),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('パスワードを変更しました', 'success');
            event.target.reset(); // フォームをクリア
        } else {
            throw new Error(data.error || 'パスワード変更に失敗しました');
        }
    } catch (error) {
        console.error('Password change error:', error);
        showNotification('パスワード変更中にエラーが発生しました: ' + error.message, 'error');
    }
}

// 2FA状態更新
function update2FAStatus(enabled) {
    const statusElement = document.getElementById('2fa-status');
    const toggleButton = document.getElementById('2fa-toggle');
    
    if (enabled) {
        statusElement.textContent = '有効';
        statusElement.className = 'mr-3 text-sm font-medium text-green-600';
        toggleButton.textContent = '無効化';
        toggleButton.className = 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg';
        toggleButton.onclick = () => toggle2FA(false);
    } else {
        statusElement.textContent = '無効';
        statusElement.className = 'mr-3 text-sm font-medium text-gray-600';
        toggleButton.textContent = '有効化';
        toggleButton.className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg';
        toggleButton.onclick = () => toggle2FA(true);
    }
}

// 2FA切り替え
async function toggle2FA(enable) {
    try {
        const endpoint = enable ? '/api/account/2fa/enable' : '/api/account/2fa/disable';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
            update2FAStatus(enable);
        } else {
            throw new Error(data.error || '2FA設定に失敗しました');
        }
    } catch (error) {
        console.error('2FA toggle error:', error);
        showNotification('2FA設定中にエラーが発生しました: ' + error.message, 'error');
    }
}

// セクション表示時にプロフィールデータを自動読み込み
const originalShowSection = showSection;
showSection = function(sectionId) {
    originalShowSection(sectionId);
    
    // プロフィールセクションが表示された時にデータを読み込み
    if (sectionId === 'profile' || sectionId === 'security') {
        setTimeout(() => {
            loadProfile();
        }, 100);
    }
};