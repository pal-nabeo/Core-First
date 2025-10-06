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
    const emailInput = document.getElementById('email');

    // メールアドレスから企業ドメインを判定する関数
    function extractDomainFromEmail(email) {
        if (!email || !email.includes('@')) return null;
        return email.split('@')[1].toLowerCase();
    }

    // 企業ドメインからテナント情報を取得する関数
    async function getTenantByEmailDomain(email) {
        try {
            const response = await fetch('/api/tenant/find-by-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email })
            });
            
            if (response.ok) {
                const result = await response.json();
                return result.success ? result.tenant : null;
            }
        } catch (error) {
            console.error('Tenant lookup error:', error);
        }
        return null;
    }

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
        // エラー用スタイルにリセット
        errorMessage.className = 'mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md';
        errorText.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-circle mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        errorMessage.classList.remove('hidden');
        
        // 5秒後に自動的に非表示
        setTimeout(() => {
            hideError();
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
        const email = formData.get('email');
        const password = formData.get('password');
        const remember_me = formData.get('remember_me') === 'on';

        if (!email) {
            showError('メールアドレスを入力してください。');
            setLoading(false);
            return;
        }

        try {
            // まずメールアドレスからテナントを判定
            const tenant = await getTenantByEmailDomain(email);
            
            const loginData = {
                email,
                password,
                remember_me,
                // テナント情報が見つかった場合は指定
                tenant_subdomain: tenant ? tenant.subdomain : undefined
            };

            // ログインAPI呼び出し
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (result.success) {
                // ログイン成功
                const redirectUrl = result.redirect_url || '/dashboard';
                
                // 既存の成功メッセージを削除
                const existingSuccess = document.querySelector('.bg-green-50');
                if (existingSuccess) {
                    existingSuccess.remove();
                }
                
                // エラーメッセージを非表示にして成功メッセージに変換
                hideError();
                errorMessage.className = 'mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md';
                errorText.innerHTML = `
                    <div class="flex items-center">
                        <i class="fas fa-check-circle mr-2"></i>
                        <span>ログインしました。リダイレクト中...</span>
                    </div>
                `;
                errorMessage.classList.remove('hidden');
                
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

    // セッションチェック - 既にログインしている場合はサイレントリダイレクト
    fetch('/api/auth/me', {
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 既にログイン済みの場合はメッセージなしで即座にリダイレクト
            window.location.replace('/dashboard');
        }
    })
    .catch(error => {
        // エラーは無視（ログインしていない状態）
    });
});