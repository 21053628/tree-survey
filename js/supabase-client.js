/**
 * 🌳 樹木調查系統 — Supabase 客戶端與統一錯誤處理
 * @module supabase-client
 */

/**
 * 初始化 Supabase 客戶端
 * @returns {boolean} 是否成功
 */
function initSupabase() {
    if (!sdkReady()) {
        setStatus(false, '❌ SDK 未載入');
        // 在登入界面顯示錯誤，因為 header 是隱藏的
        showLoginError('⚠️ Supabase SDK 未成功載入，請檢查網絡連線後重新整理頁面');
        console.error('🔐 initSupabase: SDK not ready');
        return false;
    }
    try {
        AppState.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'public' } });
        const displayEl = document.getElementById('projectUrlDisplay');
        if (displayEl) displayEl.textContent = SUPABASE_URL.replace('https://','');
        setStatus(true, '✅ 連線成功');
        AppState.initDone = true;
        // 啟動 Auth 監聽（auth.js 提供）
        initAuth();
        return true;
    } catch(e) {
        setStatus(false, 'Init 失敗');
        console.error('Supabase init error:', e);
        // 在登入界面顯示錯誤
        showLoginError('❌ Supabase 初始化失敗：' + (e.message || '未知錯誤') + '。請重新整理頁面');
        return false;
    }
}

/**
 * 統一的 Supabase 錯誤處理
 * 根據錯誤類型自動分類並顯示適當的 toast 訊息
 * @param {object} error - Supabase 回傳的 error 物件
 * @param {string} [context=''] - 操作描述（如「載入專案」）
 */
function handleSupabaseError(error, context) {
    context = context || '';
    const msg = error.message || '';
    const code = error.code || '';
    const details = error.details || '';

    // 分類處理
    if (msg.indexOf('JWT expired') >= 0 || msg.indexOf('token') >= 0 || code === 'PGRST301') {
        toast('🔐 登入已過期，請重新登入', 'error');
        if (typeof handleLogout === 'function') handleLogout();
        return;
    }
    if (code === '42501' || msg.indexOf('permission denied') >= 0 || msg.indexOf('row-level security') >= 0) {
        toast('🔒 權限不足：' + (context || msg), 'error');
        return;
    }
    if (msg.indexOf('duplicate key') >= 0 || code === '23505') {
        toast('⚠️ 資料重複：' + (context || msg), 'warning');
        return;
    }
    if (msg.indexOf('Failed to fetch') >= 0 || msg.indexOf('NetworkError') >= 0 || msg.indexOf('timeout') >= 0) {
        toast('🌐 網絡連線失敗' + (context ? '（' + context + '）' : '') + '，請檢查網絡', 'error');
        return;
    }
    if (msg.indexOf('row not found') >= 0 || code === 'PGRST116') {
        toast('⚠️ 找不到資料' + (context ? '：' + context : ''), 'warning');
        return;
    }

    // 預設
    let errMsg = '❌ ';
    if (context) errMsg += context + '：';
    errMsg += msg;
    toast(errMsg, 'error');
    console.error('[Supabase Error]', context, error);
}

/**
 * 安全包裝 Supabase 查詢 — 自動處理錯誤
 * @param {Promise} queryPromise - Supabase 查詢 Promise
 * @param {string} [context=''] - 操作描述
 * @returns {Promise<{data: *, error: *}>}
 */
async function safeQuery(queryPromise, context) {
    try {
        const result = await queryPromise;
        if (result.error) {
            handleSupabaseError(result.error, context);
        }
        return result;
    } catch(e) {
        console.error('[SafeQuery Exception]', context, e);
        toast('❌ ' + (context || '操作') + '失敗：' + (e.message || '未知錯誤'), 'error');
        return { data: null, error: e };
    }
}

/**
 * 安全查詢 + 自動解包 data 的簡寫
 * 用法：var projects = await q(AppState.supabase.from('projects').select('*'), '載入專案');
 * 若出錯則回傳 null，呼叫端可用 if (!result) 處理
 *
 * @param {Promise} queryPromise - Supabase 查詢 Promise
 * @param {string} [context=''] - 操作描述
 * @returns {Promise<*|null>} 解包後的 data，或 null（發生錯誤時）
 */
async function q(queryPromise, context) {
    const result = await safeQuery(queryPromise, context);
    if (result.error) return null;
    return result.data;
}

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.supabase = {
    initSupabase: initSupabase,
    handleSupabaseError: handleSupabaseError,
    safeQuery: safeQuery,
    q: q
};
