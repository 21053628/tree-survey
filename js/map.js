/**
 * 🌳 樹木調查系統 — Leaflet 地圖模組
 * @module map
 * 
 * 地圖渲染、標記管理、健康狀態濾鏡、搜尋、樹木定位聚焦、
 * 地圖銷毀及 popup 照片 strip 載入。
 */

// ============================================================
// 地圖銷毀
// ============================================================

/**
 * 銷毀當前地圖及所有標記（釋放記憶體）
 */
function destroyMap() {
    if (AppState.mapObj) { AppState.mapObj.remove(); AppState.mapObj = null; }
    AppState.mapMarkers = [];
    AppState.markerLookup = {};
    AppState._cachedTreeData = [];
    AppState._hiddenHealth = {};
    if (AppState._locateMarker) { AppState._locateMarker = null; }
    document.querySelectorAll('.filter-toggle').forEach(function(b) {
        b.classList.add('on');
        b.classList.remove('off');
    });
    const si = document.getElementById('mapSearchInput');
    if (si) si.value = '';
    const st = document.getElementById('mapStatus');
    if (st) st.textContent = '';
}

// ============================================================
// 標記顏色
// ============================================================

/**
 * 根據健康狀態回傳標記顏色
 * @param {string|null} health
 * @returns {string} hex color
 */
function getMarkerColor(health) {
    const h = (health || '').toLowerCase();
    if (h === 'good') return '#10b981';
    if (h === 'fair') return '#f59e0b';
    if (h === 'poor') return '#ef4444';
    if (h === 'dead') return '#6b7280';
    return '#94a3b8';
}

// ============================================================
// Popup 內容建立（純 DOM API，防 XSS）
// ============================================================

/**
 * 安全建立樹木 Popup 內容
 * 所有使用者資料透過 textContent / createTextNode 寫入，永不解析為 HTML
 * @param {object} t - 樹木資料
 * @returns {HTMLElement}
 */
function buildTreePopupContent(t) {
    const container = document.createElement('div');

    // Row 1: Tree ID (bold, gold color)
    const idEl = document.createElement('strong');
    idEl.textContent = t.treeIdNo || '—';
    idEl.style.color = '#fbbf24';
    container.appendChild(idEl);
    container.appendChild(document.createElement('br'));

    // Row 2: Botanical Name (italic) + Chinese Name
    const italicEl = document.createElement('i');
    italicEl.textContent = t.botanicalName || '';
    container.appendChild(italicEl);
    container.appendChild(document.createTextNode(' ' + (t.chineseName || '')));
    container.appendChild(document.createElement('br'));

    // Row 3: DBH (optional)
    if (t.trunkDiameter) {
        container.appendChild(document.createTextNode('📐 DBH: ' + t.trunkDiameter + 'mm'));
        container.appendChild(document.createElement('br'));
    }

    // Row 4: Height (optional)
    if (t.overallHeight) {
        container.appendChild(document.createTextNode('📏 H: ' + t.overallHeight + 'm'));
        container.appendChild(document.createElement('br'));
    }

    // Row 5: Crown (optional)
    if (t.crownSpread) {
        container.appendChild(document.createTextNode('🌳 Crown: ' + t.crownSpread + 'm'));
        container.appendChild(document.createElement('br'));
    }

    // Row 6: Health + Structural
    container.appendChild(document.createTextNode('💚 ' + (t.healthCondition || '—') + ' | 🏗️ ' + (t.structuralCondition || '—')));
    container.appendChild(document.createElement('br'));

    // Row 7: GPS Coordinates
    const lat = Number(t.latitude), lng = Number(t.longitude);
    container.appendChild(document.createTextNode('📍 ' + lat.toFixed(6) + ', ' + lng.toFixed(6)));
    container.appendChild(document.createElement('br'));

    // Row 8: Photo Strip placeholder
    const stripDiv = document.createElement('div');
    stripDiv.className = 'popup-photo-strip';
    stripDiv.setAttribute('data-tree-db-id', t.id);
    const stripLoading = document.createElement('div');
    stripLoading.className = 'strip-loading';
    stripLoading.textContent = '📷 點擊載入照片...';
    stripDiv.appendChild(stripLoading);
    container.appendChild(stripDiv);

    // Row 9: Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'pop-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️ 編輯';
    editBtn.setAttribute('data-action', 'edit-tree');
    editBtn.setAttribute('data-tree-id', t.id);
    actionsDiv.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑 刪除';
    delBtn.style.cssText = 'color:#f87171;border-color:rgba(239,68,68,.4)';
    delBtn.setAttribute('data-action', 'delete-tree');
    delBtn.setAttribute('data-tree-id', t.id);
    delBtn.setAttribute('data-tree-name', t.treeIdNo || t.id);
    actionsDiv.appendChild(delBtn);

    container.appendChild(actionsDiv);
    return container;
}

// ============================================================
// 地圖渲染入口
// ============================================================

/**
 * 渲染地圖（從快取或 DB 載入）
 */
function renderMap() {
    if (!leafletReady()) { toast('⚠️ 地圖 library 未載入', 'warning'); return; }
    if (AppState._cachedTreeData.length > 0) {
        _doRenderMap(AppState._cachedTreeData);
    } else {
        _doRenderMapFromDB();
    }
}

/**
 * 從 DB 載入樹木資料並渲染地圖（使用 fetchAllPages 統一工具）
 */
async function _doRenderMapFromDB() {
    if (!AppState.supabase || !AppState.currentProjectId) return;
    try {
        const allTrees = await fetchAllPages(
            AppState.supabase.from('trees')
                .select('id,treeIdNo,botanicalName,chineseName,healthCondition,structuralCondition,recommendation,trunkDiameter,overallHeight,crownSpread,latitude,longitude')
                .eq('projectId', AppState.currentProjectId)
                .order('treeIdNo', { ascending: true })
        );
        AppState._cachedTreeData = allTrees;
        _doRenderMap(allTrees);
    } catch(e) {
        toast('❌ Map load error: ' + e.message, 'error');
        document.getElementById('mapStatus').textContent = '❌ 載入失敗';
    }
}

/**
 * 實際執行地圖渲染
 * @param {object[]} trees - 樹木資料陣列
 */
function _doRenderMap(trees) {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    destroyMap();
    AppState.mapObj = L.map('mapContainer', { zoomControl: true, attributionControl: true }).setView(HK_CENTER, MAP_DEFAULT_ZOOM);
    const layerCfg = LAYER_CONFIG[AppState._currentLayer] || LAYER_CONFIG['dark'];
    AppState.mapObj._currentTileLayer = L.tileLayer(layerCfg.url, layerCfg.options).addTo(AppState.mapObj);
    document.querySelectorAll('#view-project-map .layer-toggle').forEach(function(b) {
        b.classList.toggle('active', b.dataset.layer === AppState._currentLayer);
    });

    /** @type {object[]} */
    const withCoords = trees.filter(function(t) {
        return t.latitude != null && t.longitude != null && !isNaN(Number(t.latitude)) && !isNaN(Number(t.longitude));
    });
    document.getElementById('sProjectMappedCount').textContent = withCoords.length;

    if (withCoords.length === 0) {
        AppState.mapObj.setView(HK_CENTER, MAP_NO_COORDS_ZOOM);
        document.getElementById('mapStatus').textContent = '冇樹有座標';
        return;
    }

    const bounds = [];
    withCoords.forEach(function(t) {
        const lat = Number(t.latitude), lng = Number(t.longitude);
        const color = getMarkerColor(t.healthCondition);
        const icon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="width:16px;height:16px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
            iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10]
        });
        const marker = L.marker([lat, lng], { icon: icon }).addTo(AppState.mapObj);
        marker._treeId = t.treeIdNo || '';
        marker._health = t.healthCondition || '';
        marker._botanicalName = t.botanicalName || '';
        marker._chineseName = t.chineseName || '';
        marker._dbId = t.id;
        marker.bindTooltip((t.treeIdNo || '?'), {
            permanent: true, direction: 'top', className: 'tree-label', offset: [0, -8]
        });
        marker.bindPopup(buildTreePopupContent(t));
        AppState.mapMarkers.push(marker);
        if (t.id) AppState.markerLookup[t.id] = marker;
        bounds.push([lat, lng]);
    });

    // Popup 打開時載入照片 strip + 綁定按鈕事件（事件委派，取代 inline onclick）
    AppState.mapObj.on('popupopen', function(e) {
        const popupEl = e.popup.getElement();
        if (popupEl) {
            const strip = popupEl.querySelector('.popup-photo-strip');
            if (strip) {
                const treeId = strip.getAttribute('data-tree-db-id');
                if (treeId && typeof loadPhotosIntoPopup === 'function') {
                    loadPhotosIntoPopup(treeId, strip);
                }
            }
            // 事件委派：處理 popup 內的按鈕點擊
            const editBtn = popupEl.querySelector('[data-action="edit-tree"]');
            if (editBtn && !editBtn._bound) {
                editBtn._bound = true;
                editBtn.addEventListener('click', function() {
                    const id = this.getAttribute('data-tree-id');
                    if (id) editTree(id);
                });
            }
            const delBtn = popupEl.querySelector('[data-action="delete-tree"]');
            if (delBtn && !delBtn._bound) {
                delBtn._bound = true;
                delBtn.addEventListener('click', function() {
                    const id = this.getAttribute('data-tree-id');
                    const name = this.getAttribute('data-tree-name');
                    if (id) confirmDeleteTree(id, name || id);
                });
            }
        }
    });

    // 處理待定位的樹（來自列表點擊）
    if (AppState._pendingFocusTreeId) {
        const focusMarker = AppState.markerLookup[AppState._pendingFocusTreeId];
        if (focusMarker) {
            AppState.mapObj.setView(focusMarker.getLatLng(), MAP_FOCUS_ZOOM, { animate: false });
            setTimeout(function() { focusMarker.openPopup(); }, DELAY_FOCUS_OPEN_POPUP);
            const focusTooltip = focusMarker.getTooltip();
            if (focusTooltip) {
                setTimeout(function() {
                    const fe = focusTooltip.getElement();
                    if (fe) { fe.classList.add('highlight'); setTimeout(function() { fe.classList.remove('highlight'); }, DELAY_GPS_WARN); }
                }, DELAY_FOCUS_LABEL);
            }
            const focusIconEl = focusMarker.getElement();
            if (focusIconEl) {
                setTimeout(function() {
                    focusIconEl.style.transition = 'transform 0.3s ease';
                    focusIconEl.style.transform = 'translateY(-8px)';
                    setTimeout(function() { focusIconEl.style.transform = 'translateY(0)'; }, DELAY_FOCUS_OPEN_POPUP);
                }, DELAY_FOCUS_ICON_ANIM);
            }
            const si = document.getElementById('mapSearchInput');
            if (si) si.value = focusMarker._treeId || AppState._pendingFocusTreeId;
            const focusTreeData = AppState._cachedTreeData.find(function(t) { return t.id === AppState._pendingFocusTreeId; });
            if (focusTreeData && focusTreeData.healthCondition && AppState._hiddenHealth[focusTreeData.healthCondition]) {
                toggleHealthFilter(focusTreeData.healthCondition, null);
            }
            document.getElementById('mapStatus').textContent = '📍 已定位 ' + (focusMarker._treeId || '') + ' | 全部 ' + withCoords.length + ' 棵';
        } else {
            if (bounds.length === 1) AppState.mapObj.setView(bounds[0], MAP_SINGLE_MARKER_ZOOM);
            else if (bounds.length > 1) AppState.mapObj.fitBounds(bounds, { padding: [30, 30], maxZoom: MAP_FOCUS_ZOOM });
            document.getElementById('mapStatus').textContent = '全部 ' + withCoords.length + ' 棵';
        }
        AppState._pendingFocusTreeId = null;
        AppState._focusResolved = true;
    } else {
        AppState._focusResolved = true;
        if (bounds.length === 1) AppState.mapObj.setView(bounds[0], MAP_SINGLE_MARKER_ZOOM);
        else if (bounds.length > 1) AppState.mapObj.fitBounds(bounds, { padding: [30, 30], maxZoom: MAP_FOCUS_ZOOM });
        document.getElementById('mapStatus').textContent = '全部 ' + withCoords.length + ' 棵';
    }
    setTimeout(function() { if (AppState.mapObj) AppState.mapObj.invalidateSize(); }, DELAY_MAP_INVALIDATE_1);
    setTimeout(function() { if (AppState.mapObj) AppState.mapObj.invalidateSize(); }, DELAY_MAP_INVALIDATE_2);
}

// ============================================================
// 列表 → 地圖同步定位
// ============================================================

/**
 * 從列表點擊「📍」時，切換到地圖並聚焦指定樹木
 * @param {string} treeId - 樹的 UUID
 */
function focusTreeOnMap(treeId) {
    AppState.currentDetailTab = 'map';
    document.getElementById('view-project-list').classList.add('hidden');
    document.getElementById('view-project-map').classList.remove('hidden');
    document.getElementById('tabList').classList.remove('active');
    document.getElementById('tabMap').classList.add('active');

    if (AppState._focusInProgress) { AppState._focusInProgress = false; }
    AppState._focusInProgress = true;
    AppState._focusResolved = false;
    if (AppState.mapObj) { destroyMap(); }

    AppState._pendingFocusTreeId = treeId;
    setTimeout(function() { renderMap(); }, DELAY_RENDER_MAP);
    _focusTreeOnMapNow(treeId, 0);
}

/**
 * 輪詢直到地圖渲染完成後聚焦（內部遞迴）
 * @param {string} treeId
 * @param {number} retryCount
 */
function _focusTreeOnMapNow(treeId, retryCount) {
    retryCount = retryCount || 0;
    if (AppState._focusResolved) {
        AppState._focusInProgress = false;
        if (!AppState.markerLookup[treeId]) {
            const tree = AppState._cachedTreeData.find(function(t) { return t.id === treeId; });
            if (!tree) { toast('⚠️ 地圖上搵唔到呢棵樹', 'warning'); }
            else { toast('⚠️ 呢棵樹冇座標，地圖上搵唔到', 'warning'); }
        } else {
            applyMapFilters();
        }
        return;
    }
    if (!AppState.mapObj) {
        if (retryCount < MAP_RETRY_MAX) {
            setTimeout(function() { _focusTreeOnMapNow(treeId, retryCount + 1); }, MAP_RETRY_INTERVAL_MS);
        } else {
            AppState._focusResolved = true;
            AppState._focusInProgress = false;
            toast('⚠️ 地圖初始化逾時', 'warning');
        }
        return;
    }
    const marker = AppState.markerLookup[treeId];
    if (!marker) {
        if (retryCount < MAP_FOCUS_RETRY_MAX) {
            setTimeout(function() { _focusTreeOnMapNow(treeId, retryCount + 1); }, MAP_RETRY_INTERVAL_MS);
        } else {
            AppState._focusResolved = true;
            AppState._focusInProgress = false;
            const tree = AppState._cachedTreeData.find(function(t) { return t.id === treeId; });
            if (!tree) { toast('⚠️ 地圖上搵唔到呢棵樹', 'warning'); }
            else { toast('⚠️ 呢棵樹冇座標，地圖上搵唔到', 'warning'); }
        }
        return;
    }
    AppState._focusResolved = true;
    AppState._focusInProgress = false;
    AppState._pendingFocusTreeId = null;
    applyMapFilters();
}

// ============================================================
// 地圖搜尋與健康濾鏡
// ============================================================

/**
 * 搜尋：觸發濾鏡更新
 */
function searchMapTrees() {
    applyMapFilters();
}

/**
 * 根據搜尋框 + 健康狀態濾鏡更新地圖標記顯示
 */
function applyMapFilters() {
    if (!AppState.mapObj) return;
    const query = (document.getElementById('mapSearchInput')?.value || '').trim().toLowerCase();
    let visibleCount = 0;
    AppState.mapMarkers.forEach(function(m) {
        const tid = (m._treeId || '').toLowerCase();
        const bname = (m._botanicalName || '').toLowerCase();
        const cname = (m._chineseName || '').toLowerCase();
        const health = m._health || '';
        const hiddenByHealth = AppState._hiddenHealth[health] || false;
        const matchesSearch = !query || tid.indexOf(query) >= 0 || bname.indexOf(query) >= 0 || cname.indexOf(query) >= 0;
        const visible = !hiddenByHealth && matchesSearch;
        if (visible) { m.addTo(AppState.mapObj); visibleCount++; }
        else { AppState.mapObj.removeLayer(m); }
    });
    document.getElementById('mapStatus').textContent = '顯示 ' + visibleCount + ' / ' + AppState.mapMarkers.length + ' 棵';
}

/**
 * 切換健康狀態濾鏡
 * @param {string} health - 健康狀態 ('Good'|'Fair'|'Poor'|'Dead')
 * @param {HTMLElement|null} btnEl - 觸發的按鈕元素
 */
function toggleHealthFilter(health, btnEl) {
    if (AppState._hiddenHealth[health]) {
        delete AppState._hiddenHealth[health];
        if (btnEl) { btnEl.classList.add('on'); btnEl.classList.remove('off'); }
    } else {
        AppState._hiddenHealth[health] = true;
        if (btnEl) { btnEl.classList.add('off'); btnEl.classList.remove('on'); }
    }
    applyMapFilters();
}

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.map = {
    destroyMap: destroyMap,
    getMarkerColor: getMarkerColor,
    renderMap: renderMap,
    focusTreeOnMap: focusTreeOnMap,
    searchMapTrees: searchMapTrees,
    applyMapFilters: applyMapFilters,
    toggleHealthFilter: toggleHealthFilter
};