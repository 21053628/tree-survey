/**
 * 🌳 樹木調查系統 — 樹木 CRUD 模組
 * @module trees
 * 
 * 樹木列表（含搜尋 debounce + 記憶體快取 TTL 5 分鐘）、
 * 新增/編輯/刪除樹木、GPS 座標驗證。
 */

// ============================================================
// 樹木列表載入（含 debounce + 快取）
// ============================================================

/**
 * 載入樹木列表（含 debounce 延遲）
 */
var loadProjectTrees = debounce(_loadProjectTrees);

/**
 * 實際載入樹木列表（由 debounce 包裝）
 */
async function _loadProjectTrees() {
    if (AppState._loadingTrees) return;
    AppState._loadingTrees = true;
    var tb = document.getElementById('treesBody');
    var cv = document.getElementById('treeCardsView');
    if (!tb || !cv) { AppState._loadingTrees = false; return; }
    tb.innerHTML = '<tr><td colspan="10" class="empty">⏳ 載入中...</td></tr>';
    cv.innerHTML = '';
    if (!AppState.supabase || !AppState.currentProjectId) { AppState._loadingTrees = false; return; }

    // --- 快取檢查 ---
    var cacheKey = 'trees_' + AppState.currentProjectId + '_' + AppState.treePage + '_' + ((document.getElementById('treeSearch')?.value || '').trim());
    var cached = AppState.treesCache.get(cacheKey);
    if (cached) {
        renderTreesList(cached.data, cached.count);
        AppState._loadingTrees = false;
        return;
    }

    try {
        // 載入專案資訊
        var pr = await AppState.supabase.from('projects').select('*').eq('id', AppState.currentProjectId).single();
        if (pr.data) document.getElementById('sProjectDate').textContent = pr.data.surveyDate || '—';

        var s = (document.getElementById('treeSearch')?.value || '').trim();
        var q = AppState.supabase.from('trees')
            .select('*', { count: 'exact' })
            .eq('projectId', AppState.currentProjectId)
            .range(AppState.treePage * PAGE_SIZE, (AppState.treePage + 1) * PAGE_SIZE - 1)
            .order('created_at', { ascending: false });
        if (s) q = q.or('treeIdNo.ilike.%' + s + '%,botanicalName.ilike.%' + s + '%,chineseName.ilike.%' + s + '%,remarks.ilike.%' + s + '%');
        var r = await q;
        if (r.error) {
            tb.innerHTML = '<tr><td colspan="10" class="empty" style="color:#f87171;">❌ ' + r.error.message + '</td></tr>';
            AppState._loadingTrees = false;
            return;
        }
        var count = r.count || 0;
        document.getElementById('sProjectTreeCount').textContent = count;

        // 有座標的數量
        try {
            var mc = await AppState.supabase.from('trees')
                .select('id', { count: 'exact', head: true })
                .eq('projectId', AppState.currentProjectId)
                .not('latitude', 'is', null);
            document.getElementById('sProjectMappedCount').textContent = (mc.count || 0);
        } catch(e) {
            document.getElementById('sProjectMappedCount').textContent = '?';
        }

        if (!r.data || r.data.length === 0) {
            tb.innerHTML = '<tr><td colspan="10" class="empty"><span class="icon">🌱</span>暫無樹木<br><button class="btn btn-success btn-sm mt-3" onclick="showTreeModal()">➕ 新增樹木</button></td></tr>';
            cv.innerHTML = '<div class="empty"><span class="icon">🌱</span>暫無樹木<br><button class="btn btn-success btn-sm mt-3" onclick="showTreeModal()">➕ 新增樹木</button></div>';
            document.getElementById('treePagination').innerHTML = '';
            AppState._loadingTrees = false;
            return;
        }

        // 存入快取
        AppState.treesCache.set(cacheKey, { data: r.data, count: count });
        renderTreesList(r.data, count);
    } catch(e) {
        tb.innerHTML = '<tr><td colspan="10" class="empty" style="color:#f87171;">❌ ' + e.message + '</td></tr>';
    }
    AppState._loadingTrees = false;
}

/**
 * 渲染樹木列表到 DOM
 * @param {object[]} data
 * @param {number} count
 */
function renderTreesList(data, count) {
    var tb = document.getElementById('treesBody');
    var cv = document.getElementById('treeCardsView');

    /** @param {object} d @returns {boolean} */
    var hasCoords = function(d) { return d.latitude != null && d.longitude != null; };

    // Table View
    tb.innerHTML = data.map(function(d) {
        return '<tr>' +
            '<td><strong style="color:#fbbf24;">' + esc(d.treeIdNo || '—') + '</strong></td>' +
            '<td style="font-style:italic;font-size:.78rem;">' + esc(d.botanicalName || '—') + '</td>' +
            '<td>' + esc(d.chineseName || '—') + '</td>' +
            '<td>' + (d.trunkDiameter || '<span class="null-cell">—</span>') + '</td>' +
            '<td>' + (d.overallHeight || '<span class="null-cell">—</span>') + '</td>' +
            '<td>' + (d.crownSpread || '<span class="null-cell">—</span>') + '</td>' +
            '<td>' + healthBadge(d.healthCondition) + '</td>' +
            '<td>' + structBadge(d.structuralCondition) + '</td>' +
            '<td>' + recBadge(d.recommendation) + '</td>' +
            '<td>' +
            (hasCoords(d) ? '<button class="btn btn-map-go" onclick="event.stopPropagation();focusTreeOnMap(\'' + d.id + '\')">📍</button> ' : '') +
            '<button class="btn btn-outline btn-xs" onclick="editTree(\'' + d.id + '\')">✏️</button> ' +
            '<button class="btn btn-danger btn-xs" onclick="confirmDeleteTree(\'' + d.id + '\',\'' + esc(d.treeIdNo || d.id) + '\')">🗑</button>' +
            '</td></tr>';
    }).join('');

    // Card View (mobile)
    cv.innerHTML = data.map(function(d) {
        var metrics = [];
        if (d.trunkDiameter) metrics.push('📐 DBH: ' + esc(d.trunkDiameter) + 'mm');
        if (d.overallHeight) metrics.push('📏 H: ' + esc(d.overallHeight) + 'm');
        if (d.crownSpread) metrics.push('🌳 Crown: ' + esc(d.crownSpread) + 'm');
        var gps = '';
        if (hasCoords(d)) gps = '<div class="tc-gps">📍 ' + Number(d.latitude).toFixed(5) + ', ' + Number(d.longitude).toFixed(5) + '</div>';
        return '<div class="tree-card" onclick="editTree(\'' + d.id + '\')">' +
            '<div class="tc-row"><span class="tc-id">🔢 ' + esc(d.treeIdNo || '—') + '</span>' + recBadge(d.recommendation) + '</div>' +
            '<div class="tc-row"><span class="tc-species"><i>' + esc(d.botanicalName || '—') + '</i></span></div>' +
            '<div class="tc-row"><span style="font-size:.85rem;">' + esc(d.chineseName || '—') + '</span></div>' +
            (metrics.length > 0 ? '<div class="tc-metrics">' + metrics.map(function(m) { return '<span>' + m + '</span>'; }).join('') + '</div>' : '') +
            '<div class="tc-row" style="margin-top:6px;">' + healthBadge(d.healthCondition) + ' ' + structBadge(d.structuralCondition) + '</div>' +
            gps +
            '<div class="tc-actions">' +
            (hasCoords(d) ? '<button class="btn btn-map-go" onclick="event.stopPropagation();focusTreeOnMap(\'' + d.id + '\')">📍 地圖</button>' : '') +
            '<button class="btn btn-outline btn-xs" onclick="event.stopPropagation();editTree(\'' + d.id + '\')">✏️ 編輯</button>' +
            '<button class="btn btn-danger btn-xs" onclick="event.stopPropagation();confirmDeleteTree(\'' + d.id + '\',\'' + esc(d.treeIdNo || d.id) + '\')">🗑</button>' +
            '</div></div>';
    }).join('');

    document.getElementById('treePagination').innerHTML =
        '<span>共 ' + count + ' 棵樹</span>' +
        '<div class="flex gap-2">' +
        '<button class="btn btn-outline btn-xs" onclick="AppState.treePage=0;invalidateAndReloadTrees();" ' + (AppState.treePage === 0 ? 'disabled' : '') + '>⏮</button>' +
        '<button class="btn btn-outline btn-xs" onclick="AppState.treePage=Math.max(0,AppState.treePage-1);invalidateAndReloadTrees();" ' + (AppState.treePage === 0 ? 'disabled' : '') + '>◀</button>' +
        '<button class="btn btn-outline btn-xs" onclick="AppState.treePage++;invalidateAndReloadTrees();" ' + ((AppState.treePage + 1) * PAGE_SIZE >= count ? 'disabled' : '') + '>▶</button>' +
        '</div>';
}

/**
 * 清除快取並重新載入
 */
function invalidateAndReloadTrees() {
    AppState.treesCache.invalidate();
    _loadProjectTrees();
}

/**
 * 搜尋樹木（重置頁碼，觸發 debounce 載入）
 */
function searchTrees() {
    AppState.treePage = 0;
    AppState.treesCache.invalidate();
    loadProjectTrees();
}

// ============================================================
// 樹木 CRUD
// ============================================================

/**
 * 顯示新增樹木 Modal
 */
function showTreeModal() {
    if (!AppState.currentProjectId) { toast('⚠️ 請先選擇專案', 'warning'); return; }
    document.getElementById('treeModalTitle').textContent = '🌲 新增樹木 — ' + AppState.currentProjectName;
    document.getElementById('tree_editId').value = '';
    [
        'tree_treeIdNo', 'tree_botanicalName', 'tree_chineseName', 'tree_trunkDiameter',
        'tree_overallHeight', 'tree_crownSpread', 'tree_healthCondition', 'tree_structuralCondition',
        'tree_amenityValue', 'tree_observedDefects', 'tree_recommendation', 'tree_remarks',
        'tree_latitude', 'tree_longitude'
    ].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    var accEl = document.getElementById('gpsAccuracy'); if (accEl) accEl.classList.add('hidden');
    var warn = document.getElementById('gpsProtocolWarn');
    if (warn) {
        if (!canUseGPS()) { warn.innerHTML = getProtocolWarningHTML(); warn.classList.remove('hidden'); }
        else { warn.classList.add('hidden'); }
    }
    AppState._photoData = [];
    AppState._photoCurrentTreeId = null;
    if (typeof renderPhotoGrid === 'function') renderPhotoGrid();
    showModal('treeModal');
    setTimeout(function() { if (typeof initSuggestDropdowns === 'function') initSuggestDropdowns(); }, 200);
}

/**
 * 編輯樹木 — 載入資料並顯示 Modal
 * @param {string} id - 樹 UUID
 */
function editTree(id) {
    if (!AppState.supabase) return;
    AppState.supabase.from('trees').select('*').eq('id', id).single().then(function(r) {
        if (r.error) { toast('❌ ' + r.error.message, 'error'); return; }
        var d = r.data;
        document.getElementById('treeModalTitle').textContent = '✏️ 編輯樹木';
        document.getElementById('tree_editId').value = d.id;
        document.getElementById('tree_treeIdNo').value = d.treeIdNo || '';
        document.getElementById('tree_botanicalName').value = d.botanicalName || '';
        document.getElementById('tree_chineseName').value = d.chineseName || '';
        document.getElementById('tree_trunkDiameter').value = d.trunkDiameter || '';
        document.getElementById('tree_overallHeight').value = d.overallHeight || '';
        document.getElementById('tree_crownSpread').value = d.crownSpread || '';
        document.getElementById('tree_healthCondition').value = d.healthCondition || '';
        document.getElementById('tree_structuralCondition').value = d.structuralCondition || '';
        document.getElementById('tree_amenityValue').value = d.amenityValue || '';
        document.getElementById('tree_observedDefects').value = d.observedDefects || '';
        document.getElementById('tree_recommendation').value = d.recommendation || '';
        document.getElementById('tree_remarks').value = d.remarks || '';
        document.getElementById('tree_latitude').value = (d.latitude != null) ? d.latitude : '';
        document.getElementById('tree_longitude').value = (d.longitude != null) ? d.longitude : '';
        document.getElementById('tree_editUpdatedAt').value = d.updatedAt || '';
        var accEl = document.getElementById('gpsAccuracy'); if (accEl) accEl.classList.add('hidden');
        var warn = document.getElementById('gpsProtocolWarn');
        if (warn) {
            if (!canUseGPS()) { warn.innerHTML = getProtocolWarningHTML(); warn.classList.remove('hidden'); }
            else { warn.classList.add('hidden'); }
        }
        AppState._photoData = [];
        AppState._photoCurrentTreeId = d.id;
        showModal('treeModal');
        setTimeout(function() {
            if (typeof initSuggestDropdowns === 'function') initSuggestDropdowns();
            if (typeof loadTreePhotos === 'function') loadTreePhotos(d.id);
        }, 200);
    });
}

/**
 * 儲存樹木（新增或更新，含 GPS 驗證）
 */
async function saveTree() {
    if (!AppState.currentProjectId) { toast('⚠️ 冇選擇專案', 'error'); return; }
    var tid = document.getElementById('tree_treeIdNo').value.trim();
    if (!tid) { toast('⚠️ 請輸入 Tree ID', 'warning'); return; }
    var eid = document.getElementById('tree_editId').value;
    var latVal = document.getElementById('tree_latitude').value.trim();
    var lngVal = document.getElementById('tree_longitude').value.trim();
    var latNum = latVal ? parseFloat(latVal) : null;
    var lngNum = lngVal ? parseFloat(lngVal) : null;
    if (latVal && isNaN(latNum)) { toast('⚠️ Latitude 格式錯誤', 'warning'); return; }
    if (lngVal && isNaN(lngNum)) { toast('⚠️ Longitude 格式錯誤', 'warning'); return; }
    if (latNum !== null && (latNum < -90 || latNum > 90)) { toast('⚠️ Latitude 超出範圍', 'warning'); return; }
    if (lngNum !== null && (lngNum < -180 || lngNum > 180)) { toast('⚠️ Longitude 超出範圍', 'warning'); return; }
    var p = {
        projectId: AppState.currentProjectId,
        treeIdNo: tid,
        botanicalName: document.getElementById('tree_botanicalName').value.trim(),
        chineseName: document.getElementById('tree_chineseName').value.trim(),
        trunkDiameter: document.getElementById('tree_trunkDiameter').value.trim(),
        overallHeight: document.getElementById('tree_overallHeight').value.trim(),
        crownSpread: document.getElementById('tree_crownSpread').value.trim(),
        healthCondition: document.getElementById('tree_healthCondition').value,
        structuralCondition: document.getElementById('tree_structuralCondition').value,
        amenityValue: document.getElementById('tree_amenityValue').value,
        observedDefects: document.getElementById('tree_observedDefects').value.trim(),
        recommendation: document.getElementById('tree_recommendation').value,
        remarks: document.getElementById('tree_remarks').value.trim(),
        latitude: latNum,
        longitude: lngNum,
        syncStatus: eid ? 'pending' : 'local',
        updatedAt: new Date().toISOString(),
        user_id: AppState.currentUser?.id
    };
    if (!eid) { p.id = uuid(); p.created_at = new Date().toISOString(); }
    var r = eid ?
        await AppState.supabase.from('trees').update(p).eq('id', eid).select() :
        await AppState.supabase.from('trees').insert(p).select();
    if (r.error) { toast('❌ ' + r.error.message, 'error'); return; }
    toast(eid ? '✅ 已更新' : '✅ 已新增');
    closeModal('treeModal');
    AppState._cachedTreeData = [];
    if (AppState.mapObj) { destroyMap(); }
    AppState.treesCache.invalidate();
    await loadProjectTrees();
    AppState.projectsCache.invalidate();
    await loadProjects();
}

/**
 * 確認刪除樹木
 * @param {string} id - 樹 UUID
 * @param {string} name - Tree ID 顯示名
 */
function confirmDeleteTree(id, name) {
    document.getElementById('confirmMsg').textContent = '確定要刪除樹木「' + name + '」？';
    AppState.pendingDelete = { type: 'tree', id: id, name: name };
    showModal('confirmModal');
}

// ============================================================
// 刪除確認執行（綁定到 confirmBtn）
// ============================================================
var confirmBtnEl = document.getElementById('confirmBtn');
if (confirmBtnEl) {
    confirmBtnEl.addEventListener('click', async function() {
        if (!AppState.pendingDelete || !AppState.supabase) return;
        try {
            if (AppState.pendingDelete.type === 'project') {
                await AppState.supabase.from('projects').delete().eq('id', AppState.pendingDelete.id);
            } else if (AppState.pendingDelete.type === 'tree') {
                await AppState.supabase.from('trees').delete().eq('id', AppState.pendingDelete.id);
            }
            toast('✅ 已刪除');
        } catch(e) { toast('❌ ' + e.message, 'error'); }
        closeModal('confirmModal');
        AppState._cachedTreeData = [];
        if (AppState.mapObj) { destroyMap(); }
        if (AppState.currentView === 'projects') {
            AppState.projectsCache.invalidate();
            loadProjects();
        }
        if (AppState.currentView === 'project-detail') {
            AppState.treesCache.invalidate();
            loadProjectTrees();
            AppState.projectsCache.invalidate();
            loadProjects();
        }
    });
}