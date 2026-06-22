/**
 * 🌳 樹木調查系統 — 身份驗證模組
 * @module auth
 * 
 * 處理 Supabase Auth 的登入/登出/會話監聽。
 * UI 顯示/隱藏邏輯（login overlay、main header、container、fab）。
 */

// ============================================================
// UI 顯示切換
// ============================================================

/**
 * 顯示登入畫面，隱藏主 UI
 */
function showLoginScreen() {
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('mainHeader').classList.add('hidden');
    document.getElementById('mainContainer').classList.add('hidden');
    document.getElementById('fabAddTree').classList.add('hidden');
    AppState.isAuthenticated = false;
    AppState.currentUser = null;
    document.getElementById('headerUserEmail').textContent = '';
}

/**
 * 隱藏登入畫面，顯示主 UI
 */
function hideLoginScreen() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('mainContainer').classList.remove('hidden');
    // fab 只有在進入 project-detail 時才顯示
    AppState.isAuthenticated = true;
}

// ============================================================
// Auth 狀態變更處理
// ============================================================

/**
 * 已認證回調 — 使用者登入成功
 * @param {object} user - Supabase user 物件
 */
function onAuthenticated(user) {
    AppState.currentUser = user;
    document.getElementById('headerUserEmail').textContent = user.email || '';
    hideLoginScreen();
    if (typeof loadSpeciesList === 'function') loadSpeciesList();
    if (typeof loadProjects === 'function') loadProjects();
    if (!canUseGPS()) {
        setTimeout(function(){
            var warn = document.getElementById('gpsProtocolWarn');
            if (warn) {
                warn.innerHTML = getProtocolWarningHTML();
                warn.classList.remove('hidden');
            }
        }, DELAY_GPS_WARN);
    }
    toast('✅ 登入成功 — ' + (user.email || ''), 'success');
}

/**
 * 未認證回調 — 使用者登出或無會話
 */
function onUnauthenticated() {
    showLoginScreen();
    // 清除狀態
    AppState._cachedTreeData = [];
    if (AppState.mapObj) { destroyMap(); }
    AppState.currentView = 'projects';
    AppState.currentProjectId = null;
    AppState.currentDetailTab = 'list';
    AppState.projPage = 0;
    AppState.treePage = 0;
    // 清除快取
    AppState.projectsCache.invalidate();
    AppState.treesCache.invalidate();
}

// ============================================================
// 登入 / 登出
// ============================================================

/**
 * 處理登入表單提交
 */
async function handleLogin() {
    const supabase = AppState.supabase;
    if (!supabase) {
        showLoginError('⚠️ 系統初始化中，請稍候...');
        return;
    }
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email) { showLoginError('請輸入電郵地址'); return; }
    if (!password) { showLoginError('請輸入密碼'); return; }
    setLoginLoading(true);
    hideLoginError();
    try {
        console.log('🔐 Attempting login for:', email);
        const result = await supabase.auth.signInWithPassword({ email: email, password: password });
        if (result.error) {
            let msg = result.error.message || '登入失敗';
            console.error('🔐 Login API error:', result.error);
            if (msg.indexOf('Invalid login credentials') >= 0 || msg.indexOf('invalid') >= 0) msg = '❌ 電郵或密碼錯誤，請再試';
            else if (msg.indexOf('Email not confirmed') >= 0) msg = '📧 請先到電郵信箱確認註冊';
            else msg = '❌ ' + msg;
            showLoginError(msg);
            setLoginLoading(false);
            return;
        }
        // 登入成功：恢復按鈕 + 主動切換畫面（不單靠 onAuthStateChange）
        console.log('🔐 Login success:', result.data.user?.email);
        setLoginLoading(false);
        onAuthenticated(result.data.user);
    } catch(e) {
        console.error('🔐 Login exception:', e);
        showLoginError('❌ 連線失敗：' + (e.message || '請檢查網絡'));
        setLoginLoading(false);
    }
}

/**
 * 處理登出
 */
async function handleLogout() {
    const supabase = AppState.supabase;
    if (!supabase) return;
    try {
        await supabase.auth.signOut();
        onUnauthenticated();
        toast('👋 已登出', 'success');
    } catch(e) {
        toast('❌ 登出失敗：' + (e.message || ''), 'error');
    }
}

// ============================================================
// 登入表單 UI 輔助
// ============================================================

/**
 * 顯示登入錯誤訊息
 * @param {string} msg
 */
function showLoginError(msg) {
    console.error('🔐 Login error:', msg);
    const el = document.getElementById('loginError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

/**
 * 隱藏登入錯誤訊息
 */
function hideLoginError() {
    const el = document.getElementById('loginError');
    if (el) { el.style.display = 'none'; }
}

/**
 * 設定登入按鈕 loading 狀態
 * @param {boolean} loading
 */
function setLoginLoading(loading) {
    const btn = document.getElementById('loginBtn');
    const spinner = document.getElementById('loginSpinner');
    const btnText = document.getElementById('loginBtnText');
    if (!btn || !spinner || !btnText) return;
    if (loading) {
        btn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = '登入中...';
    } else {
        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = '🔐 登入';
    }
}

// ============================================================
// Auth 監聽器初始化
// ============================================================

/**
 * 初始化 Supabase Auth 狀態監聽
 * 由 supabase-client.js 的 initSupabase() 呼叫
 */
function initAuth() {
    const supabase = AppState.supabase;
    if (!supabase) return;
    try {
        supabase.auth.onAuthStateChange(function(event, session) {
            console.log('🔐 Auth state change:', event, session ? session.user?.email : 'no session');
            if (session && session.user) {
                onAuthenticated(session.user);
            } else {
                onUnauthenticated();
            }
        });

        // 檢查初始會話
        supabase.auth.getSession().then(function(result) {
            if (result.data && result.data.session && result.data.session.user) {
                console.log('🔐 Existing session found:', result.data.session.user.email);
                onAuthenticated(result.data.session.user);
            } else {
                console.log('🔐 No existing session, showing login');
                onUnauthenticated();
            }
        }).catch(function(e) {
            console.warn('⚠️ getSession failed:', e.message);
            onUnauthenticated();
        });
    } catch(e) {
        console.error('Auth init error:', e);
        onUnauthenticated();
    }
}

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.auth = {
    showLoginScreen: showLoginScreen,
    hideLoginScreen: hideLoginScreen,
    onAuthenticated: onAuthenticated,
    onUnauthenticated: onUnauthenticated,
    handleLogin: handleLogin,
    handleLogout: handleLogout,
    showLoginError: showLoginError,
    hideLoginError: hideLoginError,
    setLoginLoading: setLoginLoading,
    initAuth: initAuth
};
