// レポート管理画面用JavaScript
class ReportManagement {
    constructor() {
        this.reports = [];
        this.currentReport = null;
        this.previewChart = null;
        this.automationRules = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSavedReports();
        this.loadAutomationRules();
        this.initializePreview();
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

        // レポート作成・管理ボタン
        const createReportBtn = document.getElementById('create-report-btn');
        const templateBtn = document.getElementById('template-btn');
        const previewReportBtn = document.getElementById('preview-report');
        const saveReportBtn = document.getElementById('save-report');

        if (createReportBtn) {
            createReportBtn.addEventListener('click', () => this.createNewReport());
        }
        if (templateBtn) {
            templateBtn.addEventListener('click', () => this.showTemplates());
        }
        if (previewReportBtn) {
            previewReportBtn.addEventListener('click', () => this.generatePreview());
        }
        if (saveReportBtn) {
            saveReportBtn.addEventListener('click', () => this.saveCurrentReport());
        }

        // エクスポートボタン
        const exportPdfBtn = document.getElementById('export-pdf');
        const exportExcelBtn = document.getElementById('export-excel');
        const shareReportBtn = document.getElementById('share-report');

        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportToPDF());
        }
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        }
        if (shareReportBtn) {
            shareReportBtn.addEventListener('click', () => this.shareReport());
        }

        // 自動化設定
        const addAutomationBtn = document.getElementById('add-automation-btn');
        if (addAutomationBtn) {
            addAutomationBtn.addEventListener('click', () => this.addAutomationRule());
        }

        // チャートタイプ選択
        document.querySelectorAll('.chart-type-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectChartType(item.dataset.type);
            });
        });

        // フィルター
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.filterReports());
        }

        // レポート設定の変更監視
        const configInputs = document.querySelectorAll('.config-input, .config-select');
        configInputs.forEach(input => {
            input.addEventListener('change', () => this.updateReportConfig());
        });

        // フィールド選択の変更監視
        document.querySelectorAll('.field-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSelectedFields());
        });
    }

    async loadSavedReports() {
        // シミュレートされた保存済みレポート
        this.reports = [
            {
                id: 1,
                name: '日次コストレポート',
                category: 'cost',
                type: 'line',
                dataSource: 'all',
                dateRange: 'last7days',
                fields: ['cost', 'orders'],
                createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000)
            },
            {
                id: 2,
                name: '配送パフォーマンス分析',
                category: 'performance',
                type: 'bar',
                dataSource: 'tms',
                dateRange: 'last30days',
                fields: ['delivery', 'efficiency', 'quality'],
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                lastModified: new Date(Date.now() - 24 * 60 * 60 * 1000)
            },
            {
                id: 3,
                name: '月次総合レポート',
                category: 'logistics',
                type: 'pie',
                dataSource: 'all',
                dateRange: 'last90days',
                fields: ['cost', 'orders', 'satisfaction'],
                createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
            }
        ];

        this.renderReportsList();
    }

    renderReportsList() {
        const container = document.getElementById('reports-list');
        if (!container) return;

        const categoryFilter = document.getElementById('category-filter')?.value || 'all';
        const filteredReports = categoryFilter === 'all' 
            ? this.reports 
            : this.reports.filter(report => report.category === categoryFilter);

        container.innerHTML = filteredReports.map(report => `
            <div class="report-item fade-in" data-report-id="${report.id}" onclick="window.reportManagement.loadReport(${report.id})">
                <div class="report-icon">
                    <i class="fas fa-${this.getReportIcon(report.type)}"></i>
                </div>
                <div class="report-info">
                    <div class="report-name">${report.name}</div>
                    <div class="report-category">${this.getCategoryText(report.category)}</div>
                    <div class="report-date">
                        更新: ${report.lastModified.toLocaleDateString('ja-JP')}
                    </div>
                </div>
                <div class="report-actions">
                    <button class="report-action" onclick="event.stopPropagation(); window.reportManagement.editReport(${report.id})" title="編集">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="report-action" onclick="event.stopPropagation(); window.reportManagement.duplicateReport(${report.id})" title="複製">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="report-action" onclick="event.stopPropagation(); window.reportManagement.deleteReport(${report.id})" title="削除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getReportIcon(type) {
        const icons = {
            line: 'chart-line',
            bar: 'chart-bar',
            pie: 'chart-pie',
            table: 'table'
        };
        return icons[type] || 'file-alt';
    }

    getCategoryText(category) {
        const categories = {
            logistics: '物流分析',
            cost: 'コスト分析',
            performance: 'パフォーマンス',
            custom: 'カスタム'
        };
        return categories[category] || category;
    }

    filterReports() {
        this.renderReportsList();
    }

    loadReport(reportId) {
        const report = this.reports.find(r => r.id === reportId);
        if (!report) return;

        this.currentReport = report;

        // レポート設定をフォームに反映
        document.getElementById('report-name').value = report.name;
        document.getElementById('report-category').value = report.category;
        document.getElementById('data-source').value = report.dataSource;
        document.getElementById('date-range').value = report.dateRange;

        // チャートタイプを選択
        this.selectChartType(report.type);

        // フィールド選択を反映
        document.querySelectorAll('.field-item input[type="checkbox"]').forEach(checkbox => {
            const fieldId = checkbox.id.replace('field-', '');
            checkbox.checked = report.fields.includes(fieldId);
        });

        // アクティブ状態を更新
        document.querySelectorAll('.report-item').forEach(item => {
            item.classList.toggle('active', item.dataset.reportId == reportId);
        });

        this.generatePreview();
    }

    selectChartType(type) {
        document.querySelectorAll('.chart-type-item').forEach(item => {
            item.classList.toggle('active', item.dataset.type === type);
        });
    }

    updateReportConfig() {
        // リアルタイムでプレビューを更新
        if (this.currentReport) {
            this.generatePreview();
        }
    }

    updateSelectedFields() {
        // 選択されたフィールドに基づいてプレビューを更新
        if (this.currentReport) {
            this.generatePreview();
        }
    }

    createNewReport() {
        this.currentReport = {
            id: Date.now(),
            name: '新しいレポート',
            category: 'logistics',
            type: 'line',
            dataSource: 'all',
            dateRange: 'last7days',
            fields: ['cost', 'orders'],
            createdAt: new Date(),
            lastModified: new Date()
        };

        // フォームをクリア
        document.getElementById('report-name').value = '';
        document.getElementById('report-category').value = 'logistics';
        document.getElementById('data-source').value = 'all';
        document.getElementById('date-range').value = 'last7days';

        // チャートタイプをリセット
        this.selectChartType('line');

        // フィールド選択をリセット
        document.querySelectorAll('.field-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = ['cost', 'orders'].includes(checkbox.id.replace('field-', ''));
        });

        // アクティブ状態をクリア
        document.querySelectorAll('.report-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    async saveCurrentReport() {
        const saveBtn = document.getElementById('save-report');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>保存中...';
            saveBtn.disabled = true;
        }

        try {
            // フォームから設定を取得
            const reportConfig = {
                name: document.getElementById('report-name').value || '無題のレポート',
                category: document.getElementById('report-category').value,
                dataSource: document.getElementById('data-source').value,
                dateRange: document.getElementById('date-range').value,
                type: document.querySelector('.chart-type-item.active')?.dataset.type || 'line',
                fields: Array.from(document.querySelectorAll('.field-item input[type="checkbox"]:checked'))
                    .map(cb => cb.id.replace('field-', ''))
            };

            // シミュレートされた保存処理
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (this.currentReport && this.currentReport.id) {
                // 既存レポートの更新
                const reportIndex = this.reports.findIndex(r => r.id === this.currentReport.id);
                if (reportIndex !== -1) {
                    this.reports[reportIndex] = {
                        ...this.reports[reportIndex],
                        ...reportConfig,
                        lastModified: new Date()
                    };
                }
            } else {
                // 新規レポートの保存
                const newReport = {
                    id: Date.now(),
                    ...reportConfig,
                    createdAt: new Date(),
                    lastModified: new Date()
                };
                this.reports.unshift(newReport);
                this.currentReport = newReport;
            }

            this.renderReportsList();
            this.showSuccessMessage('レポートを保存しました。');

        } catch (error) {
            console.error('レポート保存エラー:', error);
            this.showErrorMessage('レポートの保存に失敗しました。');
        } finally {
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>保存';
                saveBtn.disabled = false;
            }
        }
    }

    editReport(reportId) {
        this.loadReport(reportId);
    }

    duplicateReport(reportId) {
        const report = this.reports.find(r => r.id === reportId);
        if (report) {
            const duplicatedReport = {
                ...report,
                id: Date.now(),
                name: report.name + ' (コピー)',
                createdAt: new Date(),
                lastModified: new Date()
            };
            this.reports.unshift(duplicatedReport);
            this.renderReportsList();
            this.showSuccessMessage('レポートを複製しました。');
        }
    }

    deleteReport(reportId) {
        if (confirm('このレポートを削除しますか？')) {
            this.reports = this.reports.filter(r => r.id !== reportId);
            this.renderReportsList();
            
            if (this.currentReport && this.currentReport.id === reportId) {
                this.currentReport = null;
            }
            
            this.showSuccessMessage('レポートを削除しました。');
        }
    }

    showTemplates() {
        alert('レポートテンプレート機能は開発中です。');
    }

    initializePreview() {
        this.generatePreview();
    }

    async generatePreview() {
        const previewBtn = document.getElementById('preview-report');
        if (previewBtn) {
            previewBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>生成中...';
            previewBtn.disabled = true;
        }

        try {
            // シミュレートされた遅延
            await new Promise(resolve => setTimeout(resolve, 800));

            const chartType = document.querySelector('.chart-type-item.active')?.dataset.type || 'line';
            const selectedFields = Array.from(document.querySelectorAll('.field-item input[type="checkbox"]:checked'))
                .map(cb => cb.id.replace('field-', ''));

            this.updatePreviewChart(chartType, selectedFields);

        } catch (error) {
            console.error('プレビュー生成エラー:', error);
            this.showErrorMessage('プレビューの生成に失敗しました。');
        } finally {
            if (previewBtn) {
                previewBtn.innerHTML = '<i class="fas fa-eye mr-2"></i>プレビュー';
                previewBtn.disabled = false;
            }
        }
    }

    updatePreviewChart(chartType, selectedFields) {
        const ctx = document.getElementById('preview-chart');
        if (!ctx) return;

        // 既存チャートを破棄
        if (this.previewChart) {
            this.previewChart.destroy();
        }

        // サンプルデータ生成
        const labels = ['1月', '2月', '3月', '4月', '5月', '6月'];
        const datasets = this.generateDatasets(selectedFields);

        const config = {
            type: chartType,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: document.getElementById('report-name')?.value || 'レポートプレビュー'
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: chartType === 'pie' ? {} : {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };

        this.previewChart = new Chart(ctx, config);
    }

    generateDatasets(selectedFields) {
        const fieldConfigs = {
            cost: { 
                label: '総コスト (万円)', 
                color: '#3b82f6',
                data: [120, 115, 125, 130, 118, 125]
            },
            orders: { 
                label: '注文数', 
                color: '#10b981',
                data: [45, 52, 48, 58, 42, 55]
            },
            delivery: { 
                label: '配送時間 (時間)', 
                color: '#f59e0b',
                data: [4.2, 3.8, 4.5, 4.1, 3.9, 4.0]
            },
            efficiency: { 
                label: '効率性 (%)', 
                color: '#8b5cf6',
                data: [85, 87, 84, 89, 91, 88]
            },
            quality: { 
                label: '品質スコア', 
                color: '#ef4444',
                data: [92, 94, 91, 95, 93, 94]
            },
            satisfaction: { 
                label: '顧客満足度', 
                color: '#06b6d4',
                data: [4.2, 4.1, 4.3, 4.5, 4.4, 4.6]
            }
        };

        return selectedFields.map(field => {
            const config = fieldConfigs[field];
            if (!config) return null;

            return {
                label: config.label,
                data: config.data,
                borderColor: config.color,
                backgroundColor: config.color + '20',
                borderWidth: 2,
                fill: false
            };
        }).filter(Boolean);
    }

    exportToPDF() {
        alert('PDF出力機能は開発中です。');
    }

    exportToExcel() {
        alert('Excel出力機能は開発中です。');
    }

    shareReport() {
        alert('レポート共有機能は開発中です。');
    }

    async loadAutomationRules() {
        this.automationRules = [
            {
                id: 1,
                name: '日次コストレポート',
                description: '毎日9:00に前日のコスト分析レポートを自動生成',
                schedule: '毎日 09:00',
                active: true,
                reportId: 1
            },
            {
                id: 2,
                name: '週次パフォーマンスレポート',
                description: '毎週月曜日に前週のパフォーマンス分析を自動生成',
                schedule: '毎週月曜日 10:00',
                active: false,
                reportId: 2
            }
        ];
    }

    addAutomationRule() {
        alert('新しい自動レポートルールの追加機能は開発中です。');
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
}

// 自動化ルール管理用グローバル関数
function editAutomation(ruleId) {
    alert(`自動化ルール ID ${ruleId} の編集機能は開発中です。`);
}

function toggleAutomation(ruleId) {
    if (window.reportManagement) {
        const rule = window.reportManagement.automationRules.find(r => r.id === ruleId);
        if (rule) {
            rule.active = !rule.active;
            const statusText = rule.active ? 'を有効にしました' : 'を無効にしました';
            window.reportManagement.showSuccessMessage(`${rule.name}${statusText}。`);
        }
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    window.reportManagement = new ReportManagement();
});

// ウィンドウリサイズ時のチャート調整
window.addEventListener('resize', () => {
    if (window.reportManagement && window.reportManagement.previewChart) {
        window.reportManagement.previewChart.resize();
    }
});