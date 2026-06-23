/**
 * 🌳 樹木調查系統 — 通用工具函數
 * @module utils
 */

/**
 * 產生 UUID v4（支援不支援 crypto.randomUUID 的環境）
 * @returns {string} UUID
 */
function uuid() {
    try { return crypto.randomUUID(); } catch(e) {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        arr[6] = (arr[6] & 0x0f) | 0x40;
        arr[8] = (arr[8] & 0x3f) | 0x80;
        const hex = Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); });
        return hex[0]+hex[1]+hex[2]+hex[3]+'-'+hex[4]+hex[5]+'-'+hex[6]+hex[7]+'-'+hex[8]+hex[9]+'-'+hex[10]+hex[11]+hex[12]+hex[13]+hex[14]+hex[15];
    }
}

/**
 * HTML 跳脫（防 XSS）
 * @param {*} s - 輸入值
 * @returns {string} 跳脫後的字串
 */
function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"').replace(/'/g,'&#39;');
}

/**
 * 取得今日日期字串 YYYY-MM-DD
 * @returns {string}
 */
function todayStr() {
    return new Date().toISOString().split('T')[0];
}

/**
 * 是否為手機裝置（寬度 <= MOBILE_BREAKPOINT_PX）
 * @returns {boolean}
 */
function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT_PX;
}

/**
 * 檢查當前環境是否支援 GPS
 * @returns {boolean}
 */
function canUseGPS() {
    const proto = window.location.protocol;
    const host = window.location.hostname;
    if (proto === 'https:') return true;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
    return false;
}

/**
 * 取得 GPS 協議警告 HTML
 * @returns {string}
 */
function getProtocolWarningHTML() {
    const proto = window.location.protocol;
    const host = window.location.hostname;
    let msg = '<strong>⚠️ GPS 定位不適用</strong><br>';
    if (proto === 'file:') { msg += '你正由檔案開啟此頁面（file://），Chrome/Safari 會封鎖 GPS。<br>'; }
    else if (proto === 'http:' && host !== 'localhost' && host !== '127.0.0.1') { msg += '你正經 HTTP 開啟（非 localhost），瀏覽器封鎖 GPS。<br>'; }
    else { msg += '當前環境不支援 GPS 定位。<br>'; }
    msg += '<strong>👉 請改用「🗺️ 地圖揀位」或手動輸入座標。</strong><br>';
    msg += '<span style="font-size:.68rem;color:var(--text2)">解決方案：用 HTTPS 開啟（如 GitHub Pages），詳情見文末教學。</span>';
    return msg;
}

/**
 * 取得 GPS 權限拒絕指南 HTML
 * @returns {string}
 */
function getGPSDenyGuideHTML() {
    return '<strong>請跟以下步驟開返權限：</strong><br><br>'+
        '<strong>iPhone / iPad (Safari):</strong><br>Settings → Apps → Safari → Location → 揀 <strong>"While Using"</strong><br><br>'+
        '<strong>Android (Chrome):</strong><br>Settings → Apps → Chrome → Permissions → Location → <strong>"Allow only while using"</strong><br><br>'+
        '⚡ 或者直接改用 <strong>「🗺️ 地圖揀位」</strong> — 唔使 GPS 權限！';
}

/**
 * Supabase SDK 是否已載入
 * @returns {boolean}
 */
function sdkReady() {
    return !!(window.supabase && typeof window.supabase.createClient === 'function');
}

/**
 * XLSX 函式庫是否已載入
 * @returns {boolean}
 */
function xlsxReady() {
    return !!(window.XLSX && typeof window.XLSX.utils === 'object');
}

/**
 * Leaflet 函式庫是否已載入
 * @returns {boolean}
 */
function leafletReady() {
    return !!(window.L && typeof window.L.map === 'function');
}

/**
 * Health Condition → Badge Element（安全 DOM，取代 innerHTML）
 * @param {string|null} v
 * @returns {HTMLElement}
 */
function healthBadge(v) {
    return healthBadgeEl(v);
}

/**
 * Structural Condition → Badge Element（安全 DOM，取代 innerHTML）
 * @param {string|null} v
 * @returns {HTMLElement}
 */
function structBadge(v) {
    return structBadgeEl(v);
}

/**
 * Recommendation → Badge Element（安全 DOM，取代 innerHTML）
 * @param {string|null} v
 * @returns {HTMLElement}
 */
function recBadge(v) {
    return recBadgeEl(v);
}

/**
 * Debounce 函數 — 延遲執行，重複呼叫會重置計時器
 * @param {Function} fn - 要執行的函數
 * @param {number} [ms=DEBOUNCE_DELAY] - 延遲毫秒數
 * @returns {Function} debounced 函數
 */
function debounce(fn, ms) {
    ms = ms || DEBOUNCE_DELAY;
    let timer = null;
    let pendingPromise = null;
    let pendingResolve = null;
    let pendingReject = null;
    return function() {
        const ctx = this;
        const args = arguments;
        if (timer) clearTimeout(timer);
        if (pendingReject) {
            pendingReject(new Error('debounced'));
            pendingReject = null;
        }
        if (!pendingPromise) {
            pendingPromise = new Promise(function(resolve, reject) {
                pendingResolve = resolve;
                pendingReject = reject;
            });
        }
        timer = setTimeout(function() {
            let result;
            try {
                result = fn.apply(ctx, args);
            } catch(e) {
                if (pendingReject) { pendingReject(e); pendingReject = null; pendingPromise = null; pendingResolve = null; }
                return;
            }
            if (result && typeof result.then === 'function') {
                result.then(function(v) {
                    if (pendingResolve) { pendingResolve(v); pendingResolve = null; pendingReject = null; pendingPromise = null; }
                }).catch(function(e) {
                    if (pendingReject) { pendingReject(e); pendingReject = null; pendingResolve = null; pendingPromise = null; }
                });
            } else {
                if (pendingResolve) { pendingResolve(result); pendingResolve = null; pendingReject = null; pendingPromise = null; }
            }
        }, ms);
        return pendingPromise;
    };
}

/**
 * 簡單快取封裝（記憶體內，附 TTL）
 * @param {number} [ttlMs=CACHE_TTL] - TTL 毫秒
 * @returns {{get: Function, set: Function, invalidate: Function}}
 */
function createCache(ttlMs) {
    ttlMs = ttlMs || CACHE_TTL;
    let store = {};
    return {
        get: function(key) {
            const entry = store[key];
            if (!entry) return null;
            if (Date.now() - entry.time > ttlMs) { delete store[key]; return null; }
            return entry.value;
        },
        set: function(key, value) {
            store[key] = { value: value, time: Date.now() };
        },
        invalidate: function() {
            store = {};
        }
    };
}

// ============================================================
// Supabase 批次載入工具
// ============================================================

/**
 * 通用批次載入 — 自動處理 Supabase 分頁，一次撈回全部資料
 * 消除全專案中重複的 `while(true) { .range(from, from+999) }` 模式
 *
 * @param {object} queryBuilder - Supabase query builder（已設定 .select(), .eq() 等條件，不含 .range()）
 * @param {number} [pageSize=FETCH_PAGE_SIZE] - 每批筆數
 * @returns {Promise<object[]>} 全部資料陣列；若出錯則回傳空陣列
 *
 * @example
 *   var allTrees = await fetchAllPages(
 *       AppState.supabase.from('trees').select('*').eq('projectId', pid).order('treeIdNo')
 *   );
 */
async function fetchAllPages(queryBuilder, pageSize) {
    pageSize = pageSize || FETCH_PAGE_SIZE;
    let allData = [];
    let from = 0;
    try {
        while (true) {
            const r = await queryBuilder.range(from, from + pageSize - 1);
            if (r.error) {
                console.warn('fetchAllPages error:', r.error.message);
                break;
            }
            if (!r.data || r.data.length === 0) break;
            allData = allData.concat(r.data);
            if (r.data.length < pageSize) break;
            from += pageSize;
        }
    } catch(e) {
        console.error('fetchAllPages exception:', e.message);
    }
    return allData;
}

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.utils = {
    uuid: uuid,
    esc: esc,
    todayStr: todayStr,
    isMobile: isMobile,
    canUseGPS: canUseGPS,
    getProtocolWarningHTML: getProtocolWarningHTML,
    getGPSDenyGuideHTML: getGPSDenyGuideHTML,
    sdkReady: sdkReady,
    xlsxReady: xlsxReady,
    leafletReady: leafletReady,
    healthBadge: healthBadge,
    structBadge: structBadge,
    recBadge: recBadge,
    debounce: debounce,
    createCache: createCache,
    fetchAllPages: fetchAllPages
};
