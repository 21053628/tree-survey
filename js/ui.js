/**
 * 🌳 樹木調查系統 — UI 工具模組
 * @module ui
 * 
 * 提供 Toast 通知、Modal 開關、Tab 切換、連接狀態顯示等通用 UI 功能。
 */

// ============================================================
// TOAST 通知
// ============================================================

/**
 * 顯示 Toast 通知
 * @param {string} msg - 訊息內容
 * @param {string} [type='success'] - 類型：'success' | 'error' | 'warning'
 */
function toast(msg, type) {
    type = type || 'success';
    var c = document.getElementById('toastContainer');
    if (!c) return;
    var d = document.createElement('div');
    d.className = 'toast toast-' + type;
    d.textContent = msg;
    c.appendChild(d);
    setTimeout(function(){ d.style.opacity = '0'; d.style.transition = 'opacity 0.3s'; }, 3000);
    setTimeout(function(){ d.remove(); }, 3500);
}

// ============================================================
// 連接狀態顯示
// ============================================================

/**
 * 設定 Header 連接狀態指示燈
 * @param {boolean} on - 是否在線
 * @param {string} txt - 顯示文字
 */
function setStatus(on, txt) {
    var el = document.getElementById('connStatus');
    if (!el) return;
    el.className = 'header-status ' + (on ? 'online' : 'offline');
    var d = el.querySelector('.dot');
    if (d) d.className = 'dot ' + (on ? 'green pulse' : 'gray');
    var t = document.getElementById('connText');
    if (t) t.textContent = txt;
}

// ============================================================
// MODAL 操作
// ============================================================

/**
 * 關閉指定 Modal
 * @param {string} id - Modal overlay ID
 */
function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
    if (id === 'confirmModal') AppState.pendingDelete = null;
}

/**
 * 開啟指定 Modal
 * @param {string} id - Modal overlay ID
 */
function showModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

// ============================================================
// 視圖導航
// ============================================================

/**
 * 回到專案列表視圖
 */
function goToProjects() {
    AppState.currentView = 'projects';
    AppState.currentProjectId = null;
    AppState.currentDetailTab = 'list';
    document.getElementById('view-projects').classList.remove('hidden');
    document.getElementById('view-project-detail').classList.add('hidden');
    document.getElementById('fabAddTree').classList.add('hidden');
    if (typeof destroyMap === 'function') destroyMap();
    if (typeof loadProjects === 'function') loadProjects();
}

/**
 * 打開專案詳情
 * @param {string} projectId - 專案 UUID
 * @param {string} projectName - 專案名稱
 */
function openProject(projectId, projectName) {
    AppState.currentView = 'project-detail';
    AppState.currentProjectId = projectId;
    AppState.currentProjectName = projectName;
    document.getElementById('view-projects').classList.add('hidden');
    document.getElementById('view-project-detail').classList.remove('hidden');
    document.getElementById('breadcrumbProjectName').textContent = projectName;
    document.getElementById('fabAddTree').classList.remove('hidden');
    AppState._cachedTreeData = [];
    if (AppState.mapObj) { destroyMap(); }
    AppState.currentDetailTab = 'list';
    showListView();
    AppState.treePage = 0;
    if (typeof loadProjectTrees === 'function') loadProjectTrees();
}

// ============================================================
// TAB 切換（列表 ⇄ 地圖）
// ============================================================

/**
 * 切換到列表視圖
 */
function showListView() {
    AppState.currentDetailTab = 'list';
    document.getElementById('view-project-list').classList.remove('hidden');
    document.getElementById('view-project-map').classList.add('hidden');
    document.getElementById('tabList').classList.add('active');
    document.getElementById('tabMap').classList.remove('active');
}

/**
 * 切換到地圖視圖
 */
function showMapView() {
    AppState.currentDetailTab = 'map';
    document.getElementById('view-project-list').classList.add('hidden');
    document.getElementById('view-project-map').classList.remove('hidden');
    document.getElementById('tabList').classList.remove('active');
    document.getElementById('tabMap').classList.add('active');
    if (!AppState.mapObj || AppState._cachedTreeData.length === 0) {
        setTimeout(function(){ if (typeof renderMap === 'function') renderMap(); }, 100);
    }
}

// ============================================================
// 全局刷新
// ============================================================

/**
 * 刷新全部資料
 */
async function refreshAll() {
    if (!AppState.supabase) {
        initSupabase();
        if (!AppState.supabase) return;
    }
    AppState._cachedTreeData = [];
    if (AppState.mapObj) { destroyMap(); }
    // 清除快取
    AppState.projectsCache.invalidate();
    AppState.treesCache.invalidate();
    if (AppState.currentView === 'projects') loadProjects();
    if (AppState.currentView === 'project-detail') {
        loadProjectTrees();
        if (AppState.currentDetailTab === 'map') {
            setTimeout(function(){ if (typeof renderMap === 'function') renderMap(); }, 500);
        }
    }
    toast('✅ 已刷新', 'success');
}

// ============================================================
// 系統診斷
// ============================================================

/**
 * 顯示系統診斷資訊
 */
async function diagnosis() {
    var L = [];
    function log(m) { L.push(m); console.log('[DIAG]', m); }
    log('═══ v20 診斷 ═══');
    log('Auth: ' + (AppState.isAuthenticated ? '✅ ' + (AppState.currentUser?.email || '') : '❌ 未登入'));
    log('SDK: ' + (sdkReady() ? '✅' : '❌'));
    log('XLSX: ' + (xlsxReady() ? '✅' : '❌'));
    log('Leaflet: ' + (leafletReady() ? '✅' : '❌'));
    log('Species: Bot ' + AppState.botanicalNames.length + ' | Chi ' + AppState.chineseNames.length);
    log('Protocol: ' + window.location.protocol + ' | Host: ' + window.location.hostname);
    log('GPS possible: ' + (canUseGPS() ? '✅ YES' : '❌ NO — 用地圖揀位'));
    log('UUID fallback: ' + (typeof crypto.randomUUID === 'function' ? '✅ native' : '⚠️ fallback'));
    log('Mobile: ' + (isMobile() ? '📱 YES' : '🖥️ NO') + ' (' + window.innerWidth + 'px)');
    if (AppState.supabase) {
        try {
            var r3 = await AppState.supabase.from('species_list').select('*', { count: 'exact', head: true });
            log('species_list: ' + (r3.error ? '❌' : '✅ ' + (r3.count || 0)));
        } catch(e) { log('species_list: ❌ ' + e.message); }
        try {
            var r = await AppState.supabase.from('projects').select('count', { count: 'exact', head: true });
            log('projects: ' + (r.error ? '❌' : '✅ ' + (r.data?.[0]?.count ?? '?')));
        } catch(e) { log('projects: ❌ ' + e.message); }
        try {
            var r2 = await AppState.supabase.from('trees').select('count', { count: 'exact', head: true });
            log('trees: ' + (r2.error ? '❌' : '✅ ' + (r2.data?.[0]?.count ?? '?')));
        } catch(e) { log('trees: ❌ ' + e.message); }
    } else {
        log('supabase: ❌ 未初始化');
    }
    log('═══ END ═══');
    alert(L.join('\n'));
}