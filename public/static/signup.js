// PAL物流SaaS 新規登録画面JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // DOM要素の取得
    const signupForm = document.getElementById('signup-form');
    const signupBtn = document.getElementById('signup-btn');
    const loadingBtn = document.getElementById('loading-btn');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const successMessage = document.getElementById('success-message');
    const successText = document.getElementById('success-text');
    
    const togglePassword = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    const passwordConfirm = document.getElementById('password_confirm');
    const subdomainInput = document.getElementById('subdomain');
    const subdomainCheck = document.getElementById('subdomain-check');
    const subdomainStatus = document.getElementById('subdomain-status');

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
        successMessage.classList.add('hidden');
        
        // 5秒後に自動的に非表示
        setTimeout(() => {
            errorMessage.classList.add('hidden');
        }, 5000);
    }

    // 成功表示関数
    function showSuccess(message) {
        successText.textContent = message;
        successMessage.classList.remove('hidden');
        errorMessage.classList.add('hidden');
    }

    // エラー・成功メッセージ非表示関数
    function hideMessages() {
        errorMessage.classList.add('hidden');
        successMessage.classList.add('hidden');
    }

    // ローディング状態切り替え
    function setLoading(isLoading) {
        if (isLoading) {
            signupBtn.classList.add('hidden');
            loadingBtn.classList.remove('hidden');
        } else {
            signupBtn.classList.remove('hidden');
            loadingBtn.classList.add('hidden');
        }
    }

    // パスワード強度チェック
    function checkPasswordStrength(password) {
        const lengthCheck = document.getElementById('password-length');
        const charCheck = document.getElementById('password-char');
        
        // 長さチェック
        if (password.length >= 8) {
            lengthCheck.querySelector('i').className = 'fas fa-check-circle text-green-500 mr-2 text-xs';
            lengthCheck.querySelector('span').className = 'text-green-600';
        } else {
            lengthCheck.querySelector('i').className = 'fas fa-circle text-gray-300 mr-2 text-xs';
            lengthCheck.querySelector('span').className = 'text-gray-500';
        }
        
        // 文字種チェック
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        if (hasLetter && hasNumber) {
            charCheck.querySelector('i').className = 'fas fa-check-circle text-green-500 mr-2 text-xs';
            charCheck.querySelector('span').className = 'text-green-600';
        } else {
            charCheck.querySelector('i').className = 'fas fa-circle text-gray-300 mr-2 text-xs';
            charCheck.querySelector('span').className = 'text-gray-500';
        }
    }

    // パスワード一致チェック
    function checkPasswordMatch() {
        const matchDiv = document.getElementById('password-match');
        const matchText = document.getElementById('password-match-text');
        
        if (passwordConfirm.value.length > 0) {
            matchDiv.classList.remove('hidden');
            if (passwordInput.value === passwordConfirm.value) {
                matchText.textContent = '✓ パスワードが一致しています';
                matchText.className = 'text-green-600';
            } else {
                matchText.textContent = '✗ パスワードが一致しません';
                matchText.className = 'text-red-600';
            }
        } else {
            matchDiv.classList.add('hidden');
        }
    }

    // サブドメイン可用性チェック
    async function checkSubdomainAvailability(subdomain) {
        if (!subdomain || subdomain.length < 3) {
            subdomainCheck.classList.add('hidden');
            return;
        }

        try {
            const response = await fetch('/api/tenant/check-subdomain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subdomain })
            });

            const result = await response.json();
            subdomainCheck.classList.remove('hidden');

            if (result.available) {
                subdomainStatus.innerHTML = '<i class="fas fa-check-circle text-green-500 mr-1"></i><span class="text-green-600">利用可能です</span>';
            } else {
                subdomainStatus.innerHTML = '<i class="fas fa-times-circle text-red-500 mr-1"></i><span class="text-red-600">既に使用されています</span>';
            }
        } catch (error) {
            subdomainCheck.classList.add('hidden');
        }
    }

    // イベントリスナー
    passwordInput.addEventListener('input', function() {
        checkPasswordStrength(this.value);
    });

    passwordConfirm.addEventListener('input', checkPasswordMatch);

    subdomainInput.addEventListener('input', function() {
        const subdomain = this.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (this.value !== subdomain) {
            this.value = subdomain;
        }
        
        // デバウンス処理
        clearTimeout(this.checkTimeout);
        this.checkTimeout = setTimeout(() => {
            checkSubdomainAvailability(subdomain);
        }, 500);
    });

    // フォーム送信処理
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        hideMessages();
        setLoading(true);

        // フォームデータの取得
        const formData = new FormData(this);
        const signupData = {
            company_name: formData.get('company_name'),
            subdomain: formData.get('subdomain'),
            admin_name: formData.get('admin_name'),
            email: formData.get('email'),
            password: formData.get('password'),
            password_confirm: formData.get('password_confirm'),
            terms_agree: formData.get('terms_agree') === 'on'
        };

        // バリデーション
        if (!signupData.terms_agree) {
            showError('利用規約およびプライバシーポリシーに同意してください。');
            setLoading(false);
            return;
        }

        if (signupData.password !== signupData.password_confirm) {
            showError('パスワードが一致しません。');
            setLoading(false);
            return;
        }

        if (signupData.password.length < 8) {
            showError('パスワードは8文字以上で入力してください。');
            setLoading(false);
            return;
        }

        try {
            // 新規登録API呼び出し
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(signupData)
            });

            const result = await response.json();

            if (result.success) {
                // 登録成功
                showSuccess('アカウント登録が完了しました。ログイン画面に移動します...');
                
                // 3秒後にログイン画面へリダイレクト
                setTimeout(() => {
                    window.location.href = `/login?tenant=${signupData.subdomain}`;
                }, 3000);
                
            } else {
                // 登録失敗
                showError(result.error || 'アカウント登録に失敗しました。');
            }

        } catch (error) {
            console.error('Signup error:', error);
            showError('ネットワークエラーが発生しました。しばらくしてから再度お試しください。');
        } finally {
            setLoading(false);
        }
    });

    // 初回フォーカス
    document.getElementById('company_name').focus();
});