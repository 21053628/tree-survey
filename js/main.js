/**
 * 🌳 樹木調查系統 — 啟動入口 + 全域事件綁定
 * @module main
 * 
 * CDN 輪詢 → Supabase 初始化 → Auth 監聽 → 視窗 resize → 鍵盤/滑鼠事件。
 */

// ============================================================
// CDN 動態載入
// ============================================================

(function(){
    var LIBS = CDN_LIBS;
    var loaded = {};
    function loadLib(k, urls, idx, cb) {
        if (idx >= urls.length) { console.error('❌ ' + k + ' ALL FAILED'); cb(false); return; }
        var url = urls[idx];
        console.log('⏳ CDN ' + k + ':', url);
        var s = document.createElement('script');
        s.src = url;
        s.onload = function(){ console.log('✅ CDN ' + k + ':', url); cb(true); };
        s.onerror = function(){ console.warn('❌ CDN ' + k + ':', url); loadLib(k, urls, idx + 1, cb); };
        document.head.appendChild(s);
    }
    var remaining = LIBS.length;
    LIBS.forEach(function(lib) {
        loadLib(lib.key, lib.urls, 0, function(ok) {
            loaded[lib.key] = ok;
            remaining--;
            if (remaining === 0) {
                window.__ALL_CDN_DONE__ = true;
                if (!loaded['supabase']) window.__SDK_FAILED__ = true;
                if (!loaded['xlsx']) window.__XLSX_FAILED__ = true;
                if (!loaded['leaflet']) window.__LEAFLET_FAILED__ = true;
            }
        });
    });
})();

// ============================================================
// BOOT: 輪詢 CDN 載入完成
// ============================================================

console.log('🚀 v20 Boot...');
console.log('Protocol:', window.location.protocol, '| GPS possible:', canUseGPS());
setStatus(true, 'CDN 載入中...');
showLoginScreen();

var _pollCount = 0;
var _poll = setInterval(function(){
    _pollCount++;
    if (window.__ALL_CDN_DONE__) {
        clearInterval(_poll);
        if (window.__SDK_FAILED__) { setStatus(false, '❌ SDK 失敗'); return; }
        console.log('✅ All CDNs ready');
        initSupabase();
        // initSupabase() now calls initAuth() which will show/hide login based on session
        return;
    }
    if (_pollCount > CDN_POLL_MAX) { clearInterval(_poll); setStatus(false, '⏰ CDN 超時'); }
}, CDN_POLL_INTERVAL_MS);

// ============================================================
// 全域事件：Modal overlay 點擊關閉
// ============================================================

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
    }
});

// ============================================================
// 全域事件：鍵盤快捷鍵
// ============================================================

document.addEventListener('keydown', function(e) {
    // Escape: 關閉最上層 modal
    if (e.key === 'Escape') {
        var modals = document.querySelectorAll('.modal-overlay:not(.hidden)');
        if (modals.length > 0) {
            var topZ = 0, topModal = null;
            modals.forEach(function(m) {
                var z = parseInt(window.getComputedStyle(m).zIndex) || 0;
                if (z >= topZ) { topZ = z; topModal = m; }
            });
            if (topModal) topModal.classList.add('hidden');
        }
        if (!document.querySelector('.modal-overlay:not(.hidden)')) {
            AppState.pendingDelete = null;
        }
    }
    // Enter: 在密碼欄位觸發登入
    if (e.key === 'Enter' && document.activeElement === document.getElementById('loginPassword')) {
        handleLogin();
    }
});

// ============================================================
// 視窗 resize 事件（RWD 自適應刷新）
// ============================================================

var _lastW = window.innerWidth;
var _resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(function() {
        var w = window.innerWidth;
        if (Math.abs(w - _lastW) < RESIZE_THRESHOLD_PX) return;
        _lastW = w;
        // 切換表格/卡片視圖需重新渲染
        if (AppState.currentView === 'projects' && typeof loadProjects === 'function') {
            loadProjects();
        }
        if (AppState.currentView === 'project-detail') {
            if (typeof loadProjectTrees === 'function') loadProjectTrees();
            if (AppState.currentDetailTab === 'map') {
                setTimeout(function() {
                    if (AppState.mapObj) AppState.mapObj.invalidateSize();
                    if (typeof renderMap === 'function') renderMap();
                }, DELAY_FOCUS_OPEN_POPUP);
            }
        }
    }, RESIZE_DEBOUNCE_MS);
});