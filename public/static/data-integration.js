// データ統合管理画面用JavaScript
class DataIntegration {
    constructor() {
        this.flows = {};
        this.alerts = [];
        this.logs = [];
        this.charts = {};
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
        this.initializeCharts();
        this.startRealTimeUpdates();
    }

    setupEventListeners() {
        // ユーザープロフィールドロップダウン
        const profileButton = document.getElementById('profile-button');
        const profileDropdown = document.getElementById('profile-dropdown');

        if (profileButton && profileDropdown) {
            profileButton.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', () => {
                profileDropdown.classList.add('hidden');
            });
        }

        // コントロールボタン
        const addFlowBtn = document.getElementById('add-flow-btn');
        const refreshFlowsBtn = document.getElementById('refresh-flows');

        if (addFlowBtn) {
            addFlowBtn.addEventListener('click', () => this.showAddFlowModal());
        }
        if (refreshFlowsBtn) {
            refreshFlowsBtn.addEventListener('click', () => this.refreshFlows());
        }

        // フィルター
        const logFilter = document.getElementById('log-filter');
        const timeRange = document.getElementById('time-range');

        if (logFilter) {
            logFilter.addEventListener('change', () => this.filterLogs());
        }
        if (timeRange) {
            timeRange.addEventListener('change', () => this.filterLogs());
        }
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadFlows(),
                this.loadAlerts(),
                this.loadLogs(),
                this.updateSystemStatus()
            ]);
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            this.showErrorMessage('データの読み込みに失敗しました。');
        }
    }

    async loadFlows() {
        // シミュレートされたフローデータ
        this.flows = {
            'erp-wms': {
                name: 'ERP → WMS 同期',
                description: '注文データの自動同期',
                schedule: '毎時実行',
                status: 'running',
                lastRun: new Date(Date.now() - 30 * 60 * 1000),
                nextRun: new Date(Date.now() + 30 * 60 * 1000),
                records: 1234,
                avgTime: 4.2
            },
            'wms-tms': {
                name: 'WMS → TMS 同期',
                description: '出荷指示データの連携',
                schedule: '手動実行',
                status: 'stopped',
                lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
                nextRun: null,
                records: 0,
                avgTime: 0
            },
            'tms-report': {
                name: 'TMS → レポート生成',
                description: '配送実績レポート作成',
                schedule: '日次実行',
                status: 'error',
                lastRun: new Date(Date.now() - 1 * 60 * 60 * 1000),
                nextRun: new Date(Date.now() + 23 * 60 * 60 * 1000),
                records: 0,
                avgTime: 0
            }
        };
    }

    async loadAlerts() {
        this.alerts = [
            {
                id: 1,
                type: 'error',
                title: 'TMS接続エラー',
                description: 'タイムアウトにより接続失敗',
                timestamp: new Date(Date.now() - 3 * 60 * 1000),
                icon: 'fas fa-exclamation-circle'
            },
            {
                id: 2,
                type: 'warning',
                title: 'データ遅延',
                description: '同期が5分遅れています',
                timestamp: new Date(Date.now() - 8 * 60 * 1000),
                icon: 'fas fa-exclamation-triangle'
            },
            {
                id: 3,
                type: 'info',
                title: '定期メンテナンス',
                description: '明日2:00-4:00予定',
                timestamp: new Date(Date.now() - 60 * 60 * 1000),
                icon: 'fas fa-info-circle'
            }
        ];
    }

    async loadLogs() {
        this.logs = [
            {
                id: 1,
                timestamp: new Date(Date.now() - 10 * 60 * 1000),
                flow: 'ERP → WMS',
                status: 'success',
                records: 1234,
                duration: 4.2,
                details: '正常に完了'
            },
            {
                id: 2,
                timestamp: new Date(Date.now() - 25 * 60 * 1000),
                flow: 'WMS → TMS',
                status: 'error',
                records: 0,
                duration: null,
                details: '接続タイムアウト'
            },
            {
                id: 3,
                timestamp: new Date(Date.now() - 40 * 60 * 1000),
                flow: 'ERP → WMS',
                status: 'warning',
                records: 987,
                duration: 6.8,
                details: '一部データをスキップ'
            }
        ];

        this.renderLogs();
    }

    async updateSystemStatus() {
        // システム状態のシミュレート
        const systems = [
            { name: 'ERPシステム', status: 'online' },
            { name: 'WMSシステム', status: 'online' },
            { name: 'TMSシステム', status: 'offline' },
            { name: '外部API', status: 'warning' }
        ];

        const container = document.querySelector('.status-indicators');
        if (container) {
            container.innerHTML = systems.map(system => `
                <div class="status-item">
                    <div class="status-dot ${system.status}"></div>
                    <span>${system.name}</span>
                </div>
            `).join('');
        }
    }

    initializeCharts() {
        this.createPerformanceChart();
        this.createQualityCharts();
    }

    createPerformanceChart() {
        const ctx = document.getElementById('performance-chart');
        if (!ctx) return;

        // 過去24時間のパフォーマンスデータ
        const labels = [];
        const data = [];
        for (let i = 23; i >= 0; i--) {
            const time = new Date(Date.now() - i * 60 * 60 * 1000);
            labels.push(time.toLocaleTimeString('ja-JP', { hour: '2-digit' }) + ':00');
            data.push(Math.random() * 50 + 50); // 50-100の範囲でランダム
        }

        this.charts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'システム負荷 (%)',
                    data: data,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        display: false
                    }
                },
                elements: {
                    point: {
                        radius: 0,
                        hoverRadius: 4
                    }
                }
            }
        });
    }

    createQualityCharts() {
        // データ完整性チャート
        const completenessCtx = document.getElementById('completeness-chart');
        if (completenessCtx) {
            this.charts.completeness = new Chart(completenessCtx, {
                type: 'line',
                data: {
                    labels: ['月', '火', '水', '木', '金', '土', '日'],
                    datasets: [{
                        data: [95, 97, 98, 99, 98.5, 97, 98.5],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#10b981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { display: false, min: 90, max: 100 }
                    }
                }
            });
        }

        // データ正確性チャート
        const accuracyCtx = document.getElementById('accuracy-chart');
        if (accuracyCtx) {
            this.charts.accuracy = new Chart(accuracyCtx, {
                type: 'line',
                data: {
                    labels: ['月', '火', '水', '木', '金', '土', '日'],
                    datasets: [{
                        data: [85, 87, 88, 86, 87.2, 89, 87],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#f59e0b'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { display: false, min: 80, max: 95 }
                    }
                }
            });
        }

        // データ一貫性チャート
        const consistencyCtx = document.getElementById('consistency-chart');
        if (consistencyCtx) {
            this.charts.consistency = new Chart(consistencyCtx, {
                type: 'line',
                data: {
                    labels: ['月', '火', '水', '木', '金', '土', '日'],
                    datasets: [{
                        data: [72, 75, 78, 76, 76.8, 79, 77],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#ef4444'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { display: false, min: 70, max: 85 }
                    }
                }
            });
        }
    }

    renderLogs() {
        const tbody = document.querySelector('#logs-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.logs.map(log => `
            <tr>
                <td>${log.timestamp.toLocaleTimeString('ja-JP', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                })}</td>
                <td>${log.flow}</td>
                <td><span class="status-badge ${log.status}">${this.getStatusText(log.status)}</span></td>
                <td>${log.records.toLocaleString()}</td>
                <td>${log.duration ? log.duration + 's' : '-'}</td>
                <td><button class="details-btn" onclick="window.dataIntegration.showLogDetails(${log.id})">詳細</button></td>
            </tr>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            success: '成功',
            error: 'エラー',
            warning: '警告',
            running: '実行中'
        };
        return statusMap[status] || status;
    }

    filterLogs() {
        const filter = document.getElementById('log-filter')?.value || 'all';
        const timeRange = document.getElementById('time-range')?.value || '1d';

        // フィルタリングロジック（シミュレート）
        let filteredLogs = [...this.logs];

        if (filter !== 'all') {
            filteredLogs = filteredLogs.filter(log => log.status === filter);
        }

        // 時間範囲フィルタ
        const now = new Date();
        const cutoff = new Date();
        switch (timeRange) {
            case '1h':
                cutoff.setHours(cutoff.getHours() - 1);
                break;
            case '1d':
                cutoff.setDate(cutoff.getDate() - 1);
                break;
            case '1w':
                cutoff.setDate(cutoff.getDate() - 7);
                break;
        }

        filteredLogs = filteredLogs.filter(log => log.timestamp >= cutoff);

        // フィルタされたログを表示
        const tbody = document.querySelector('#logs-table tbody');
        if (tbody) {
            if (filteredLogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">該当するログがありません</td></tr>';
            } else {
                tbody.innerHTML = filteredLogs.map(log => `
                    <tr>
                        <td>${log.timestamp.toLocaleTimeString('ja-JP', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: '2-digit' 
                        })}</td>
                        <td>${log.flow}</td>
                        <td><span class="status-badge ${log.status}">${this.getStatusText(log.status)}</span></td>
                        <td>${log.records.toLocaleString()}</td>
                        <td>${log.duration ? log.duration + 's' : '-'}</td>
                        <td><button class="details-btn" onclick="window.dataIntegration.showLogDetails(${log.id})">詳細</button></td>
                    </tr>
                `).join('');
            }
        }
    }

    showLogDetails(logId) {
        const log = this.logs.find(l => l.id === logId);
        if (log) {
            alert(`ログ詳細 (ID: ${logId})\\n\\nフロー: ${log.flow}\\nステータス: ${this.getStatusText(log.status)}\\n詳細: ${log.details || '詳細情報なし'}`);
        }
    }

    async refreshFlows() {
        const refreshBtn = document.getElementById('refresh-flows');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>更新中...';
            refreshBtn.disabled = true;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.loadData();
            this.showSuccessMessage('フローデータを更新しました。');
        } catch (error) {
            console.error('フロー更新エラー:', error);
            this.showErrorMessage('フローデータの更新に失敗しました。');
        } finally {
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>更新';
                refreshBtn.disabled = false;
            }
        }
    }

    showAddFlowModal() {
        alert('新しいデータフローの追加機能は開発中です。');
    }

    startRealTimeUpdates() {
        // 30秒ごとにデータを更新
        this.refreshInterval = setInterval(() => {
            this.updateRealTimeData();
        }, 30000);
    }

    async updateRealTimeData() {
        try {
            // システム状態を更新
            await this.updateSystemStatus();
            
            // パフォーマンスチャートを更新
            if (this.charts.performance) {
                const chart = this.charts.performance;
                const newData = Math.random() * 50 + 50;
                chart.data.datasets[0].data.shift();
                chart.data.datasets[0].data.push(newData);
                chart.data.labels.shift();
                chart.data.labels.push(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit' }) + ':' + 
                                     new Date().getMinutes().toString().padStart(2, '0'));
                chart.update('none');
            }

            // 新しいログエントリをシミュレート（10%の確率）
            if (Math.random() < 0.1) {
                this.simulateNewLog();
            }

        } catch (error) {
            console.error('リアルタイム更新エラー:', error);
        }
    }

    simulateNewLog() {
        const flows = ['ERP → WMS', 'WMS → TMS', 'TMS → レポート'];
        const statuses = ['success', 'warning', 'error'];
        
        const newLog = {
            id: Date.now(),
            timestamp: new Date(),
            flow: flows[Math.floor(Math.random() * flows.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            records: Math.floor(Math.random() * 2000),
            duration: Math.random() * 10 + 1,
            details: 'リアルタイム更新'
        };

        this.logs.unshift(newLog);
        if (this.logs.length > 50) {
            this.logs = this.logs.slice(0, 50); // 最新50件を保持
        }

        this.renderLogs();
    }

    showErrorMessage(message) {
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

        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        successDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-check mr-2"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.body.appendChild(successDiv);

        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.remove();
            }
        }, 3000);
    }

    // クリーンアップメソッド
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// フロー操作用グローバル関数
function toggleFlow(flowId) {
    if (window.dataIntegration) {
        const flow = window.dataIntegration.flows[flowId];
        if (flow) {
            if (flow.status === 'running') {
                flow.status = 'stopped';
                window.dataIntegration.showSuccessMessage(`${flow.name} を停止しました。`);
            } else {
                flow.status = 'running';
                window.dataIntegration.showSuccessMessage(`${flow.name} を開始しました。`);
            }
            // UIを更新（実際の実装では、flowItemの更新が必要）
        }
    }
}

function editFlow(flowId) {
    alert(`フロー "${flowId}" の編集機能は開発中です。`);
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    window.dataIntegration = new DataIntegration();
});

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.dataIntegration) {
        window.dataIntegration.destroy();
    }
});