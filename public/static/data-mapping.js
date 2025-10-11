// データマッピング画面用JavaScript
class DataMapping {
    constructor() {
        this.currentSource = 'erp';
        this.mappingData = {};
        this.transformationRules = [];
        this.previewData = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadMappingData();
        this.loadTransformationRules();
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

        // データソース選択
        document.querySelectorAll('.source-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectSource(card.dataset.source);
            });
        });

        // ソース選択ドロップダウン
        const sourceSelector = document.getElementById('source-selector');
        if (sourceSelector) {
            sourceSelector.addEventListener('change', (e) => {
                this.selectSource(e.target.value);
            });
        }

        // コントロールボタン
        const addSourceBtn = document.getElementById('add-source-btn');
        const refreshBtn = document.getElementById('refresh-mapping');
        const addRuleBtn = document.getElementById('add-rule-btn');
        const previewBtn = document.getElementById('preview-btn');
        const validateBtn = document.getElementById('validate-btn');

        if (addSourceBtn) {
            addSourceBtn.addEventListener('click', () => this.showAddSourceModal());
        }
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshMapping());
        }
        if (addRuleBtn) {
            addRuleBtn.addEventListener('click', () => this.addTransformationRule());
        }
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.runPreview());
        }
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateMapping());
        }

        // プレビュータブ
        document.querySelectorAll('.preview-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.showPreviewTab(tab.dataset.tab);
            });
        });
    }

    selectSource(sourceId) {
        this.currentSource = sourceId;
        
        // ソースカードのアクティブ状態を更新
        document.querySelectorAll('.source-card').forEach(card => {
            card.classList.toggle('active', card.dataset.source === sourceId);
        });

        // ソース選択ドロップダウンを更新
        const selector = document.getElementById('source-selector');
        if (selector) {
            selector.value = sourceId;
        }

        // マッピング設定を読み込み
        this.loadFieldMapping(sourceId);
    }

    async loadMappingData() {
        try {
            // シミュレートされたマッピングデータ
            this.mappingData = {
                erp: {
                    fields: [
                        { source: 'order_id', target: 'OrderID', type: 'string' },
                        { source: 'product_code', target: 'ProductCode', type: 'string' },
                        { source: 'quantity', target: 'Quantity', type: 'integer' },
                        { source: 'delivery_address', target: 'DeliveryAddress', type: 'string' },
                        { source: 'status', target: 'Status', type: 'string' }
                    ]
                },
                wms: {
                    fields: [
                        { source: 'warehouse_id', target: 'WarehouseID', type: 'string' },
                        { source: 'product_id', target: 'ProductCode', type: 'string' },
                        { source: 'stock_level', target: 'StockLevel', type: 'integer' },
                        { source: 'location', target: 'StorageLocation', type: 'string' },
                        { source: 'last_updated', target: 'LastUpdated', type: 'datetime' }
                    ]
                },
                tms: {
                    fields: [
                        { source: 'shipment_id', target: 'ShipmentID', type: 'string' },
                        { source: 'vehicle_id', target: 'VehicleID', type: 'string' },
                        { source: 'driver_name', target: 'DriverName', type: 'string' },
                        { source: 'route', target: 'Route', type: 'string' },
                        { source: 'departure_time', target: 'DepartureTime', type: 'datetime' }
                    ]
                }
            };

            // 初期ソースのマッピングを表示
            this.loadFieldMapping(this.currentSource);

        } catch (error) {
            console.error('マッピングデータの読み込みエラー:', error);
            this.showErrorMessage('マッピングデータの読み込みに失敗しました。');
        }
    }

    loadFieldMapping(sourceId) {
        const container = document.getElementById('field-mapping-container');
        if (!container) return;

        const sourceData = this.mappingData[sourceId];
        if (!sourceData) {
            container.innerHTML = '<div class="loading-message">データソースが選択されていません</div>';
            return;
        }

        const targetFields = [
            'OrderID', 'ProductCode', 'Quantity', 'DeliveryAddress', 'Status',
            'WarehouseID', 'StockLevel', 'StorageLocation', 'LastUpdated',
            'ShipmentID', 'VehicleID', 'DriverName', 'Route', 'DepartureTime'
        ];

        container.innerHTML = sourceData.fields.map((field, index) => `
            <div class="field-mapping-item fade-in">
                <input type="text" class="field-source" value="${field.source}" readonly>
                <i class="field-arrow fas fa-arrow-right"></i>
                <div class="field-target">
                    <select onchange="window.dataMapping.updateFieldMapping(${index}, this.value)">
                        <option value="">マッピングなし</option>
                        ${targetFields.map(target => `
                            <option value="${target}" ${field.target === target ? 'selected' : ''}>${target}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="field-actions">
                    <button class="field-remove" onclick="window.dataMapping.removeFieldMapping(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateFieldMapping(index, targetField) {
        const sourceData = this.mappingData[this.currentSource];
        if (sourceData && sourceData.fields[index]) {
            sourceData.fields[index].target = targetField;
        }
    }

    removeFieldMapping(index) {
        const sourceData = this.mappingData[this.currentSource];
        if (sourceData && sourceData.fields[index]) {
            sourceData.fields.splice(index, 1);
            this.loadFieldMapping(this.currentSource);
        }
    }

    async loadTransformationRules() {
        // シミュレートされた変換ルール
        this.transformationRules = [
            {
                id: 1,
                type: 'データ変換',
                field: 'status',
                description: 'ステータスを日本語に変換',
                rule: 'processing → 処理中, shipped → 配送中, delivered → 配送完了',
                example: 'processing → 処理中'
            },
            {
                id: 2,
                type: 'データ検証',
                field: 'quantity',
                description: '数量の範囲チェック',
                rule: '1以上1000以下の値のみ許可',
                example: '数量 < 1 または > 1000 の場合エラー'
            },
            {
                id: 3,
                type: '日時形式',
                field: 'last_updated',
                description: '日時形式の統一',
                rule: 'ISO 8601形式に変換',
                example: '2024-01-15T14:30:00Z'
            }
        ];

        this.renderTransformationRules();
    }

    renderTransformationRules() {
        const container = document.getElementById('transformation-rules');
        if (!container) return;

        container.innerHTML = this.transformationRules.map(rule => `
            <div class="transformation-rule slide-up">
                <div class="rule-header">
                    <span class="rule-type">${rule.type}</span>
                    <div class="rule-actions">
                        <button class="rule-edit" onclick="window.dataMapping.editRule(${rule.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="rule-delete" onclick="window.dataMapping.deleteRule(${rule.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="rule-content">
                    <strong>${rule.field}</strong>: ${rule.description}<br>
                    <small>ルール: ${rule.rule}</small>
                </div>
                <div class="rule-example">
                    例: ${rule.example}
                </div>
            </div>
        `).join('');
    }

    addTransformationRule() {
        const newRule = {
            id: Date.now(),
            type: 'カスタム',
            field: 'new_field',
            description: '新しい変換ルール',
            rule: '設定が必要',
            example: '例を追加してください'
        };

        this.transformationRules.push(newRule);
        this.renderTransformationRules();
    }

    editRule(ruleId) {
        // ルール編集機能（モーダルで実装予定）
        alert(`ルール ID ${ruleId} の編集機能は開発中です。`);
    }

    deleteRule(ruleId) {
        if (confirm('このルールを削除しますか？')) {
            this.transformationRules = this.transformationRules.filter(rule => rule.id !== ruleId);
            this.renderTransformationRules();
        }
    }

    initializePreview() {
        this.previewData = {
            source: [
                {
                    order_id: 'ORD-2024-001',
                    product_code: 'PROD-A001',
                    quantity: 50,
                    delivery_address: '東京都渋谷区',
                    status: 'processing'
                },
                {
                    order_id: 'ORD-2024-002',
                    product_code: 'PROD-B002',
                    quantity: 25,
                    delivery_address: '大阪府大阪市',
                    status: 'shipped'
                }
            ],
            transformed: [],
            errors: []
        };
    }

    showPreviewTab(tabName) {
        // タブの切り替え
        document.querySelectorAll('.preview-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        document.querySelectorAll('.preview-table-container').forEach(container => {
            container.classList.toggle('active', container.id === `${tabName}-preview`);
        });
    }

    async runPreview() {
        const previewBtn = document.getElementById('preview-btn');
        if (previewBtn) {
            previewBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>プレビュー実行中...';
            previewBtn.disabled = true;
        }

        try {
            // シミュレートされた遅延
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 変換後データを生成
            this.previewData.transformed = this.previewData.source.map(item => {
                const transformed = {};
                const sourceData = this.mappingData[this.currentSource];
                
                if (sourceData) {
                    sourceData.fields.forEach(field => {
                        if (field.target && item[field.source] !== undefined) {
                            let value = item[field.source];
                            
                            // 変換ルールを適用
                            if (field.source === 'status') {
                                const statusMap = {
                                    'processing': '処理中',
                                    'shipped': '配送中',
                                    'delivered': '配送完了'
                                };
                                value = statusMap[value] || value;
                            }
                            
                            transformed[field.target] = value;
                        }
                    });
                }
                
                return transformed;
            });

            // 変換後データテーブルを更新
            this.updateTransformedPreview();

            // エラー・警告を生成
            this.generateValidationResults();

        } catch (error) {
            console.error('プレビュー実行エラー:', error);
            this.showErrorMessage('プレビューの実行に失敗しました。');
        } finally {
            if (previewBtn) {
                previewBtn.innerHTML = '<i class="fas fa-play mr-2"></i>プレビュー実行';
                previewBtn.disabled = false;
            }
        }
    }

    updateTransformedPreview() {
        const container = document.getElementById('transformed-preview');
        if (!container || !this.previewData.transformed.length) return;

        const firstItem = this.previewData.transformed[0];
        const headers = Object.keys(firstItem);

        container.innerHTML = `
            <table class="preview-table">
                <thead>
                    <tr>
                        ${headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${this.previewData.transformed.map(item => `
                        <tr>
                            ${headers.map(header => `<td>${item[header] || ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    generateValidationResults() {
        const errors = [
            {
                type: 'warning',
                title: 'データ型不一致',
                description: '数量フィールドに文字列が含まれています（2件）',
                icon: 'fas fa-exclamation-triangle'
            },
            {
                type: 'info',
                title: '変換成功',
                description: 'ステータスフィールドが正常に日本語に変換されました',
                icon: 'fas fa-info-circle'
            },
            {
                type: 'error',
                title: '必須フィールド不足',
                description: 'DeliveryAddressがマッピングされていません',
                icon: 'fas fa-times-circle'
            }
        ];

        const container = document.querySelector('#errors-preview .error-list');
        if (container) {
            container.innerHTML = errors.map(error => `
                <div class="error-item ${error.type}">
                    <i class="error-icon ${error.icon}"></i>
                    <div class="error-content">
                        <div class="error-title">${error.title}</div>
                        <div class="error-description">${error.description}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    async validateMapping() {
        const validateBtn = document.getElementById('validate-btn');
        if (validateBtn) {
            validateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>検証中...';
            validateBtn.disabled = true;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.generateValidationResults();
            this.showPreviewTab('errors');

        } catch (error) {
            console.error('検証エラー:', error);
            this.showErrorMessage('マッピングの検証に失敗しました。');
        } finally {
            if (validateBtn) {
                validateBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>検証';
                validateBtn.disabled = false;
            }
        }
    }

    async refreshMapping() {
        const refreshBtn = document.getElementById('refresh-mapping');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>更新中...';
            refreshBtn.disabled = true;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await this.loadMappingData();
            await this.loadTransformationRules();
            this.initializePreview();

        } catch (error) {
            console.error('マッピング更新エラー:', error);
            this.showErrorMessage('マッピングデータの更新に失敗しました。');
        } finally {
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>更新';
                refreshBtn.disabled = false;
            }
        }
    }

    showAddSourceModal() {
        // 新しいソース追加モーダル（将来実装）
        alert('新しいデータソースの追加機能は開発中です。');
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
        }, 5000);
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    window.dataMapping = new DataMapping();
});