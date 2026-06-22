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
const loadProjectTrees = debounce(_loadProjectTrees);

/**
 * 實際載入樹木列表（由 debounce 包裝）
 */
async function _loadProjectTrees() {
    if (AppState._loadingTrees) return;
    AppState._loadingTrees = true;
    const tb = document.getElementById('treesBody');
    const cv = document.getElementById('treeCardsView');
    if (!tb || !cv) { AppState._loadingTrees = false; return; }
    tb.innerHTML = '<tr><td colspan="10" class="empty">⏳ 載入中...</td></tr>';
    cv.innerHTML = '';
    if (!AppState.supabase || !AppState.currentProjectId) { AppState._loadingTrees = false; return; }

    // --- 快取檢查 ---
    const cacheKey = 'trees_' + AppState.currentProjectId + '_' + AppState.treePage + '_' + ((document.getElementById('treeSearch')?.value || '').trim());
    const cached = AppState.treesCache.get(cacheKey);
    if (cached) {
        _renderTreeTable(cached.data);
        _renderTreeCards(cached.data);
        _renderTreePagination(cached.count);
        AppState._loadingTrees = false;
        return;
    }

    try {
        // 載入專案資訊
        const pr = await AppState.supabase.from('projects').select('*').eq('id', AppState.currentProjectId).single();
        if (pr.data) document.getElementById('sProjectDate').textContent = pr.data.surveyDate || '—';

        const s = (document.getElementById('treeSearch')?.value || '').trim();
        let q = AppState.supabase.from('trees')
            .select('*', { count: 'exact' })
            .eq('projectId', AppState.currentProjectId)
            .range(AppState.treePage * PAGE_SIZE, (AppState.treePage + 1) * PAGE_SIZE - 1)
            .order('created_at', { ascending: false });
        if (s) q = q.or('treeIdNo.ilike.%' + s + '%,botanicalName.ilike.%' + s + '%,chineseName.ilike.%' + s + '%,remarks.ilike.%' + s + '%');
        const r = await q;
        if (r.error) {
            tb.innerHTML = '<tr><td colspan="10" class="empty" style="color:#f87171;">❌ ' + r.error.message + '</td></tr>';
            AppState._loadingTrees = false;
            return;
        }
        const count = r.count || 0;
        document.getElementById('sProjectTreeCount').textContent = count;

        // 有座標的數量
        try {
            const mc = await AppState.supabase.from('trees')
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
        _renderTreeTable(r.data);
        _renderTreeCards(r.data);
        _renderTreePagination(count);
    } catch(e) {
        tb.innerHTML = '<tr><td colspan="10" class="empty" style="color:#f87171;">❌ ' + e.message + '</td></tr>';
    }
    AppState._loadingTrees = false;
}

// ============================================================
// 渲染輔助函式（拆分自 renderTreesList）
// ============================================================

/**
 * 是否有 GPS 座標
 * @param {object} d - 樹木資料
 * @returns {boolean}
 */
function _hasCoords(d) {
    return d.latitude != null && d.longitude != null;
}

/**
 * 渲染樹木表格
 * @param {object[]} data
 */
function _renderTreeTable(data) {
    const tb = document.getElementById('treesBody');
    if (!tb) return;
    tb.innerHTML = '';
    const fragment = document.createDocumentFragment();
    data.forEach(function(d) {
        const tr = document.createElement('tr');

        // Col: Tree ID
        const tdId = document.createElement('td');
        const strong = document.createElement('strong');
        strong.textContent = d.treeIdNo || '—';
        strong.style.color = '#fbbf24';
        tdId.appendChild(strong);
        tr.appendChild(tdId);

        // Col: Botanical Name
        const tdBot = document.createElement('td');
        tdBot.style.cssText = 'font-style:italic;font-size:.78rem';
        tdBot.textContent = d.botanicalName || '—';
        tr.appendChild(tdBot);

        // Col: Chinese Name
        const tdChi = document.createElement('td');
        tdChi.textContent = d.chineseName || '—';
        tr.appendChild(tdChi);

        // Col: DBH
        const tdDbh = document.createElement('td');
        if (d.trunkDiameter) { tdDbh.textContent = d.trunkDiameter; }
        else { tdDbh.innerHTML = '<span class="null-cell">—</span>'; }
        tr.appendChild(tdDbh);

        // Col: Height
        const tdH = document.createElement('td');
        if (d.overallHeight) { tdH.textContent = d.overallHeight; }
        else { tdH.innerHTML = '<span class="null-cell">—</span>'; }
        tr.appendChild(tdH);

        // Col: Crown
        const tdCrown = document.createElement('td');
        if (d.crownSpread) { tdCrown.textContent = d.crownSpread; }
        else { tdCrown.innerHTML = '<span class="null-cell">—</span>'; }
        tr.appendChild(tdCrown);

        // Col: Health
        const tdHealth = document.createElement('td');
        tdHealth.appendChild(healthBadge(d.healthCondition));
        tr.appendChild(tdHealth);

        // Col: Structural
        const tdStruct = document.createElement('td');
        tdStruct.appendChild(structBadge(d.structuralCondition));
        tr.appendChild(tdStruct);

        // Col: Recommendation
        const tdRec = document.createElement('td');
        tdRec.appendChild(recBadge(d.recommendation));
        tr.appendChild(tdRec);

        // Col: Actions
        const tdAct = document.createElement('td');
        if (_hasCoords(d)) {
            const btnMap = elButton('📍', 'btn btn-map-go', function() { focusTreeOnMap(d.id); });
            tdAct.appendChild(btnMap);
            tdAct.appendChild(document.createTextNode(' '));
        }
        const btnEdit = elButton('✏️', 'btn btn-outline btn-xs', function() { editTree(d.id); });
        const btnDel = elButton('🗑', 'btn btn-danger btn-xs', function() { confirmDeleteTree(d.id, d.treeIdNo || d.id); });
        tdAct.appendChild(btnEdit);
        tdAct.appendChild(document.createTextNode(' '));
        tdAct.appendChild(btnDel);
        tr.appendChild(tdAct);

        fragment.appendChild(tr);
    });
    tb.appendChild(fragment);
}

/**
 * 渲染樹木卡片（手機版）
 * @param {object[]} data
 */
function _renderTreeCards(data) {
    const cv = document.getElementById('treeCardsView');
    if (!cv) return;
    cv.innerHTML = '';
    const fragment = document.createDocumentFragment();
    data.forEach(function(d) {
        const card = document.createElement('div');
        card.className = 'tree-card';
        card.addEventListener('click', function() { editTree(d.id); });

        // Row 1: ID + Recommendation badge
        const row1 = document.createElement('div');
        row1.className = 'tc-row';
        const idSpan = document.createElement('span');
        idSpan.className = 'tc-id';
        idSpan.textContent = '🔢 ' + (d.treeIdNo || '—');
        row1.appendChild(idSpan);
        row1.appendChild(recBadge(d.recommendation));
        card.appendChild(row1);

        // Row 2: Botanical Name
        const row2 = document.createElement('div');
        row2.className = 'tc-row';
        const spSpan = document.createElement('span');
        spSpan.className = 'tc-species';
        const italic = document.createElement('i');
        italic.textContent = d.botanicalName || '—';
        spSpan.appendChild(italic);
        row2.appendChild(spSpan);
        card.appendChild(row2);

        // Row 3: Chinese Name
        const row3 = document.createElement('div');
        row3.className = 'tc-row';
        const chiSpan = document.createElement('span');
        chiSpan.style.fontSize = '.85rem';
        chiSpan.textContent = d.chineseName || '—';
        row3.appendChild(chiSpan);
        card.appendChild(row3);

        // Metrics row
        const metrics = [];
        if (d.trunkDiameter) metrics.push('📐 DBH: ' + d.trunkDiameter + 'mm');
        if (d.overallHeight) metrics.push('📏 H: ' + d.overallHeight + 'm');
        if (d.crownSpread) metrics.push('🌳 Crown: ' + d.crownSpread + 'm');
        if (metrics.length > 0) {
            const metRow = document.createElement('div');
            metRow.className = 'tc-metrics';
            metrics.forEach(function(m) {
                const s = document.createElement('span');
                s.textContent = m;
                metRow.appendChild(s);
            });
            card.appendChild(metRow);
        }

        // Row: Health + Structural badges
        const rowBadges = document.createElement('div');
        rowBadges.className = 'tc-row';
        rowBadges.style.marginTop = '6px';
        rowBadges.appendChild(healthBadge(d.healthCondition));
        rowBadges.appendChild(document.createTextNode(' '));
        rowBadges.appendChild(structBadge(d.structuralCondition));
        card.appendChild(rowBadges);

        // GPS coordinates
        if (_hasCoords(d)) {
            const gpsDiv = document.createElement('div');
            gpsDiv.className = 'tc-gps';
            gpsDiv.textContent = '📍 ' + Number(d.latitude).toFixed(5) + ', ' + Number(d.longitude).toFixed(5);
            card.appendChild(gpsDiv);
        }

        // Actions
        const actions = document.createElement('div');
        actions.className = 'tc-actions';
        if (_hasCoords(d)) {
            actions.appendChild(elButton('📍 地圖', 'btn btn-map-go', function() { focusTreeOnMap(d.id); }));
        }
        actions.appendChild(elButton('✏️ 編輯', 'btn btn-outline btn-xs', function() { editTree(d.id); }));
        actions.appendChild(elButton('🗑', 'btn btn-danger btn-xs', function() { confirmDeleteTree(d.id, d.treeIdNo || d.id); }));
        card.appendChild(actions);

        fragment.appendChild(card);
    });
    cv.appendChild(fragment);
}

/**
 * 渲染樹木分頁控制
 * @param {number} count - 總筆數
 */
function _renderTreePagination(count) {
    const el2 = document.getElementById('treePagination');
    if (!el2) return;
    el2.innerHTML = '';

    const span = document.createElement('span');
    span.textContent = '共 ' + count + ' 棵樹';
    el2.appendChild(span);

    const btnsDiv = document.createElement('div');
    btnsDiv.className = 'flex gap-2';

    const btnFirst = elButton('⏮', 'btn btn-outline btn-xs', function() { AppState.treePage = 0; invalidateAndReloadTrees(); });
    if (AppState.treePage === 0) btnFirst.disabled = true;
    btnsDiv.appendChild(btnFirst);

    const btnPrev = elButton('◀', 'btn btn-outline btn-xs', function() { AppState.treePage = Math.max(0, AppState.treePage - 1); invalidateAndReloadTrees(); });
    if (AppState.treePage === 0) btnPrev.disabled = true;
    btnsDiv.appendChild(btnPrev);

    const btnNext = elButton('▶', 'btn btn-outline btn-xs', function() { AppState.treePage++; invalidateAndReloadTrees(); });
    if ((AppState.treePage + 1) * PAGE_SIZE >= count) btnNext.disabled = true;
    btnsDiv.appendChild(btnNext);

    el2.appendChild(btnsDiv);
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
// 樹木 Modal 表單輔助
// ============================================================

/**
 * 重置樹木表單欄位
 * @param {boolean} isEdit - 是否為編輯模式
 */
function _resetTreeForm(isEdit) {
    const titleEl = document.getElementById('treeModalTitle');
    titleEl.textContent = isEdit ? '✏️ 編輯樹木' : '🌲 新增樹木 — ' + AppState.currentProjectName;
    [
        'tree_treeIdNo', 'tree_botanicalName', 'tree_chineseName', 'tree_trunkDiameter',
        'tree_overallHeight', 'tree_crownSpread', 'tree_healthCondition', 'tree_structuralCondition',
        'tree_amenityValue', 'tree_observedDefects', 'tree_recommendation', 'tree_remarks',
        'tree_latitude', 'tree_longitude'
    ].forEach(function(id) { const el = document.getElementById(id); if (el) el.value = ''; });
    const accEl = document.getElementById('gpsAccuracy'); if (accEl) accEl.classList.add('hidden');
    _setupGPSWarning();
    AppState._photoData = [];
    AppState._photoCurrentTreeId = null;
    if (typeof renderPhotoGrid === 'function') renderPhotoGrid();
}

/**
 * 設定 GPS 協議警告區塊
 */
function _setupGPSWarning() {
    const warn = document.getElementById('gpsProtocolWarn');
    if (!warn) return;
    if (!canUseGPS()) {
        warn.innerHTML = getProtocolWarningHTML();
        warn.classList.remove('hidden');
    } else {
        warn.classList.add('hidden');
    }
}

// ============================================================
// 樹木 CRUD
// ============================================================

/**
 * 顯示新增樹木 Modal
 */
function showTreeModal() {
    if (!AppState.currentProjectId) { toast('⚠️ 請先選擇專案', 'warning'); return; }
    document.getElementById('tree_editId').value = '';
    _resetTreeForm(false);
    showModal('treeModal');
    setTimeout(function() { if (typeof initSuggestDropdowns === 'function') initSuggestDropdowns(); }, DELAY_SUGGEST_INIT);
}

/**
 * 編輯樹木 — 載入資料並顯示 Modal
 * @param {string} id - 樹 UUID
 */
function editTree(id) {
    if (!AppState.supabase) return;
    AppState.supabase.from('trees').select('*').eq('id', id).single().then(function(r) {
        if (r.error) { toast('❌ ' + r.error.message, 'error'); return; }
        const d = r.data;
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
        document.getElementById('treeModalTitle').textContent = '✏️ 編輯樹木';
        const accEl = document.getElementById('gpsAccuracy'); if (accEl) accEl.classList.add('hidden');
        _setupGPSWarning();
        AppState._photoData = [];
        AppState._photoCurrentTreeId = d.id;
        showModal('treeModal');
        setTimeout(function() {
            if (typeof initSuggestDropdowns === 'function') initSuggestDropdowns();
            if (typeof loadTreePhotos === 'function') loadTreePhotos(d.id);
        }, DELAY_SUGGEST_INIT);
    });
}

/**
 * 儲存樹木（新增或更新，含 GPS 驗證）
 */
async function saveTree() {
    if (!AppState.currentProjectId) { toast('⚠️ 冇選擇專案', 'error'); return; }
    const tid = document.getElementById('tree_treeIdNo').value.trim();
    if (!tid) { toast('⚠️ 請輸入 Tree ID', 'warning'); return; }
    const eid = document.getElementById('tree_editId').value;
    const latVal = document.getElementById('tree_latitude').value.trim();
    const lngVal = document.getElementById('tree_longitude').value.trim();
    const latNum = latVal ? parseFloat(latVal) : null;
    const lngNum = lngVal ? parseFloat(lngVal) : null;
    if (latVal && isNaN(latNum)) { toast('⚠️ Latitude 格式錯誤', 'warning'); return; }
    if (lngVal && isNaN(lngNum)) { toast('⚠️ Longitude 格式錯誤', 'warning'); return; }
    if (latNum !== null && (latNum < -90 || latNum > 90)) { toast('⚠️ Latitude 超出範圍', 'warning'); return; }
    if (lngNum !== null && (lngNum < -180 || lngNum > 180)) { toast('⚠️ Longitude 超出範圍', 'warning'); return; }
    const p = {
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
    const r = eid ?
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
const confirmBtnEl = document.getElementById('confirmBtn');
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

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.tree = {
    loadProjectTrees: loadProjectTrees,
    _loadProjectTrees: _loadProjectTrees,
    _hasCoords: _hasCoords,
    _renderTreeTable: _renderTreeTable,
    _renderTreeCards: _renderTreeCards,
    _renderTreePagination: _renderTreePagination,
    invalidateAndReloadTrees: invalidateAndReloadTrees,
    searchTrees: searchTrees,
    showTreeModal: showTreeModal,
    editTree: editTree,
    saveTree: saveTree,
    confirmDeleteTree: confirmDeleteTree
};