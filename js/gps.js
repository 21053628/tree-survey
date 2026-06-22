/**
 * 🌳 樹木調查系統 — GPS 定位與地圖揀位模組
 * @module gps
 * 
 * GPS 三階降級鏈（高精度 → 低精度 → IP 定位）
 * 地圖揀位器（Map Picker — 手動點擊地圖放標記）
 * 地圖圖層切換（Dark/衛星/地形/街道）
 * 「定位自己」功能
 */

// ============================================================
// GPS 前置對話框
// ============================================================

/**
 * 顯示 GPS 對話框（自動判斷：協議警告 / 權限拒絕 / 正常）
 */
function showGPSDialog() {
    if (!canUseGPS()) {
        document.getElementById('gpsProtocolContent').innerHTML = getProtocolWarningHTML();
        showModal('gpsProtocolModal');
        return;
    }
    if (!navigator.geolocation) {
        toast('⚠️ 此裝置唔支援 GPS，請用地圖揀位或手動輸入', 'warning');
        return;
    }
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
            if (result.state === 'denied') {
                document.getElementById('gpsDenyContent').innerHTML = getGPSDenyGuideHTML();
                showModal('gpsDenyModal');
            } else {
                showModal('gpsPreModal');
            }
        }).catch(function() {
            showModal('gpsPreModal');
        });
    } else {
        showModal('gpsPreModal');
    }
}

// ============================================================
// GPS 三階降級鏈
// ============================================================

/**
 * 執行 GPS 定位（三階降級：高精度 → 低精度 → IP 地理定位）
 * @param {number} stage - 當前階段 (0=高精度, 1=低精度, 2=IP)
 */
function doCaptureGPS(stage) {
    if (!navigator.geolocation) return;
    AppState._gpsFallbackStage = stage;
    var accEl = document.getElementById('gpsAccuracy');
    accEl.classList.add('hidden');
    accEl.textContent = '';

    var options;
    if (stage === 0) {
        toast('🛰️ 高精度定位中...', 'warning');
        options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };
    } else if (stage === 1) {
        toast('🛰️ 低精度定位中（後備）...', 'warning');
        options = { enableHighAccuracy: false, timeout: 30000, maximumAge: 120000 };
    } else {
        doIPGeolocation();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var lat = parseFloat(pos.coords.latitude.toFixed(7));
            var lng = parseFloat(pos.coords.longitude.toFixed(7));
            var acc = Math.round(pos.coords.accuracy);
            document.getElementById('tree_latitude').value = lat;
            document.getElementById('tree_longitude').value = lng;
            _showAccuracy(acc, stage);
            toast('📍 GPS 成功 (±' + acc + 'm)', 'success');
        },
        function(err) {
            console.warn('GPS stage ' + stage + ' failed:', err.message);
            if (err.code === 1) {
                // 使用者拒絕
                document.getElementById('gpsDenyContent').innerHTML = getGPSDenyGuideHTML();
                showModal('gpsDenyModal');
            } else if (stage === 0) {
                doCaptureGPS(1);
            } else if (stage === 1) {
                doIPGeolocation();
            }
        },
        options
    );
}

/**
 * 顯示 GPS 精度資訊
 * @param {number} acc - 精度（公尺）
 * @param {number} stage - GPS 階段
 */
function _showAccuracy(acc, stage) {
    var accEl = document.getElementById('gpsAccuracy');
    var accCls, accIcon, accLabel;
    if (stage === 2) {
        accCls = 'approx'; accIcon = '🌐'; accLabel = 'IP 定位 (city-level, ±2-5km)';
    } else if (acc <= 10) {
        accCls = 'good'; accIcon = '✅'; accLabel = 'Accuracy: ±' + acc + 'm';
    } else if (acc <= 25) {
        accCls = 'ok'; accIcon = '⚠️'; accLabel = 'Accuracy: ±' + acc + 'm';
    } else {
        accCls = 'bad'; accIcon = '❌'; accLabel = 'Accuracy: ±' + acc + 'm (好低)';
    }
    accEl.textContent = accIcon + ' ' + accLabel;
    accEl.className = 'gps-accuracy ' + accCls;
    accEl.classList.remove('hidden');
}

/**
 * IP 地理定位（最終降級方案）
 */
function doIPGeolocation() {
    toast('🌐 嘗試 IP 定位...', 'warning');
    fetch('https://ipapi.co/json/')
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.latitude && d.longitude) {
                var lat = parseFloat(parseFloat(d.latitude).toFixed(4));
                var lng = parseFloat(parseFloat(d.longitude).toFixed(4));
                document.getElementById('tree_latitude').value = lat;
                document.getElementById('tree_longitude').value = lng;
                _showAccuracy(5000, 2);
                toast('🌐 IP 定位成功 (~' + (d.city||'') + ', ' + (d.region||'') + ')', 'success');
            } else {
                toast('❌ IP 定位都失敗，請用地圖揀位', 'error');
            }
        }).catch(function() {
            toast('❌ IP 定位失敗，請用地圖揀位', 'error');
        });
}

// ============================================================
// 地圖揀位器 (Map Picker)
// ============================================================

/**
 * 開啟地圖揀位器 Modal
 */
function openMapPicker() {
    if (!leafletReady()) { toast('⚠️ 地圖 library 未載入', 'warning'); return; }
    showModal('mapPickerModal');
    document.getElementById('mapPickerConfirmBtn').disabled = true;
    document.getElementById('mapPickerCoords').textContent = 'Click 地圖揀位置...';
    AppState._pickerLat = null;
    AppState._pickerLng = null;
    setTimeout(function() { _initMapPicker(); }, 200);
}

/**
 * 初始化地圖揀位器
 */
function _initMapPicker() {
    var container = document.getElementById('mapPickerContainer');
    if (!container) return;
    if (AppState._pickerMap) { AppState._pickerMap.remove(); AppState._pickerMap = null; }
    AppState._pickerMarker = null;
    AppState._pickerMap = L.map('mapPickerContainer', { zoomControl: true, attributionControl: false }).setView(HK_CENTER, 15);
    var pLayerCfg = LAYER_CONFIG[AppState._pickerCurrentLayer] || LAYER_CONFIG['dark'];
    AppState._pickerMap._currentTileLayer = L.tileLayer(pLayerCfg.url, pLayerCfg.options).addTo(AppState._pickerMap);
    document.querySelectorAll('#mapPickerModal .layer-toggle').forEach(function(b) {
        b.classList.toggle('active', b.dataset.layer === AppState._pickerCurrentLayer);
    });
    var existingLat = parseFloat(document.getElementById('tree_latitude').value);
    var existingLng = parseFloat(document.getElementById('tree_longitude').value);
    if (!isNaN(existingLat) && !isNaN(existingLng)) {
        AppState._pickerMap.setView([existingLat, existingLng], 18);
        _placePickerMarker(existingLat, existingLng);
    }
    AppState._pickerMap.on('click', function(e) {
        _placePickerMarker(e.latlng.lat, e.latlng.lng);
    });
    setTimeout(function() { if (AppState._pickerMap) AppState._pickerMap.invalidateSize(); }, 100);
}

/**
 * 在地圖揀位器上放置標記
 * @param {number} lat
 * @param {number} lng
 */
function _placePickerMarker(lat, lng) {
    if (AppState._pickerMarker) { AppState._pickerMap.removeLayer(AppState._pickerMarker); }
    var icon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="width:24px;height:24px;border-radius:50%;background:#a855f7;border:3px solid #fff;box-shadow:0 0 16px rgba(168,85,247,.8),0 3px 8px rgba(0,0,0,.5);font-size:14px;line-height:24px;text-align:center;color:#fff">📍</div>',
        iconSize: [24, 24], iconAnchor: [12, 24]
    });
    AppState._pickerMarker = L.marker([lat, lng], { icon: icon }).addTo(AppState._pickerMap);
    AppState._pickerLat = parseFloat(lat.toFixed(7));
    AppState._pickerLng = parseFloat(lng.toFixed(7));
    document.getElementById('mapPickerCoords').textContent = '📍 Lat: ' + AppState._pickerLat.toFixed(6) + '  Lng: ' + AppState._pickerLng.toFixed(6);
    document.getElementById('mapPickerConfirmBtn').disabled = false;
}

/**
 * 確認地圖揀位，寫入座標欄位
 */
function confirmMapPicker() {
    if (AppState._pickerLat == null || AppState._pickerLng == null) return;
    document.getElementById('tree_latitude').value = AppState._pickerLat;
    document.getElementById('tree_longitude').value = AppState._pickerLng;
    var accEl = document.getElementById('gpsAccuracy');
    accEl.textContent = '🗺️ 地圖揀位 (手動)';
    accEl.className = 'gps-accuracy map-pick';
    accEl.classList.remove('hidden');
    closeMapPicker();
    toast('✅ 已用地圖揀位', 'success');
}

/**
 * 關閉地圖揀位器
 */
function closeMapPicker() {
    if (AppState._pickerMap) { AppState._pickerMap.remove(); AppState._pickerMap = null; }
    AppState._pickerMarker = null;
    closeModal('mapPickerModal');
}

// ============================================================
// 地圖圖層切換
// ============================================================

/**
 * 切換主地圖圖層
 * @param {string} key - 圖層 key ('dark'|'imagery'|'topo'|'street')
 */
function switchMainLayer(key) {
    if (!AppState.mapObj || !LAYER_CONFIG[key]) return;
    AppState._currentLayer = key;
    var cfg = LAYER_CONFIG[key];
    if (AppState.mapObj._currentTileLayer) AppState.mapObj.removeLayer(AppState.mapObj._currentTileLayer);
    AppState.mapObj._currentTileLayer = L.tileLayer(cfg.url, cfg.options).addTo(AppState.mapObj);
    document.querySelectorAll('#view-project-map .layer-toggle').forEach(function(b) {
        b.classList.toggle('active', b.dataset.layer === key);
    });
}

/**
 * 切換揀位器圖層
 * @param {string} key - 圖層 key
 */
function switchPickerLayer(key) {
    if (!AppState._pickerMap || !LAYER_CONFIG[key]) return;
    AppState._pickerCurrentLayer = key;
    var cfg = LAYER_CONFIG[key];
    if (AppState._pickerMap._currentTileLayer) AppState._pickerMap.removeLayer(AppState._pickerMap._currentTileLayer);
    AppState._pickerMap._currentTileLayer = L.tileLayer(cfg.url, cfg.options).addTo(AppState._pickerMap);
    document.querySelectorAll('#mapPickerModal .layer-toggle').forEach(function(b) {
        b.classList.toggle('active', b.dataset.layer === key);
    });
}

// ============================================================
// 「定位自己」
// ============================================================

/**
 * 在地圖上定位目前裝置位置
 */
function locateMe() {
    if (!AppState.mapObj || !leafletReady()) { toast('⚠️ 地圖未初始化', 'warning'); return; }
    if (!navigator.geolocation) { toast('⚠️ 此裝置唔支援 GPS', 'warning'); return; }
    if (!canUseGPS()) { toast('⚠️ 當前環境不支援 GPS，請用 HTTPS 開啟', 'warning'); return; }
    toast('📍 正在定位...', 'warning');
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var lat = pos.coords.latitude, lng = pos.coords.longitude, acc = Math.round(pos.coords.accuracy);
            if (AppState._locateMarker) { AppState.mapObj.removeLayer(AppState._locateMarker); }
            var userIcon = L.divIcon({
                className: 'custom-marker',
                html: '<div style="width:18px;height:18px;border-radius:50%;background:#6366f1;border:3px solid #fff;box-shadow:0 0 12px rgba(99,102,241,.8),0 2px 6px rgba(0,0,0,.5)"></div>',
                iconSize: [18, 18], iconAnchor: [9, 9]
            });
            AppState._locateMarker = L.marker([lat, lng], { icon: userIcon }).addTo(AppState.mapObj)
                .bindTooltip('📍 你喺度 (±' + acc + 'm)', { permanent: true, direction: 'right', className: 'tree-label' });
            AppState.mapObj.setView([lat, lng], Math.max(AppState.mapObj.getZoom(), 16));
            setTimeout(function(){ if (AppState.mapObj) AppState.mapObj.invalidateSize(); }, 200);
            toast('✅ 已定位 (±' + acc + 'm)', 'success');
        },
        function() { toast('⚠️ 無法定位', 'warning'); },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
}

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.gps = {
    showGPSDialog: showGPSDialog,
    doCaptureGPS: doCaptureGPS,
    doIPGeolocation: doIPGeolocation,
    openMapPicker: openMapPicker,
    confirmMapPicker: confirmMapPicker,
    closeMapPicker: closeMapPicker,
    switchMainLayer: switchMainLayer,
    switchPickerLayer: switchPickerLayer,
    locateMe: locateMe
};
