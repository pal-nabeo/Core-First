// PAL物流SaaS ログイン画面JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // DOM要素の取得
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const loadingBtn = document.getElementById('loading-btn');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const togglePassword = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    const tenantDisplay = document.getElementById('tenant-display');

    // サブドメインから企業情報を取得
    let currentTenant = null;
    async function loadTenantInfo() {
        try {
            const response = await fetch('/api/tenant/info', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.tenant) {
                    currentTenant = result.tenant;
                    tenantDisplay.textContent = `${result.tenant.name} (${result.tenant.subdomain})`;
                } else {
                    tenantDisplay.textContent = 'テナント情報が見つかりません';
                    tenantDisplay.parentElement.className = 'mb-4 p-3 bg-red-50 border border-red-200 rounded-md';
                    tenantDisplay.parentElement.querySelector('span').className = 'text-red-700';
                }
            } else {
                tenantDisplay.textContent = 'テナント情報の取得に失敗しました';
            }
        } catch (error) {
            console.error('Tenant info error:', error);
            tenantDisplay.textContent = 'デフォルトテナント (demo-company)';
        }
    }

    // 初期化時にテナント情報を取得
    loadTenantInfo();

    // パスワード表示切替
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        const icon = this.querySelector('i');
        if (type === 'password') {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        } else {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    });

    // エラー表示関数
    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
        
        // 3秒後に自動的に非表示
        setTimeout(() => {
            errorMessage.classList.add('hidden');
        }, 5000);
    }

    // エラー非表示関数
    function hideError() {
        errorMessage.classList.add('hidden');
    }

    // ローディング状態切り替え
    function setLoading(isLoading) {
        if (isLoading) {
            loginBtn.classList.add('hidden');
            loadingBtn.classList.remove('hidden');
        } else {
            loginBtn.classList.remove('hidden');
            loadingBtn.classList.add('hidden');
        }
    }

    // フォーム送信処理
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        hideError();
        setLoading(true);

        // フォームデータの取得
        const formData = new FormData(this);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password'),
            remember_me: formData.get('remember_me') === 'on'
            // tenant_subdomain は削除 - サブドメインから自動判定
        };

        try {
            // ログインAPI呼び出し
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // X-Tenant-Subdomainヘッダーを削除 - サブドメインから自動判定
                },
                credentials: 'include',
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (result.success) {
                // ログイン成功
                const redirectUrl = result.redirect_url || '/dashboard';
                
                // 成功メッセージを短時間表示してからリダイレクト
                const successDiv = document.createElement('div');
                successDiv.className = 'mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md';
                successDiv.innerHTML = `
                    <div class="flex items-center">
                        <i class="fas fa-check-circle mr-2"></i>
                        <span>ログインしました。リダイレクト中...</span>
                    </div>
                `;
                
                errorMessage.parentNode.insertBefore(successDiv, errorMessage);
                
                // 少し待ってからリダイレクト
                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 1000);
                
            } else if (result.requires_2fa) {
                // 2要素認証が必要
                showError('2要素認証が必要です。実装は次のフェーズで対応予定です。');
                
            } else {
                // ログイン失敗
                showError(result.error || 'ログインに失敗しました。');
            }

        } catch (error) {
            console.error('Login error:', error);
            showError('ネットワークエラーが発生しました。しばらくしてから再度お試しください。');
        } finally {
            setLoading(false);
        }
    });

    // 初回フォーカス
    document.getElementById('email').focus();

    // Enter キーでのフォーム送信を有効化
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
                loginForm.dispatchEvent(new Event('submit'));
            }
        }
    });

    // セッションチェック - 既にログインしている場合はリダイレクト
    fetch('/api/auth/me', {
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 既にログイン済み
            window.location.href = '/dashboard';
        }
    })
    .catch(error => {
        // エラーは無視（ログインしていない状態）
    });
});