// メインダッシュボード用JavaScript
class MainDashboard {
    constructor() {
        this.charts = {};
        this.currentTab = 'overview';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboardData();
        this.showTab('overview'); // デフォルトタブを表示
    }

    setupEventListeners() {
        // タブ切り替え
        document.querySelectorAll('.dashboard-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.id.replace('tab-', '');
                this.showTab(tabName);
            });
        });

        // ユーザープロフィールドロップダウン
        const profileButton = document.getElementById('profile-button');
        const profileDropdown = document.getElementById('profile-dropdown');

        if (profileButton && profileDropdown) {
            profileButton.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('hidden');
            });

            // ドロップダウン外クリックで閉じる
            document.addEventListener('click', () => {
                profileDropdown.classList.add('hidden');
            });
        }

        // ページ内リンクのハンドリング
        document.querySelectorAll('a[href^="/"]').forEach(link => {
            if (!link.href.includes('logout')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = link.href;
                });
            }
        });
    }

    async loadDashboardData() {
        try {
            // KPIデータの読み込み
            await this.loadKPIData();
            
            // チャートデータの読み込み
            await this.loadChartData();
            
            // AI推奨事項の読み込み
            await this.loadAIRecommendations();
            
        } catch (error) {
            console.error('ダッシュボードデータの読み込みエラー:', error);
            this.showErrorMessage('データの読み込みに失敗しました。');
        }
    }

    async loadKPIData() {
        // シミュレートされたKPIデータ
        const kpiData = {
            totalCost: { value: 1250000, change: 5.2, trend: 'up' },
            efficiency: { value: 87.3, change: 2.1, trend: 'up' },
            incidents: { value: 12, change: -15.4, trend: 'down' },
            satisfaction: { value: 4.2, change: 0.8, trend: 'up' }
        };

        this.updateKPICards(kpiData);
    }

    updateKPICards(data) {
        // 総コスト更新
        const totalCostValue = document.querySelector('.kpi-card:nth-child(1) .kpi-value');
        const totalCostChange = document.querySelector('.kpi-card:nth-child(1) .kpi-change');
        if (totalCostValue) {
            totalCostValue.textContent = `¥${(data.totalCost.value / 1000).toFixed(0)}K`;
        }
        if (totalCostChange) {
            totalCostChange.innerHTML = `
                <i class="fas fa-arrow-${data.totalCost.trend === 'up' ? 'up' : 'down'} mr-1"></i>
                ${Math.abs(data.totalCost.change)}%
            `;
            totalCostChange.className = `kpi-change ${data.totalCost.trend === 'up' ? 'positive' : 'negative'}`;
        }

        // 効率性更新
        const efficiencyValue = document.querySelector('.kpi-card:nth-child(2) .kpi-value');
        const efficiencyChange = document.querySelector('.kpi-card:nth-child(2) .kpi-change');
        if (efficiencyValue) {
            efficiencyValue.textContent = `${data.efficiency.value}%`;
        }
        if (efficiencyChange) {
            efficiencyChange.innerHTML = `
                <i class="fas fa-arrow-${data.efficiency.trend === 'up' ? 'up' : 'down'} mr-1"></i>
                ${Math.abs(data.efficiency.change)}%
            `;
            efficiencyChange.className = `kpi-change ${data.efficiency.trend === 'up' ? 'positive' : 'negative'}`;
        }

        // インシデント数更新
        const incidentsValue = document.querySelector('.kpi-card:nth-child(3) .kpi-value');
        const incidentsChange = document.querySelector('.kpi-card:nth-child(3) .kpi-change');
        if (incidentsValue) {
            incidentsValue.textContent = data.incidents.value;
        }
        if (incidentsChange) {
            incidentsChange.innerHTML = `
                <i class="fas fa-arrow-${data.incidents.trend === 'up' ? 'up' : 'down'} mr-1"></i>
                ${Math.abs(data.incidents.change)}%
            `;
            incidentsChange.className = `kpi-change ${data.incidents.trend === 'down' ? 'positive' : 'negative'}`;
        }

        // 満足度更新
        const satisfactionValue = document.querySelector('.kpi-card:nth-child(4) .kpi-value');
        const satisfactionChange = document.querySelector('.kpi-card:nth-child(4) .kpi-change');
        if (satisfactionValue) {
            satisfactionValue.textContent = `${data.satisfaction.value}/5`;
        }
        if (satisfactionChange) {
            satisfactionChange.innerHTML = `
                <i class="fas fa-arrow-${data.satisfaction.trend === 'up' ? 'up' : 'down'} mr-1"></i>
                ${Math.abs(data.satisfaction.change)}%
            `;
            satisfactionChange.className = `kpi-change ${data.satisfaction.trend === 'up' ? 'positive' : 'negative'}`;
        }
    }

    async loadChartData() {
        // 総合評価ダッシュボードのチャート
        if (document.getElementById('cost-trend-chart')) {
            this.createCostTrendChart();
        }
        if (document.getElementById('performance-chart')) {
            this.createPerformanceChart();
        }

        // 利用状況ダッシュボードのチャート
        if (document.getElementById('usage-chart')) {
            this.createUsageChart();
        }
        if (document.getElementById('user-activity-chart')) {
            this.createUserActivityChart();
        }
    }

    createCostTrendChart() {
        const ctx = document.getElementById('cost-trend-chart');
        if (!ctx) return;

        this.charts.costTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
                datasets: [{
                    label: '総コスト (万円)',
                    data: [120, 115, 125, 130, 118, 125],
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }, {
                    label: '予算',
                    data: [140, 140, 140, 140, 140, 140],
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'コスト推移'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '万円';
                            }
                        }
                    }
                }
            }
        });
    }

    createPerformanceChart() {
        const ctx = document.getElementById('performance-chart');
        if (!ctx) return;

        this.charts.performance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['コスト効率', '配送速度', '品質', '顧客満足度', '環境対応', 'リスク管理'],
                datasets: [{
                    label: '現在の評価',
                    data: [85, 78, 92, 88, 76, 82],
                    borderColor: 'rgb(139, 92, 246)',
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(139, 92, 246)'
                }, {
                    label: '業界平均',
                    data: [75, 80, 85, 82, 70, 78],
                    borderColor: 'rgb(156, 163, 175)',
                    backgroundColor: 'rgba(156, 163, 175, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(156, 163, 175)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: {
                            display: true
                        },
                        suggestedMin: 0,
                        suggestedMax: 100
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'パフォーマンス評価'
                    }
                }
            }
        });
    }

    createUsageChart() {
        const ctx = document.getElementById('usage-chart');
        if (!ctx) return;

        this.charts.usage = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['配送管理', 'データ分析', 'レポート生成', 'AI分析', 'その他'],
                datasets: [{
                    data: [35, 25, 20, 15, 5],
                    backgroundColor: [
                        'rgb(59, 130, 246)',
                        'rgb(16, 185, 129)',
                        'rgb(245, 158, 11)',
                        'rgb(139, 92, 246)',
                        'rgb(156, 163, 175)'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: '機能別利用率'
                    }
                }
            }
        });
    }

    createUserActivityChart() {
        const ctx = document.getElementById('user-activity-chart');
        if (!ctx) return;

        this.charts.userActivity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['月', '火', '水', '木', '金', '土', '日'],
                datasets: [{
                    label: 'アクティブユーザー数',
                    data: [45, 52, 48, 58, 62, 35, 28],
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'ユーザーアクティビティ'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '人';
                            }
                        }
                    }
                }
            }
        });
    }

    async loadAIRecommendations() {
        const recommendations = [
            {
                title: 'コスト最適化の機会',
                description: 'A-B間の配送ルートを見直すことで、月間15%のコスト削減が可能です。',
                priority: 'high'
            },
            {
                title: 'パフォーマンス向上',
                description: 'データ連携の自動化により、処理時間を30%短縮できます。',
                priority: 'medium'
            },
            {
                title: 'リスク対策',
                description: '新しい予測分析機能により、配送遅延リスクを事前に検知できます。',
                priority: 'low'
            }
        ];

        this.renderRecommendations(recommendations);
    }

    renderRecommendations(recommendations) {
        const container = document.querySelector('.recommendation-list');
        if (!container) return;

        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item priority-${rec.priority} slide-up">
                <div class="recommendation-title">${rec.title}</div>
                <div class="recommendation-desc">${rec.description}</div>
            </div>
        `).join('');
    }

    showTab(tabName) {
        // 全てのタブボタンとコンテンツを非アクティブにする
        document.querySelectorAll('.dashboard-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // 選択されたタブをアクティブにする
        const activeTab = document.getElementById(`tab-${tabName}`);
        const activeContent = document.getElementById(`${tabName}-tab`);

        if (activeTab && activeContent) {
            activeTab.classList.add('active');
            activeContent.classList.add('active');
        }

        this.currentTab = tabName;

        // タブ固有のデータ読み込み
        this.loadTabSpecificData(tabName);
    }

    async loadTabSpecificData(tabName) {
        switch (tabName) {
            case 'overview':
                // 総合評価ダッシュボードのデータ更新
                await this.loadKPIData();
                break;
            case 'usage':
                // 利用状況ダッシュボードのデータ更新
                if (this.charts.usage) {
                    this.charts.usage.update();
                }
                if (this.charts.userActivity) {
                    this.charts.userActivity.update();
                }
                break;
        }
    }

    showErrorMessage(message) {
        // エラーメッセージの表示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);

        // 5秒後に自動で削除
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    // データ更新メソッド
    refreshData() {
        this.loadDashboardData();
    }

    // チャートのリサイズ処理
    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.resize) {
                chart.resize();
            }
        });
    }
}

// ナビゲーション関数
function navigateTo(path) {
    window.location.href = path;
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    window.mainDashboard = new MainDashboard();
});

// ウィンドウリサイズ時のチャート調整
window.addEventListener('resize', () => {
    if (window.mainDashboard) {
        window.mainDashboard.resizeCharts();
    }
});

// タブ切り替え用グローバル関数
function showTab(tabName) {
    if (window.mainDashboard) {
        window.mainDashboard.showTab(tabName);
    }
}