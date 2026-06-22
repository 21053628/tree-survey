/**
 * 🌳 樹木調查系統 — 專案 CRUD 模組
 * @module projects
 * 
 * 專案列表（含搜尋 debounce + 記憶體快取 TTL 5 分鐘）、
 * 新增/編輯/刪除專案、統計卡片更新。
 */

// ============================================================
// 專案列表載入（含 debounce + 快取）
// ============================================================

/**
 * 載入專案列表（含 debounce 延遲）
 * 直接呼叫會被 debounce；呼叫 searchProjects() 也是走此路徑
 */
var loadProjects = debounce(_loadProjects);

/**
 * 實際載入專案列表（由 debounce 包裝）
 */
async function _loadProjects() {
    if (AppState._loadingProjects) return;
    AppState._loadingProjects = true;
    var tb = document.getElementById('projectsBody');
    var cv = document.getElementById('projCardsView');
    if (!tb || !cv) { AppState._loadingProjects = false; return; }
    tb.innerHTML = '<tr><td colspan="5" class="empty">⏳ 載入中...</td></tr>';
    cv.innerHTML = '';
    if (!AppState.supabase) {
        tb.innerHTML = '<tr><td colspan="5" class="empty">⏳ 初始化中...</td></tr>';
        AppState._loadingProjects = false;
        return;
    }

    // --- 快取檢查 ---
    var cacheKey = 'proj_' + AppState.projPage + '_' + ((document.getElementById('projSearch')?.value || '').trim());
    var cached = AppState.projectsCache.get(cacheKey);
    if (cached) {
        renderProjectsList(cached.data, cached.treeCounts, cached.count);
        AppState._loadingProjects = false;
        return;
    }

    try {
        var s = (document.getElementById('projSearch')?.value || '').trim();
        var q = AppState.supabase.from('projects')
            .select('*', { count: 'exact' })
            .range(AppState.projPage * PAGE_SIZE, (AppState.projPage + 1) * PAGE_SIZE - 1)
            .order('created_at', { ascending: false });
        if (s) q = q.or('name.ilike.%' + s + '%,notes.ilike.%' + s + '%');
        var r = await q;
        if (r.error) {
            tb.innerHTML = '<tr><td colspan="5" class="empty" style="color:#f87171;">❌ ' + r.error.message + '</td></tr>';
            AppState._loadingProjects = false;
            return;
        }
        if (!r.data || r.data.length === 0) {
            tb.innerHTML = '<tr><td colspan="5" class="empty"><span class="icon">📭</span>暫無專案<br><button class="btn btn-success btn-sm mt-3" onclick="showProjectModal()">➕ 新增專案</button></td></tr>';
            cv.innerHTML = '<div class="empty"><span class="icon">📭</span>暫無專案<br><button class="btn btn-success btn-sm mt-3" onclick="showProjectModal()">➕ 新增專案</button></div>';
            document.getElementById('projPagination').innerHTML = '';
            document.getElementById('sProjects').textContent = '0';
            document.getElementById('sTrees').textContent = '0';
            AppState._loadingProjects = false;
            return;
        }

        // 計算每專案樹木數量 — 使用 fetchAllPages 一次載入全部
        var treeCounts = {};
        if (r.data.length > 0) {
            var projectIds = r.data.map(function(d) { return d.id; });
            var allTreeRefs = await fetchAllPages(
                AppState.supabase.from('trees').select('projectId').in('projectId', projectIds)
            );
            allTreeRefs.forEach(function(t) { treeCounts[t.projectId] = (treeCounts[t.projectId] || 0) + 1; });
        }

        // 存入快取
        AppState.projectsCache.set(cacheKey, {
            data: r.data,
            treeCounts: treeCounts,
            count: r.count || 0
        });

        renderProjectsList(r.data, treeCounts, r.count || 0);
    } catch(e) {
        tb.innerHTML = '<tr><td colspan="5" class="empty" style="color:#f87171;">❌ ' + e.message + '</td></tr>';
    }
    AppState._loadingProjects = false;
}

/**
 * 渲染專案列表到 DOM（表格 + 卡片視圖 + 統計）
 * @param {object[]} data - 專案資料
 * @param {Object<string, number>} treeCounts - 各專案樹木數量
 * @param {number} totalCount - 總數
 */
function renderProjectsList(data, treeCounts, totalCount) {
    var tb = document.getElementById('projectsBody');
    var cv = document.getElementById('projCardsView');
    var fragment = document.createDocumentFragment();

    // Table View
    tb.innerHTML = '';
    data.forEach(function(d) {
        var c = treeCounts[d.id] !== undefined ? treeCounts[d.id] : '...';
        var tr = document.createElement('tr');

        // Col 1: Name (clickable)
        var td1 = document.createElement('td');
        var strong = document.createElement('strong');
        strong.textContent = '📁 ' + (d.name || '');
        strong.style.cssText = 'color:#a5b4fc;cursor:pointer';
        strong.addEventListener('click', function() { openProject(d.id, d.name); });
        td1.appendChild(strong);
        tr.appendChild(td1);

        // Col 2: Date
        var td2 = document.createElement('td');
        if (d.surveyDate) { td2.textContent = d.surveyDate; }
        else { td2.innerHTML = '<span class="null-cell">—</span>'; }
        tr.appendChild(td2);

        // Col 3: Tree count badge
        var td3 = document.createElement('td');
        var badge = document.createElement('span');
        badge.className = 'badge badge-green';
        badge.textContent = c + ' 棵';
        td3.appendChild(badge);
        tr.appendChild(td3);

        // Col 4: Notes
        var td4 = document.createElement('td');
        if (d.notes) { td4.textContent = d.notes.substring(0, 30); }
        else { td4.innerHTML = '<span class="null-cell">—</span>'; }
        tr.appendChild(td4);

        // Col 5: Actions
        var td5 = document.createElement('td');
        var btn1 = elButton('🌲', 'btn btn-outline btn-xs', function() { openProject(d.id, d.name); });
        var btn2 = elButton('✏️', 'btn btn-outline btn-xs', function() { editProject(d.id); });
        var btn3 = elButton('🗑', 'btn btn-danger btn-xs', function() { confirmDeleteProject(d.id, d.name); });
        td5.appendChild(btn1);
        td5.appendChild(document.createTextNode(' '));
        td5.appendChild(btn2);
        td5.appendChild(document.createTextNode(' '));
        td5.appendChild(btn3);
        tr.appendChild(td5);

        tb.appendChild(tr);
    });

    // Card View (mobile)
    cv.innerHTML = '';
    data.forEach(function(d) {
        var c = treeCounts[d.id] !== undefined ? treeCounts[d.id] : '...';
        var card = document.createElement('div');
        card.className = 'proj-card';
        card.addEventListener('click', function() { openProject(d.id, d.name); });

        var info = document.createElement('div');
        info.className = 'pc-info';

        var nameDiv = document.createElement('div');
        nameDiv.className = 'pc-name';
        nameDiv.textContent = '📁 ' + (d.name || '');
        info.appendChild(nameDiv);

        var meta = document.createElement('div');
        meta.className = 'pc-meta';

        var dateSpan = document.createElement('span');
        dateSpan.textContent = '📅 ' + (d.surveyDate || '—');
        meta.appendChild(dateSpan);

        var countSpan = document.createElement('span');
        countSpan.className = 'badge badge-green';
        countSpan.textContent = '🌲 ' + c + ' 棵';
        meta.appendChild(countSpan);

        if (d.notes) {
            var noteSpan = document.createElement('span');
            noteSpan.textContent = d.notes.substring(0, 40);
            meta.appendChild(noteSpan);
        }
        info.appendChild(meta);
        card.appendChild(info);

        var actions = document.createElement('div');
        actions.className = 'pc-actions';
        actions.appendChild(elButton('✏️', 'btn btn-outline btn-xs', function() { editProject(d.id); }));
        actions.appendChild(elButton('🗑', 'btn btn-danger btn-xs', function() { confirmDeleteProject(d.id, d.name); }));
        card.appendChild(actions);

        cv.appendChild(card);
    });

    var totalTrees = Object.values(treeCounts).reduce(function(a, b) {
        return (typeof a === 'number' ? a : 0) + (typeof b === 'number' ? b : 0);
    }, 0);

    // Pagination
    var pagEl = document.getElementById('projPagination');
    pagEl.innerHTML = '';
    var pagSpan = document.createElement('span');
    pagSpan.textContent = '共 ' + totalCount + ' 個專案';
    pagEl.appendChild(pagSpan);

    var pagBtns = document.createElement('div');
    pagBtns.className = 'flex gap-2';

    var btnFirst = elButton('⏮', 'btn btn-outline btn-xs', function() { AppState.projPage = 0; invalidateAndReloadProjects(); });
    if (AppState.projPage === 0) btnFirst.disabled = true;
    pagBtns.appendChild(btnFirst);

    var btnPrev = elButton('◀', 'btn btn-outline btn-xs', function() { AppState.projPage = Math.max(0, AppState.projPage - 1); invalidateAndReloadProjects(); });
    if (AppState.projPage === 0) btnPrev.disabled = true;
    pagBtns.appendChild(btnPrev);

    var btnNext = elButton('▶', 'btn btn-outline btn-xs', function() { AppState.projPage++; invalidateAndReloadProjects(); });
    if ((AppState.projPage + 1) * PAGE_SIZE >= totalCount) btnNext.disabled = true;
    pagBtns.appendChild(btnNext);

    pagEl.appendChild(pagBtns);

    document.getElementById('sProjects').textContent = totalCount;
    document.getElementById('sTrees').textContent = totalTrees;
}

/**
 * 清除快取並重新載入
 */
function invalidateAndReloadProjects() {
    AppState.projectsCache.invalidate();
    _loadProjects();
}

/**
 * 搜尋專案（重置頁碼，觸發 debounce 載入）
 */
function searchProjects() {
    AppState.projPage = 0;
    AppState.projectsCache.invalidate();
    loadProjects();
}

// ============================================================
// 專案 CRUD
// ============================================================

/**
 * 顯示新增專案 Modal
 */
function showProjectModal() {
    document.getElementById('projectModalTitle').textContent = '📁 新增專案';
    document.getElementById('proj_editId').value = '';
    document.getElementById('proj_name').value = '';
    document.getElementById('proj_surveyDate').value = todayStr();
    document.getElementById('proj_notes').value = '';
    showModal('projectModal');
}

/**
 * 編輯專案 — 載入資料並顯示 Modal
 * @param {string} id - 專案 UUID
 */
function editProject(id) {
    if (!AppState.supabase) return;
    AppState.supabase.from('projects').select('*').eq('id', id).single().then(function(r) {
        if (r.error) { toast('❌ ' + r.error.message, 'error'); return; }
        var d = r.data;
        document.getElementById('projectModalTitle').textContent = '✏️ 編輯專案';
        document.getElementById('proj_editId').value = d.id;
        document.getElementById('proj_name').value = d.name || '';
        document.getElementById('proj_surveyDate').value = d.surveyDate || '';
        document.getElementById('proj_notes').value = d.notes || '';
        showModal('projectModal');
    });
}

/**
 * 儲存專案（新增或更新）
 */
async function saveProject() {
    var nm = document.getElementById('proj_name').value.trim();
    if (!nm) { toast('⚠️ 請輸入名稱', 'warning'); return; }
    var eid = document.getElementById('proj_editId').value;
    var p = {
        name: nm,
        surveyDate: document.getElementById('proj_surveyDate').value,
        notes: document.getElementById('proj_notes').value.trim(),
        user_id: AppState.currentUser?.id
    };
    if (!eid) { p.id = uuid(); p.created_at = new Date().toISOString(); }
    var r = eid ?
        await AppState.supabase.from('projects').update(p).eq('id', eid).select() :
        await AppState.supabase.from('projects').insert(p).select();
    if (r.error) { toast('❌ ' + r.error.message, 'error'); return; }
    toast(eid ? '✅ 已更新' : '✅ 已新增');
    closeModal('projectModal');
    AppState.projectsCache.invalidate();
    loadProjects();
}

/**
 * 確認刪除專案（含樹木數量查詢）
 * @param {string} id - 專案 UUID
 * @param {string} name - 專案名稱
 */
function confirmDeleteProject(id, name) {
    AppState.supabase.from('trees').select('id', { count: 'exact', head: true }).eq('projectId', id).then(function(r) {
        var tc = r.count || 0;
        var msg = '刪除專案「' + name + '」';
        if (tc > 0) msg += ' 及裡面 ' + tc + ' 棵樹';
        msg += '？此操作無法復原。';
        document.getElementById('confirmMsg').textContent = msg;
        AppState.pendingDelete = { type: 'project', id: id, name: name };
        showModal('confirmModal');
    }).catch(function(e) { toast('❌ ' + e.message, 'error'); });
}

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.project = {
    loadProjects: loadProjects,
    _loadProjects: _loadProjects,
    renderProjectsList: renderProjectsList,
    invalidateAndReloadProjects: invalidateAndReloadProjects,
    searchProjects: searchProjects,
    showProjectModal: showProjectModal,
    editProject: editProject,
    saveProject: saveProject,
    confirmDeleteProject: confirmDeleteProject
};
