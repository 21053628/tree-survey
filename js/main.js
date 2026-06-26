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
    const LIBS = CDN_LIBS;
    const loaded = {};
    function loadLib(k, urls, idx, cb) {
        if (idx >= urls.length) { console.error('❌ ' + k + ' ALL FAILED'); cb(false); return; }
        const url = urls[idx];
        console.log('⏳ CDN ' + k + ':', url);
        const s = document.createElement('script');
        s.src = url;
        s.onload = function(){ console.log('✅ CDN ' + k + ':', url); cb(true); };
        s.onerror = function(){ console.warn('❌ CDN ' + k + ':', url); loadLib(k, urls, idx + 1, cb); };
        document.head.appendChild(s);
    }
    let remaining = LIBS.length;
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

// Leaflet CSS fallback (取代 HTML inline onerror，符合 CSP 要求)
(function(){
    var cssEl = document.getElementById('leafletCSS');
    if (cssEl && cssEl.sheet) {
        try {
            // 跨域 CSS 無法讀取 cssRules，但可以用 length 檢查
            // 如果沒有被 CORS 阻擋，cssRules.length >= 0 表示載入成功
            if (cssEl.sheet.cssRules && cssEl.sheet.cssRules.length >= 0) return;
        } catch(e) {
            // 跨域安全錯誤：無法讀取 cssRules（正常情況，CSS 可能已成功載入）
            // 用 .sheet.rules (IE fallback) 再試
            try {
                if (cssEl.sheet.rules && cssEl.sheet.rules.length >= 0) return;
            } catch(e2) {
                // 兩個方法都失敗，無法確認狀態，假設 CSS 可能未載入
            }
        }
    }
    if (cssEl) {
        console.warn('🔄 Leaflet CSS fallback: switching to jsdelivr');
        cssEl.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
    }
})();

console.log('🚀 v22 Boot...');
console.log('Protocol:', window.location.protocol, '| GPS possible:', canUseGPS());
setStatus(true, 'CDN 載入中...');
showLoginScreen();

let _pollCount = 0;
const _poll = setInterval(function(){
    _pollCount++;
    if (window.__ALL_CDN_DONE__) {
        clearInterval(_poll);
        if (window.__SDK_FAILED__) { setStatus(false, '❌ SDK 失敗'); showLoginError('❌ Supabase SDK 載入失敗，請檢查網絡連線後重新整理頁面'); return; }
        console.log('✅ All CDNs ready');
        initSupabase();
        // initSupabase() now calls initAuth() which will show/hide login based on session
        return;
    }
    if (_pollCount > CDN_POLL_MAX) { clearInterval(_poll); setStatus(false, '⏰ CDN 超時'); showLoginError('⏰ 系統載入超時，請檢查網絡連線後重新整理頁面'); }
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
        const modals = document.querySelectorAll('.modal-overlay:not(.hidden)');
        if (modals.length > 0) {
            let topZ = 0, topModal = null;
            modals.forEach(function(m) {
                const z = parseInt(window.getComputedStyle(m).zIndex) || 0;
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

let _lastW = window.innerWidth;
let _resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(function() {
        const w = window.innerWidth;
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

// ============================================================
// 全域事件委派：data-action 按鈕（取代所有 inline onclick）
// ============================================================

document.addEventListener('click', function(e) {
    const actionEl = e.target.closest('[data-action]');
    const annoEl = e.target.closest('[data-anno-tool]');
    if (!actionEl && !annoEl) return;

    if (actionEl) {
        const action = actionEl.getAttribute('data-action');

        switch (action) {
            // --- Auth ---
            case 'login': handleLogin(); break;
            case 'logout': handleLogout(); break;

            // --- Header ---
            case 'diagnosis': diagnosis(); break;
            case 'show-changelog': showModal('changelogModal'); break;
            case 'refresh': refreshAll(); break;

            // --- Navigation ---
            case 'nav-projects': goToProjects(); break;
            case 'tab-list': showListView(); break;
            case 'tab-map': showMapView(); break;

            // --- Project CRUD ---
            case 'create-project': showProjectModal(); break;
            case 'save-project': saveProject(); break;
            case 'export-all': exportAllProjectsExcel(); break;

            // --- Tree CRUD ---
            case 'create-tree': showTreeModal(); break;
            case 'save-tree': saveTree(); break;
            case 'export-project': exportProjectTreesExcel(); break;

            // --- Modal ---
            case 'close-modal': closeModal(actionEl.getAttribute('data-modal')); break;

            // --- GPS ---
            case 'show-gps-dialog': showGPSDialog(); break;
            case 'gps-start': closeModal('gpsPreModal'); doCaptureGPS(0); break;
            case 'gps-retry': closeModal('gpsDenyModal'); doCaptureGPS(0); break;
            case 'open-map-picker': openMapPicker(); break;

            // --- Map Picker ---
            case 'confirm-map-picker': confirmMapPicker(); break;
            case 'close-map-picker': closeMapPicker(); break;

            // --- Map Layers ---
            case 'layer-dark': switchMainLayer('dark'); break;
            case 'layer-imagery': switchMainLayer('imagery'); break;
            case 'layer-topo': switchMainLayer('topo'); break;
            case 'layer-street': switchMainLayer('street'); break;
            case 'picker-layer-dark': switchPickerLayer('dark'); break;
            case 'picker-layer-imagery': switchPickerLayer('imagery'); break;
            case 'picker-layer-topo': switchPickerLayer('topo'); break;
            case 'picker-layer-street': switchPickerLayer('street'); break;

            // --- Health Filter ---
            case 'filter-health':
                toggleHealthFilter(actionEl.getAttribute('data-health'), actionEl);
                break;

            // --- GPS Locate ---
            case 'locate-me': locateMe(); break;

            // --- Photos ---
            case 'trigger-photo-upload': document.getElementById('photoFileInput').click(); break;
            case 'photo-prev': photoViewerNav(-1); break;
            case 'photo-next': photoViewerNav(1); break;
            case 'edit-photo-caption': editPhotoCaption(); break;
            case 'download-photo': downloadCurrentPhoto(); break;
            case 'delete-photo': deleteCurrentPhoto(); break;
            case 'save-photo-caption': savePhotoCaption(); break;

            // --- Coordinate System Toggle ---
            case 'coord-mode-wgs84': switchCoordMode('wgs84'); break;
            case 'coord-mode-hk1980': switchCoordMode('hk1980'); break;
        }
    }

    // --- Annotation Toolbar (data-anno-tool 獨立屬性) ---
    if (annoEl && typeof handleAnnotationToolClick === 'function') {
        handleAnnotationToolClick(annoEl.getAttribute('data-anno-tool'));
    }
});
// ============================================================
// 全域事件委派：搜尋 input（data-action 在 input 元素上）
// ============================================================

document.addEventListener('input', function(e) {
    const el = e.target;
    if (!el.hasAttribute('data-action')) return;
    const action = el.getAttribute('data-action');

    switch (action) {
        case 'search-projects': searchProjects(); break;
        case 'search-trees': searchTrees(); break;
        case 'search-map': searchMapTrees(); break;
    }
});

// ============================================================
// 全域事件委派：照片檔案選擇（change 事件）
// ============================================================

document.addEventListener('change', function(e) {
    const el = e.target;
    if (el.getAttribute('data-action') === 'photo-files-selected') {
        if (typeof handlePhotoFilesSelected === 'function') {
            handlePhotoFilesSelected(el);
        }
    }
});
