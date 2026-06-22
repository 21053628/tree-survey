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
        var arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        arr[6] = (arr[6] & 0x0f) | 0x40;
        arr[8] = (arr[8] & 0x3f) | 0x80;
        var hex = Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); });
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
 * 是否為手機裝置（寬度 <= 768px）
 * @returns {boolean}
 */
function isMobile() {
    return window.innerWidth <= 768;
}

/**
 * 檢查當前環境是否支援 GPS
 * @returns {boolean}
 */
function canUseGPS() {
    var proto = window.location.protocol;
    var host = window.location.hostname;
    if (proto === 'https:') return true;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
    return false;
}

/**
 * 取得 GPS 協議警告 HTML
 * @returns {string}
 */
function getProtocolWarningHTML() {
    var proto = window.location.protocol;
    var host = window.location.hostname;
    var msg = '<strong>⚠️ GPS 定位不適用</strong><br>';
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
 * Health Condition → Badge HTML
 * @param {string|null} v
 * @returns {string} HTML
 */
function healthBadge(v) {
    if (!v) return '<span class="null-cell">—</span>';
    var cls = v.toLowerCase();
    return '<span class="tc-badge '+cls+'">'+esc(v)+'</span>';
}

/**
 * Structural Condition → Badge HTML
 * @param {string|null} v
 * @returns {string} HTML
 */
function structBadge(v) {
    if (!v) return '<span class="null-cell">—</span>';
    var cls = v.toLowerCase();
    return '<span class="tc-badge '+cls+'">'+esc(v)+'</span>';
}

/**
 * Recommendation → Badge HTML
 * @param {string|null} v
 * @returns {string} HTML
 */
function recBadge(v) {
    if (!v) return '<span class="null-cell">—</span>';
    var m = {retain:'retain',fell:'fell',transplant:'transplant',prune:'monitor',monitor:'monitor','further investigation':'investigation'};
    var cls = m[v.toLowerCase()] || '';
    return '<span class="tc-badge '+cls+'">'+esc(v)+'</span>';
}

/**
 * Debounce 函數 — 延遲執行，重複呼叫會重置計時器
 * @param {Function} fn - 要執行的函數
 * @param {number} [ms=DEBOUNCE_DELAY] - 延遲毫秒數
 * @returns {Function} debounced 函數
 */
function debounce(fn, ms) {
    ms = ms || DEBOUNCE_DELAY;
    var timer = null;
    return function() {
        var ctx = this;
        var args = arguments;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
}

/**
 * 簡單快取封裝（記憶體內，附 TTL）
 * @param {number} [ttlMs=CACHE_TTL] - TTL 毫秒
 * @returns {{get: Function, set: Function, invalidate: Function}}
 */
function createCache(ttlMs) {
    ttlMs = ttlMs || CACHE_TTL;
    var store = {};
    return {
        get: function(key) {
            var entry = store[key];
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