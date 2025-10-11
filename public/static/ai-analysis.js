// AI分析・チャット画面用JavaScript
class AIAnalysis {
    constructor() {
        this.charts = {};
        this.chatMessages = [];
        this.isTyping = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadAnalysisData();
        this.initializeCharts();
        this.setupChat();
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

        // 分析データ更新
        const refreshBtn = document.getElementById('refresh-analysis');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshAnalysis();
            });
        }

        // 予測期間変更
        const predictionPeriod = document.getElementById('prediction-period');
        if (predictionPeriod) {
            predictionPeriod.addEventListener('change', (e) => {
                this.updatePredictionPeriod(e.target.value);
            });
        }

        // チャット関連
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            chatInput.addEventListener('input', () => {
                const hasText = chatInput.value.trim().length > 0;
                sendBtn.disabled = !hasText;
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // ファイル添付
        const attachBtn = document.getElementById('attach-btn');
        if (attachBtn) {
            attachBtn.addEventListener('click', () => {
                this.handleFileAttach();
            });
        }
    }

    async loadAnalysisData() {
        try {
            // コスト分析データの読み込み
            await this.loadCostAnalysis();
            
            // 予測分析データの読み込み
            await this.loadPredictionAnalysis();
            
            // 分析結果の更新
            this.updateAnalysisResults();
            
        } catch (error) {
            console.error('分析データの読み込みエラー:', error);
            this.showErrorMessage('分析データの読み込みに失敗しました。');
        }
    }

    initializeCharts() {
        this.createCostAnalysisChart();
        this.createPredictionChart();
    }

    createCostAnalysisChart() {
        const ctx = document.getElementById('cost-analysis-chart');
        if (!ctx) return;

        this.charts.costAnalysis = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
                datasets: [{
                    label: '実績コスト',
                    data: [120, 115, 125, 130, 118, 125],
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'AI最適化コスト',
                    data: [102, 98, 106, 111, 100, 106],
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
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
                        text: 'コスト分析 - 実績 vs AI最適化'
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
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    createPredictionChart() {
        const ctx = document.getElementById('prediction-chart');
        if (!ctx) return;

        this.charts.prediction = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['7月', '8月', '9月', '10月', '11月', '12月'],
                datasets: [{
                    label: '予測値',
                    data: [122, 128, 124, 135, 140, 138],
                    borderColor: 'rgb(139, 92, 246)',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }, {
                    label: '信頼区間（上限）',
                    data: [130, 136, 132, 143, 148, 146],
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [2, 2],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }, {
                    label: '信頼区間（下限）',
                    data: [114, 120, 116, 127, 132, 130],
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [2, 2],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
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
                        text: 'コスト予測分析（3ヶ月間）'
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
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    async loadCostAnalysis() {
        // シミュレートされたコスト分析データ
        const costData = {
            currentMonth: 125,
            lastMonth: 130,
            avgReduction: 15.2,
            topSavings: [
                { route: 'A-B配送ルート', savings: 18.5 },
                { route: 'C-D配送ルート', savings: 12.3 },
                { route: 'E-F配送ルート', savings: 9.7 }
            ]
        };

        return costData;
    }

    async loadPredictionAnalysis() {
        // シミュレートされた予測分析データ
        const predictionData = {
            nextMonth: { value: 122, confidence: 92 },
            quarterAvg: { value: 129, confidence: 88 },
            yearEnd: { value: 135, confidence: 85 }
        };

        return predictionData;
    }

    updateAnalysisResults() {
        // 分析結果を動的に更新（既存の結果に追加）
        const resultsContainer = document.getElementById('analysis-results');
        if (!resultsContainer) return;

        // 新しい洞察を追加
        const newInsights = [
            {
                type: 'positive',
                icon: 'fas fa-chart-line',
                title: '効率改善の機会',
                desc: '配送スケジュールの最適化により、さらに8%の改善が見込めます'
            }
        ];

        newInsights.forEach(insight => {
            const insightElement = document.createElement('div');
            insightElement.className = 'insight-item';
            insightElement.innerHTML = `
                <div class="insight-icon ${insight.type}">
                    <i class="${insight.icon}"></i>
                </div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-desc">${insight.desc}</div>
                </div>
            `;
            resultsContainer.appendChild(insightElement);
        });
    }

    updatePredictionPeriod(months) {
        // 予測期間に応じてチャートデータを更新
        const labels = {
            '1': ['来月'],
            '3': ['7月', '8月', '9月'],
            '6': ['7月', '8月', '9月', '10月', '11月', '12月']
        };

        const data = {
            '1': [122],
            '3': [122, 128, 124],
            '6': [122, 128, 124, 135, 140, 138]
        };

        if (this.charts.prediction) {
            this.charts.prediction.data.labels = labels[months];
            this.charts.prediction.data.datasets[0].data = data[months];
            this.charts.prediction.update();
        }
    }

    async refreshAnalysis() {
        const refreshBtn = document.getElementById('refresh-analysis');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 更新中...';
            refreshBtn.disabled = true;
        }

        try {
            // 新しいデータを読み込み
            await new Promise(resolve => setTimeout(resolve, 1500)); // シミュレートされた遅延
            
            await this.loadAnalysisData();
            
            // チャートを更新
            if (this.charts.costAnalysis) {
                this.charts.costAnalysis.update();
            }
            if (this.charts.prediction) {
                this.charts.prediction.update();
            }

        } catch (error) {
            console.error('分析更新エラー:', error);
            this.showErrorMessage('分析データの更新に失敗しました。');
        } finally {
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 更新';
                refreshBtn.disabled = false;
            }
        }
    }

    // チャット機能
    setupChat() {
        this.chatMessages = [];
        this.scrollToBottom();
    }

    sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message || this.isTyping) return;

        // ユーザーメッセージを表示
        this.addMessage('user', message);
        input.value = '';
        
        // AI応答を生成
        this.generateAIResponse(message);
    }

    sendQuickQuestion(question) {
        const input = document.getElementById('chat-input');
        input.value = question;
        this.sendMessage();
    }

    addMessage(sender, text) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}`;
        
        const time = new Date().toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const avatarIcon = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';

        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="${avatarIcon}"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${text}</div>
                <div class="message-time">${time}</div>
            </div>
        `;

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();

        this.chatMessages.push({
            sender,
            text,
            timestamp: new Date()
        });
    }

    async generateAIResponse(userMessage) {
        this.showTypingIndicator();
        
        // シミュレートされた遅延
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        const responses = this.getAIResponse(userMessage);
        
        this.hideTypingIndicator();
        this.addMessage('assistant', responses);
    }

    getAIResponse(message) {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('コスト') || lowerMessage.includes('削減')) {
            return `コスト削減についてお答えします。<br><br>
                   現在の分析結果によると、以下の改善策が効果的です：<br>
                   • 配送ルートの最適化：月間15%のコスト削減<br>
                   • 積載率の向上：月間8%のコスト削減<br>
                   • 燃料効率の改善：月間5%のコスト削減<br><br>
                   詳細な分析レポートをご希望でしたら、お知らせください。`;
        }

        if (lowerMessage.includes('効率') || lowerMessage.includes('改善')) {
            return `配送効率の改善についてご説明します。<br><br>
                   AI分析により特定された改善点：<br>
                   • 配送時間のばらつきを25%削減可能<br>
                   • 待機時間を平均30分短縮可能<br>
                   • 配送成功率を98%まで向上可能<br><br>
                   具体的な実施計画についてお聞かせしますか？`;
        }

        if (lowerMessage.includes('分析') || lowerMessage.includes('データ')) {
            return `最新のデータ分析結果をお伝えします。<br><br>
                   【今月のハイライト】<br>
                   • 総コスト：125万円（前月比-3.8%）<br>
                   • 配送効率：87.3%（前月比+2.1%）<br>
                   • 顧客満足度：4.2/5（前月比+0.3）<br><br>
                   特定の指標について詳しく知りたい項目はありますか？`;
        }

        if (lowerMessage.includes('リスク')) {
            return `現在のリスク要因を分析いたします。<br><br>
                   【特定されたリスク】<br>
                   • 配送遅延リスク：中程度（天候による影響）<br>
                   • コスト増加リスク：低程度（燃料価格の変動）<br>
                   • 品質リスク：低程度（梱包プロセスの改善により軽減）<br><br>
                   各リスクの対策についてお聞きになりますか？`;
        }

        // デフォルトレスポンス
        return `ご質問ありがとうございます。<br><br>
               物流データの分析に関して、以下のようなサポートを提供できます：<br>
               • コスト分析と削減提案<br>
               • 配送効率の最適化<br>
               • リスク評価と対策<br>
               • 予測分析とトレンド把握<br><br>
               具体的にどの分野について詳しく知りたいでしょうか？`;
    }

    showTypingIndicator() {
        if (this.isTyping) return;
        
        this.isTyping = true;
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const typingElement = document.createElement('div');
        typingElement.className = 'typing-indicator';
        typingElement.id = 'typing-indicator';
        typingElement.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        messagesContainer.appendChild(typingElement);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
    }

    handleFileAttach() {
        // ファイル添付機能（将来実装）
        alert('ファイル添付機能は近日実装予定です。');
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
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
}

// クイック質問送信用グローバル関数
function sendQuickQuestion(question) {
    if (window.aiAnalysis) {
        window.aiAnalysis.sendQuickQuestion(question);
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    window.aiAnalysis = new AIAnalysis();
});

// ウィンドウリサイズ時のチャート調整
window.addEventListener('resize', () => {
    if (window.aiAnalysis && window.aiAnalysis.charts) {
        Object.values(window.aiAnalysis.charts).forEach(chart => {
            if (chart && chart.resize) {
                chart.resize();
            }
        });
    }
});