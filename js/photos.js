/**
 * 🌳 樹木調查系統 — 照片管理模組
 * @module photos
 * 
 * 照片上傳（含 HEIC 轉換 + 雙軌壓縮 1920px/300px，並行上傳 + 進度追蹤）、
 * 照片檢視器（前後瀏覽、下載、說明編輯）、
 * 照片刪除（含 Storage 清理）、
 * 地圖 Popup 照片 strip 載入、
 * 照片標註畫圈/畫線（Canvas-based Annotation）。
 */

// ============================================================
// 從 DB 載入照片清單
// ============================================================

/**
 * 載入指定樹木的所有照片
 * @param {string} treeId - 樹 UUID
 */
async function loadTreePhotos(treeId) {
    AppState._photoCurrentTreeId = treeId;
    if (!treeId || !AppState.supabase) { AppState._photoData = []; renderPhotoGrid(); return; }
    try {
        const r = await AppState.supabase.from('tree_photos')
            .select('*')
            .eq('tree_id', treeId)
            .order('created_at', { ascending: false });
        if (r.error) { console.warn('Photo load err:', r.error.message); AppState._photoData = []; }
        else { AppState._photoData = r.data || []; }
    } catch(e) { AppState._photoData = []; }
    renderPhotoGrid();
}

// ============================================================
// 照片縮圖網格渲染
// ============================================================

/**
 * 渲染照片縮圖網格到 treeModal 中
 */
function renderPhotoGrid() {
    const grid = document.getElementById('photoGrid');
    const countLabel = document.getElementById('photoCountLabel');
    if (!grid) return;
    if (countLabel) countLabel.textContent = AppState._photoData.length + ' 張';
    grid.innerHTML = '';
    AppState._photoData.forEach(function(p, idx) {
        const div = document.createElement('div');
        div.className = 'photo-thumb';
        // 若標記為 spoofed，添加紅色警告邊框
        if (p.is_spoofed) {
            div.classList.add('photo-spoofed');
            div.title = '🚨 拍攝位置與地盤標記不符，疑似非現場照片！\n差距 ' + (p.gps_diff_m != null ? Math.round(p.gps_diff_m) + ' 米' : '未知');
        }
        let url = p.thumb_path || p.storage_path;
        // 如果是 storage path，轉換為 public URL
        if (url && !url.startsWith('http')) {
            try { url = AppState.supabase.storage.from('tree-photos').getPublicUrl(url).data.publicUrl; } catch(e) {}
        }
        // 安全建立 img element
        const img = document.createElement('img');
        img.src = url || '';
        img.alt = 'Photo';
        img.onerror = function() { this.style.display = 'none'; };
        img.addEventListener('click', function(e) {
            e.stopPropagation();
            openPhotoViewer(idx);
        });
        div.appendChild(img);

        // 若有 annotation 標記，在縮圖上顯示小圖示
        var anns = p.annotations;
        if (anns && Array.isArray(anns) && anns.length > 0) {
            var annBadge = document.createElement('div');
            annBadge.className = 'photo-exif-badge';
            annBadge.style.cssText = 'top:auto;bottom:4px;left:auto;right:4px;color:#f87171;background:rgba(127,29,29,.9);z-index:2';
            annBadge.textContent = '🔴' + anns.length + ' 標記';
            div.appendChild(annBadge);
        }

        // EXIF GPS 資訊標籤（若有）
        if (p.exif_latitude != null && p.exif_longitude != null) {
            const exifBadge = document.createElement('div');
            exifBadge.className = 'photo-exif-badge';
            exifBadge.textContent = '📍' + Number(p.exif_latitude).toFixed(4) + ',' + Number(p.exif_longitude).toFixed(4);
            if (p.is_spoofed) exifBadge.classList.add('spoof');
            div.appendChild(exifBadge);
        }

        if (p.caption) {
            const cap = document.createElement('div');
            cap.className = 'photo-caption-badge';
            cap.textContent = p.caption;
            div.appendChild(cap);
        }

        // spoofed 紅色警告標籤
        if (p.is_spoofed) {
            const spoofLabel = document.createElement('div');
            spoofLabel.className = 'photo-spoof-label';
            spoofLabel.textContent = '🚨 位置不符';
            div.appendChild(spoofLabel);
        }

        const delBtn = document.createElement('button');
        delBtn.className = 'photo-delete';
        delBtn.title = '刪除照片';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deletePhoto(p.id, idx);
        });
        div.appendChild(delBtn);

        grid.appendChild(div);
    });
}

// ============================================================
// 照片選取 → 並行上傳（含進度追蹤）
// ============================================================

/**
 * 處理檔案選擇，並行上傳（限制同時上限數為 4）
 * @param {HTMLInputElement} input
 */
async function handlePhotoFilesSelected(input) {
    if (!input.files || input.files.length === 0) return;
    if (!AppState._photoCurrentTreeId || !AppState.currentProjectId) {
        toast('⚠️ 請先儲存樹木再上傳照片', 'warning');
        input.value = '';
        return;
    }
    const files = Array.from(input.files);
    input.value = '';
    const total = files.length;
    let completed = 0;
    let failed = 0;

    toast('📷 正在處理 ' + total + ' 張照片...', 'warning');
    _updatePhotoProgress(0, total);

    // 並行處理，限制同時上限 4
    const CONCURRENCY = 4;
    let idx = 0;

    async function worker() {
        while (idx < files.length) {
            const i = idx++;
            try {
                await processAndUploadPhoto(files[i]);
                completed++;
            } catch(e) {
                failed++;
                console.warn('Photo upload failed:', files[i].name, e.message);
            }
            _updatePhotoProgress(completed + failed, total);
        }
    }

    // 啟動 worker pool
    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENCY, total); w++) {
        workers.push(worker());
    }
    await Promise.all(workers);

    // 重新載入照片清單
    await loadTreePhotos(AppState._photoCurrentTreeId);
    if (failed > 0) {
        toast('⚠️ 上傳完成：' + completed + ' 張成功，' + failed + ' 張失敗', 'warning');
    } else {
        toast('✅ 上傳完成 (' + completed + ' 張)', 'success');
    }
    _updatePhotoProgress(total, total);
}

/**
 * 更新照片上傳進度條 UI
 * @param {number} done - 已完成數
 * @param {number} total - 總數
 */
function _updatePhotoProgress(done, total) {
    const label = document.getElementById('photoUploadLabel');
    if (label) {
        if (done < total) {
            label.textContent = '上傳中 ' + done + '/' + total;
        } else {
            label.textContent = '拍照/上傳';
        }
    }
}

/**
 * 處理單張照片：HEIC 轉換 → EXIF GPS提取 → 防偽比對 → 壓縮 → 上傳 → 寫入 DB
 * @param {File} file
 */
async function processAndUploadPhoto(file) {
    // 處理 HEIC
    let blob = file;
    if (file.type === 'image/heic' || file.type === 'image/heif' ||
        file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        if (window.heic2any) {
            try {
                const heicBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: PHOTO_QUALITY });
                blob = Array.isArray(heicBlob) ? heicBlob[0] : heicBlob;
            } catch(e) { console.warn('HEIC conversion failed, trying raw upload:', e.message); }
        }
    }

    // ═══ EXIF GPS 座標提取 + 防偽比對 ═══
    let exifLat = null, exifLng = null, exifTakenAt = null;
    const spoofResult = await _extractAndCrossCheckExif(file);

    if (spoofResult) {
        exifLat = spoofResult.exif_latitude;
        exifLng = spoofResult.exif_longitude;
        exifTakenAt = spoofResult.exif_taken_at;
    }

    // 壓縮產生大圖 + 縮圖
    const compressed = await compressImage(blob, PHOTO_MAX_DIM, PHOTO_QUALITY);
    const thumb = await compressImage(blob, THUMB_MAX_DIM, THUMB_QUALITY);

    // 產生檔名
    let ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'heic' || ext === 'heif') ext = 'jpg';
    const fileName = uuid() + '.' + ext;
    const storagePath = AppState.currentProjectId + '/' + AppState._photoCurrentTreeId + '/' + fileName;
    const thumbPath = AppState.currentProjectId + '/' + AppState._photoCurrentTreeId + '/thumb_' + fileName;

    // ═══ 先寫 DB 記錄（防止孤兒 Storage 檔案）═══
    // NOTE: annotations 欄位需先在 Supabase 中執行 ALTER TABLE 加入
    // ALTER TABLE tree_photos ADD COLUMN IF NOT EXISTS annotations JSONB DEFAULT '[]'::jsonb;
    const photoId = uuid();
    const photoRecord = {
        id: photoId,
        tree_id: AppState._photoCurrentTreeId,
        project_id: AppState.currentProjectId,
        user_id: AppState.currentUser?.id,
        file_name: file.name,
        storage_path: storagePath,
        caption: '',
        taken_at: new Date().toISOString(),
        file_size: file.size,
        thumb_path: thumbPath,
        exif_latitude: exifLat,
        exif_longitude: exifLng,
        gps_diff_m: spoofResult ? spoofResult.gps_diff_m : null,
        is_spoofed: spoofResult ? spoofResult.is_spoofed : false,
        exif_taken_at: exifTakenAt,
        created_at: new Date().toISOString()
    };

    const insResult = await AppState.supabase.from('tree_photos').insert(photoRecord);
    if (insResult.error) {
        console.warn('Photo record insert err:', insResult.error.message);
        console.warn('👉 若缺少 exif_latitude 等欄位，請到 Supabase SQL Editor 執行:');
        console.warn('   ALTER TABLE tree_photos ADD COLUMN IF NOT EXISTS exif_latitude DOUBLE PRECISION;');
        console.warn('   ALTER TABLE tree_photos ADD COLUMN IF NOT EXISTS exif_longitude DOUBLE PRECISION;');
        console.warn('   ALTER TABLE tree_photos ADD COLUMN IF NOT EXISTS gps_diff_m DOUBLE PRECISION;');
        console.warn('   ALTER TABLE tree_photos ADD COLUMN IF NOT EXISTS is_spoofed BOOLEAN DEFAULT FALSE;');
        console.warn('   ALTER TABLE tree_photos ADD COLUMN IF NOT EXISTS exif_taken_at TIMESTAMPTZ;');
        console.warn('   ALTER TABLE tree_photos ADD COLUMN IF NOT EXISTS annotations JSONB DEFAULT \'[]\'::jsonb;');
        toast('⚠️ 資料表缺少欄位(exif_latitude等)，請執行 SQL 遷移（見主控台）', 'warning');
        throw new Error('DB insert failed: ' + insResult.error.message);
    }

    // ═══ 再上傳 Storage，失敗則 rollback DB ═══
    let uploadSuccess = true;
    try {
        const upResult = await AppState.supabase.storage.from('tree-photos').upload(storagePath, compressed, {
            contentType: 'image/jpeg',
            upsert: false
        });
        if (upResult.error) {
            uploadSuccess = false;
            toast('⚠️ 請先建立 Supabase Storage bucket: tree-photos', 'warning');
            throw new Error('Storage upload failed: ' + upResult.error.message);
        }
    } catch(e) {
        uploadSuccess = false;
        throw e;
    }

    // 縮圖上傳（best-effort，不影響主流程）
    try {
        await AppState.supabase.storage.from('tree-photos').upload(thumbPath, thumb, {
            contentType: 'image/jpeg',
            upsert: false
        });
    } catch(e) {
        console.warn('Thumb upload err (non-fatal):', e.message);
    }

    // ═══ Rollback：Storage上傳失敗 → 刪除DB記錄 ═══
    if (!uploadSuccess) {
        try { await AppState.supabase.from('tree_photos').delete().eq('id', photoId); } catch(e) {}
        throw new Error('Photo sync failed and rolled back');
    }
}

/**
 * 前端圖片壓縮
 * @param {Blob} blob - 原始圖片
 * @param {number} maxSize - 最大邊長 (px)
 * @param {number} quality - JPEG 品質 (0-1)
 * @returns {Promise<Blob>}
 */
function compressImage(blob, maxSize, quality) {
    return new Promise(function(resolve, reject) {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = function() {
            URL.revokeObjectURL(url);
            const w = img.width, h = img.height;
            if (w <= maxSize && h <= maxSize) { resolve(blob); return; }
            const ratio = Math.min(maxSize / w, maxSize / h);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w * ratio);
            canvas.height = Math.round(h * ratio);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(function(compressedBlob) {
                resolve(compressedBlob || blob);
            }, 'image/jpeg', quality);
        };
        img.onerror = function() { URL.revokeObjectURL(url); resolve(blob); };
        img.src = url;
    });
}

// ============================================================
// EXIF GPS 提取 + Haversine 防偽比對雷達
// ============================================================

/**
 * 從照片 File/Blob 中提取 EXIF GPS 座標，並與樹木 DB 記錄中的座標進行比對
 * 若兩者距離超過 SPOOF_DISTANCE_THRESHOLD（預設 50 米），標記為疑似偽造
 * 
 * @param {File|Blob} file - 照片原始檔案
 * @returns {Promise<object|null>} 
 *   - null: 無法提取 EXIF GPS 或樹木無座標（不觸發警告）
 *   - { exif_latitude, exif_longitude, exif_taken_at, gps_diff_m, is_spoofed }
 */
async function _extractAndCrossCheckExif(file) {
    // ── 檢查 exifr 庫是否可用 ──
    if (typeof exifr === 'undefined' || !exifr.parse) return null;

    // ── 提取 EXIF GPS 數據 ──
    let exifData;
    try {
        exifData = await exifr.parse(file, ['latitude', 'longitude', 'DateTimeOriginal', 'GPSDateStamp', 'GPSTimeStamp']);
    } catch(e) {
        console.warn('EXIF parse failed:', e.message);
        return null;
    }

    if (!exifData) return null;

    const exifLat = (exifData.latitude != null) ? parseFloat(Number(exifData.latitude).toFixed(7)) : null;
    const exifLng = (exifData.longitude != null) ? parseFloat(Number(exifData.longitude).toFixed(7)) : null;

    // ── 若無有效 EXIF GPS 座標，無法比對 ──
    if (exifLat == null || exifLng == null || isNaN(exifLat) || isNaN(exifLng)) return null;

    // ── 提取 EXIF 拍攝時間 ──
    let exifTakenAt = null;
    try {
        if (exifData.DateTimeOriginal) {
            const d = exifData.DateTimeOriginal;
            if (d instanceof Date && !isNaN(d.getTime())) {
                exifTakenAt = d.toISOString();
            } else if (typeof d === 'string') {
                const parsed = new Date(d);
                if (!isNaN(parsed.getTime())) exifTakenAt = parsed.toISOString();
            }
        }
    } catch(e) { /* ignore */ }

    // ── 獲取樹木 DB 座標 ──
    const treeLatEl = document.getElementById('tree_latitude');
    const treeLngEl = document.getElementById('tree_longitude');
    let treeLat, treeLng;
    if (treeLatEl && treeLngEl) {
        treeLat = parseFloat(treeLatEl.value.trim());
        treeLng = parseFloat(treeLngEl.value.trim());
    }
    // 若表單中沒有（例如已儲存後再上傳），嘗試從 DB 獲取
    if (isNaN(treeLat) || isNaN(treeLng)) {
        try {
            const treeR = await AppState.supabase.from('trees')
                .select('latitude, longitude')
                .eq('id', AppState._photoCurrentTreeId)
                .single();
            if (treeR.data) {
                treeLat = (treeR.data.latitude != null) ? parseFloat(treeR.data.latitude) : NaN;
                treeLng = (treeR.data.longitude != null) ? parseFloat(treeR.data.longitude) : NaN;
            }
        } catch(e) { /* ignore */ }
    }

    // ── 若樹木無 DB 座標記錄，無法比對 ──
    if (isNaN(treeLat) || isNaN(treeLng)) {
        // 返回 EXIF 數據但不標記 spoof（因為無法比對）
        return { exif_latitude: exifLat, exif_longitude: exifLng, exif_taken_at: exifTakenAt, gps_diff_m: null, is_spoofed: false };
    }

    // ── Haversine 距離計算 ──
    const dist = _haversineDistance(exifLat, exifLng, treeLat, treeLng);
    const isSpoofed = dist > SPOOF_DISTANCE_THRESHOLD;

    // ── 若 spoofed，觸發即時 UI 警告 ──
    if (isSpoofed) {
        toast('🚨 警告：拍攝位置與地盤標記不符，疑似非現場照片！（差距 ' + Math.round(dist) + ' 米）', 'error');
    }

    return {
        exif_latitude: exifLat,
        exif_longitude: exifLng,
        exif_taken_at: exifTakenAt,
        gps_diff_m: Math.round(dist * 10) / 10,  // 保留小數一位
        is_spoofed: isSpoofed
    };
}

/**
 * Haversine 公式：計算兩個經緯度座標之間的距離（公尺）
 * @param {number} lat1 - 點1 緯度
 * @param {number} lng1 - 點1 經度
 * @param {number} lat2 - 點2 緯度
 * @param {number} lng2 - 點2 經度
 * @returns {number} 距離（公尺）
 */
function _haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球半徑（公尺）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ============================================================
// 照片檢視器
// ============================================================

/**
 * 開啟照片檢視器
 * @param {number} idx - 起始照片索引
 */
function openPhotoViewer(idx) {
    if (AppState._photoData.length === 0) return;
    AppState._photoViewerIndex = Math.max(0, Math.min(idx, AppState._photoData.length - 1));
    document.getElementById('photoViewerTitle').textContent = '📸 照片';
    updatePhotoViewer();
    showModal('photoViewerModal');
}

/**
 * 更新照片檢視器顯示
 */
function updatePhotoViewer() {
    const p = AppState._photoData[AppState._photoViewerIndex];
    if (!p) return;
    let url = p.storage_path;
    if (url && !url.startsWith('http')) {
        try { url = AppState.supabase.storage.from('tree-photos').getPublicUrl(url).data.publicUrl; } catch(e) {}
    }

    var imgEl = document.getElementById('photoViewerImg');
    imgEl.src = url || '';
    document.getElementById('photoViewerCaption').textContent = p.caption || '';
    document.getElementById('photoViewerCounter').textContent = (AppState._photoViewerIndex + 1) + ' / ' + AppState._photoData.length;
    document.getElementById('photoViewerPrev').disabled = (AppState._photoViewerIndex <= 0);
    document.getElementById('photoViewerNext').disabled = (AppState._photoViewerIndex >= AppState._photoData.length - 1);

    // ═══ SPOOF WARNING — 檢視器內紅燈警告 ═══
    let spoofBanner = document.getElementById('photoViewerSpoofBanner');
    if (p.is_spoofed) {
        if (!spoofBanner) {
            spoofBanner = document.createElement('div');
            spoofBanner.id = 'photoViewerSpoofBanner';
            spoofBanner.className = 'photo-viewer-spoof-banner';
            var viewerImg = document.getElementById('photoViewerImg');
            if (viewerImg && viewerImg.parentNode) {
                viewerImg.parentNode.insertBefore(spoofBanner, viewerImg);
            }
        }
        spoofBanner.style.display = 'block';
        spoofBanner.textContent = '🚨 警告：拍攝位置與地盤標記不符，疑似非現場照片！' + (p.gps_diff_m != null ? '（差距 ' + Math.round(p.gps_diff_m) + ' 米）' : '');
    } else {
        if (spoofBanner) spoofBanner.style.display = 'none';
    }

    // ═══ ANNOTATION: 初始化 canvas 並載入標記 ═══
    _resetAnnotationState();
    imgEl.onload = function() {
        initAnnotationCanvas(p);
    };
    // 若圖片已經載入（從快取），直接觸發
    if (imgEl.complete && imgEl.naturalWidth > 0) {
        initAnnotationCanvas(p);
    }
}

/**
 * 照片檢視器前後瀏覽
 * @param {number} direction - -1 或 +1
 */
function photoViewerNav(direction) {
    _resetAnnotationState();
    AppState._photoViewerIndex = Math.max(0, Math.min(AppState._photoViewerIndex + direction, AppState._photoData.length - 1));
    updatePhotoViewer();
}

/**
 * 下載當前檢視的照片
 */
function downloadCurrentPhoto() {
    const p = AppState._photoData[AppState._photoViewerIndex];
    if (!p) return;
    let url = p.storage_path;
    if (url && !url.startsWith('http')) {
        try { url = AppState.supabase.storage.from('tree-photos').getPublicUrl(url).data.publicUrl; } catch(e) {}
    }
    if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = p.file_name || 'photo.jpg';
        a.click();
    }
}

// ============================================================
// 照片說明編輯
// ============================================================

/**
 * 編輯當前照片說明
 */
function editPhotoCaption() {
    const p = AppState._photoData[AppState._photoViewerIndex];
    if (!p) return;
    document.getElementById('photoCaptionInput').value = p.caption || '';
    document.getElementById('photoCaptionDate').value = p.taken_at ? p.taken_at.split('T')[0] : '';
    showModal('photoCaptionModal');
}

/**
 * 儲存照片說明
 */
async function savePhotoCaption() {
    const p = AppState._photoData[AppState._photoViewerIndex];
    if (!p || !AppState.supabase) return;
    const caption = document.getElementById('photoCaptionInput').value.trim();
    const takenAt = document.getElementById('photoCaptionDate').value;
    const updateData = { caption: caption, updated_at: new Date().toISOString() };
    if (takenAt) updateData.taken_at = new Date(takenAt + 'T00:00:00').toISOString();

    const r = await AppState.supabase.from('tree_photos').update(updateData).eq('id', p.id);
    if (r.error) { toast('❌ ' + r.error.message, 'error'); return; }
    p.caption = caption;
    if (takenAt) p.taken_at = updateData.taken_at;
    closeModal('photoCaptionModal');
    updatePhotoViewer();
    renderPhotoGrid();
    toast('✅ 已更新', 'success');
}

// ============================================================
// 照片刪除
// ============================================================

/**
 * 從檢視器刪除當前照片
 */
async function deleteCurrentPhoto() {
    const p = AppState._photoData[AppState._photoViewerIndex];
    if (!p) return;
    if (!confirm('確定刪除呢張照片？')) return;
    await _deletePhotoById(p.id);
    closeModal('photoViewerModal');
    await loadTreePhotos(AppState._photoCurrentTreeId);
}

/**
 * 從縮圖網格刪除照片
 * @param {string} photoId
 * @param {number} gridIdx
 */
async function deletePhoto(photoId, gridIdx) {
    if (!confirm('確定刪除呢張照片？')) return;
    await _deletePhotoById(photoId);
    await loadTreePhotos(AppState._photoCurrentTreeId);
}

/**
 * 內部：刪除照片（DB 記錄 + Storage 檔案）
 * @param {string} photoId
 */
async function _deletePhotoById(photoId) {
    if (!AppState.supabase) return;
    const photo = AppState._photoData.find(function(p) { return p.id === photoId; });
    if (photo) {
        const toRemove = [];
        if (photo.storage_path) toRemove.push(photo.storage_path);
        if (photo.thumb_path && photo.thumb_path !== photo.storage_path) toRemove.push(photo.thumb_path);
        if (toRemove.length > 0) {
            try { await AppState.supabase.storage.from('tree-photos').remove(toRemove); } catch(e) {}
        }
    }
    const r = await AppState.supabase.from('tree_photos').delete().eq('id', photoId);
    if (r.error) { toast('❌ ' + r.error.message, 'error'); }
    else { toast('✅ 已刪除', 'success'); }
}

// ============================================================
// 地圖 Popup 照片 strip
// ============================================================

/**
 * 載入照片到地圖 Popup strip
 * @param {string} treeId
 * @param {HTMLElement} stripEl
 */
async function loadPhotosIntoPopup(treeId, stripEl) {
    if (AppState._popupPhotoCache[treeId]) {
        renderPhotoStripContent(stripEl, AppState._popupPhotoCache[treeId], treeId);
        return;
    }
    stripEl.innerHTML = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'strip-loading';
    loadingDiv.textContent = '⏳ 載入中...';
    stripEl.appendChild(loadingDiv);
    try {
        const r = await AppState.supabase.from('tree_photos')
            .select('*')
            .eq('tree_id', treeId)
            .order('created_at', { ascending: false })
            .limit(POPUP_PHOTO_LIMIT);
        const photos = (r.data && r.data.length > 0) ? r.data : [];
        AppState._popupPhotoCache[treeId] = photos;
        renderPhotoStripContent(stripEl, photos, treeId);
    } catch(e) {
        stripEl.innerHTML = '';
        const errDiv = document.createElement('div');
        errDiv.className = 'strip-empty';
        errDiv.textContent = '❌ 載入失敗';
        stripEl.appendChild(errDiv);
    }
}

/**
 * 渲染照片 strip 內容
 * @param {HTMLElement} stripEl
 * @param {object[]} photos
 * @param {string} treeId
 */
function renderPhotoStripContent(stripEl, photos, treeId) {
    stripEl.innerHTML = '';
    if (!photos || photos.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'strip-empty';
        emptyDiv.textContent = '📭 未有照片';
        stripEl.appendChild(emptyDiv);
        return;
    }
    const displayPhotos = photos.slice(0, POPUP_STRIP_DISPLAY);
    const hasMore = photos.length > POPUP_STRIP_DISPLAY;

    const label = document.createElement('div');
    label.className = 'strip-label';
    label.textContent = '📸 ' + photos.length + ' 張照片';
    stripEl.appendChild(label);

    for (let i = 0; i < displayPhotos.length; i++) {
        const p = displayPhotos[i];
        let url = p.thumb_path || p.storage_path;
        if (url && !url.startsWith('http')) {
            try { url = AppState.supabase.storage.from('tree-photos').getPublicUrl(url).data.publicUrl; } catch(e) {}
        }
        const img = document.createElement('img');
        img.className = 'strip-thumb';
        img.src = url || '';
        img.title = p.caption || '';
        img.onerror = function() { this.style.display = 'none'; };
        (function(photoIdx) {
            img.addEventListener('click', function(e) {
                e.stopPropagation();
                openPhotoViewerForTree(treeId, photoIdx);
            });
        })(i);
        stripEl.appendChild(img);
    }

    if (hasMore) {
        const moreSpan = document.createElement('span');
        moreSpan.className = 'strip-more';
        moreSpan.textContent = '📷 查看全部 ▶';
        moreSpan.addEventListener('click', function(e) {
            e.stopPropagation();
            openPhotoViewerForTree(treeId, 0);
        });
        stripEl.appendChild(moreSpan);
    }
}

/**
 * 從地圖 Popup 開啟照片檢視器
 * @param {string} treeId
 * @param {number} startIdx
 */
async function openPhotoViewerForTree(treeId, startIdx) {
    startIdx = startIdx || 0;
    let photos = AppState._popupPhotoCache[treeId];
    if (!photos) {
        try {
            const r = await AppState.supabase.from('tree_photos')
                .select('*')
                .eq('tree_id', treeId)
                .order('created_at', { ascending: false });
            photos = (r.data && r.data.length > 0) ? r.data : [];
            AppState._popupPhotoCache[treeId] = photos;
        } catch(e) {
            toast('❌ 載入照片失敗', 'error');
            return;
        }
    }
    if (!photos || photos.length === 0) {
        toast('📭 呢棵樹未有照片', 'warning');
        return;
    }
    AppState._photoData = photos;
    AppState._photoViewerIndex = Math.max(0, Math.min(startIdx, photos.length - 1));
    AppState._photoCurrentTreeId = treeId;
    document.getElementById('photoViewerTitle').textContent = '📸 照片 — 地圖檢視';
    updatePhotoViewer();
    showModal('photoViewerModal');
}

// ============================================================
// ============================================================
// 照片標註功能 (Photo Annotation & Markup)
// ============================================================
// ============================================================

// Annotation 狀態機
var _annoState = {
    currentTool: 'view',        // 'view' | 'circle' | 'line'
    isDrawing: false,
    startX: 0,                  // canvas pixel coords
    startY: 0,
    currentAnnotations: [],     // 目前未儲存的 annotations array (歸一化 0~1)
    savedAnnotations: [],       // 已從 DB 載入的 annotations
    dirty: false                // 是否有未儲存的修改
};

var ANNO_COLOR = '#ef4444';
var ANNO_LINE_WIDTH = 3;
var ANNO_CIRCLE_RADIUS_MIN = 8; // pixels, minimum circle radius to accept

/**
 * 重置 annotation 狀態（切換照片時呼叫）
 */
function _resetAnnotationState() {
    _annoState.currentTool = 'view';
    _annoState.isDrawing = false;
    _annoState.currentAnnotations = [];
    _annoState.savedAnnotations = [];
    _annoState.dirty = false;
    _updateAnnotationToolUI();
    _updateAnnotationHint();
}

/**
 * 初始化 annotation canvas（等圖片 onload 後呼叫）
 * @param {object} photoData - 當前照片的 DB 記錄
 */
function initAnnotationCanvas(photoData) {
    var canvas = document.getElementById('annotationCanvas');
    var wrap = document.getElementById('annotationCanvasWrap');
    var img = document.getElementById('photoViewerImg');
    if (!canvas || !wrap || !img) return;

    // 取得圖片實際顯示的矩形（在 .annotation-canvas-wrap 內）
    var imgRect = _getImageDisplayRect(img, wrap);

    // 設定 canvas 尺寸 = wrap 尺寸（覆蓋整個 wrap）
    var wrapRect = wrap.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = wrapRect.width * dpr;
    canvas.height = wrapRect.height * dpr;
    canvas.style.width = wrapRect.width + 'px';
    canvas.style.height = wrapRect.height + 'px';

    // 載入既有 annotations
    var anns = photoData.annotations;
    if (anns && Array.isArray(anns) && anns.length > 0) {
        _annoState.savedAnnotations = JSON.parse(JSON.stringify(anns));
    } else {
        _annoState.savedAnnotations = [];
    }
    _annoState.currentAnnotations = JSON.parse(JSON.stringify(_annoState.savedAnnotations));
    _annoState.dirty = false;

    // 重繪 canvas
    _renderAllAnnotations();

    // 設定工具模式
    _updateAnnotationToolUI();
    _updateAnnotationHint();
    _setCanvasMode();
}

/**
 * 取得圖片在 wrap 內實際顯示的矩形（object-fit: contain 行為）
 * @param {HTMLImageElement} img
 * @param {HTMLElement} wrap
 * @returns {{left:number, top:number, width:number, height:number}}
 */
function _getImageDisplayRect(img, wrap) {
    var wrapRect = wrap.getBoundingClientRect();
    var imgNaturalW = img.naturalWidth;
    var imgNaturalH = img.naturalHeight;
    if (!imgNaturalW || !imgNaturalH) {
        return { left: 0, top: 0, width: wrapRect.width, height: wrapRect.height };
    }
    var wrapW = wrapRect.width;
    var wrapH = wrapRect.height;
    var scale = Math.min(wrapW / imgNaturalW, wrapH / imgNaturalH);
    var displayW = imgNaturalW * scale;
    var displayH = imgNaturalH * scale;
    var offsetX = (wrapW - displayW) / 2;
    var offsetY = (wrapH - displayH) / 2;
    return { left: offsetX, top: offsetY, width: displayW, height: displayH };
}

/**
 * 設定 canvas 的滑鼠/觸控事件模式
 */
function _setCanvasMode() {
    var canvas = document.getElementById('annotationCanvas');
    var wrap = document.getElementById('annotationCanvasWrap');
    if (!canvas || !wrap) return;

    // 移除舊事件
    canvas.onpointerdown = null;
    canvas.onpointermove = null;
    canvas.onpointerup = null;
    canvas.onpointerleave = null;
    canvas.onpointercancel = null;

    if (_annoState.currentTool === 'view') {
        wrap.classList.add('view-mode');
        return;
    }

    wrap.classList.remove('view-mode');

    canvas.onpointerdown = function(e) {
        e.preventDefault();
        _annoState.isDrawing = true;
        var coords = _canvasCoords(e, canvas);
        _annoState.startX = coords.x;
        _annoState.startY = coords.y;
        canvas.setPointerCapture(e.pointerId);
    };

    canvas.onpointermove = function(e) {
        if (!_annoState.isDrawing) return;
        e.preventDefault();
        var coords = _canvasCoords(e, canvas);
        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;

        // 重繪所有已儲存的標記 + 當前拖曳中的預覽
        _renderAllAnnotations(ctx);

        // 畫當前拖曳預覽
        ctx.save();
        ctx.strokeStyle = ANNO_COLOR;
        ctx.lineWidth = ANNO_LINE_WIDTH * dpr;
        ctx.setLineDash([]);

        if (_annoState.currentTool === 'circle') {
            var dx = coords.x - _annoState.startX;
            var dy = coords.y - _annoState.startY;
            var rx = Math.abs(dx) / 2;
            var ry = Math.abs(dy) / 2;
            var cx = _annoState.startX + dx / 2;
            var cy = _annoState.startY + dy / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (_annoState.currentTool === 'line') {
            ctx.beginPath();
            ctx.moveTo(_annoState.startX, _annoState.startY);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            // 畫箭頭
            _drawArrowHead(ctx, _annoState.startX, _annoState.startY, coords.x, coords.y, dpr);
        }
        ctx.restore();
    };

    var endDraw = function(e) {
        if (!_annoState.isDrawing) return;
        _annoState.isDrawing = false;
        canvas.releasePointerCapture(e.pointerId);
        var coords = _canvasCoords(e, canvas);

        // 轉換為歸一化座標 (0~1，相對於圖片顯示區域)
        var ann = _pixelToNormalized(_annoState.startX, _annoState.startY, coords.x, coords.y, _annoState.currentTool);
        if (ann) {
            _annoState.currentAnnotations.push(ann);
            _annoState.dirty = true;
            _updateAnnotationHint();
            _renderAllAnnotations();
        } else {
            // 未產生有效 annotation（例如圈太小），重繪清除預覽
            _renderAllAnnotations();
        }
    };

    canvas.onpointerup = endDraw;
    canvas.onpointerleave = endDraw;
    canvas.onpointercancel = endDraw;
}

/**
 * 取得 canvas 上的實際像素座標（考慮 DPR）
 * @param {PointerEvent} e
 * @param {HTMLCanvasElement} canvas
 * @returns {{x:number, y:number}}
 */
function _canvasCoords(e, canvas) {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    return {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr
    };
}

/**
 * 將 canvas 像素座標轉換為歸一化標記 (0~1 相對於圖片顯示區域)
 * @param {number} x1 - start X (canvas px)
 * @param {number} y1 - start Y
 * @param {number} x2 - end X
 * @param {number} y2 - end Y
 * @param {string} tool - 'circle' | 'line'
 * @returns {object|null} 歸一化 annotation 物件，若無效則 null
 */
function _pixelToNormalized(x1, y1, x2, y2, tool) {
    var img = document.getElementById('photoViewerImg');
    var wrap = document.getElementById('annotationCanvasWrap');
    if (!img || !wrap) return null;

    var dpr = window.devicePixelRatio || 1;
    var imgRect = _getImageDisplayRect(img, wrap);

    // Ensure imgRect has valid dimensions
    if (imgRect.width <= 0 || imgRect.height <= 0) return null;

    // Convert pixel coords (already DPR-scaled) back to CSS pixels, 
    // then to normalized relative to image display rect
    function toNorm(pxX, pxY) {
        var cssX = pxX / dpr;
        var cssY = pxY / dpr;
        return {
            nx: (cssX - imgRect.left) / imgRect.width,
            ny: (cssY - imgRect.top) / imgRect.height
        };
    }

    var s = toNorm(x1, y1);
    var e = toNorm(x2, y2);

    // clamp to 0..1
    s.nx = Math.max(0, Math.min(1, s.nx));
    s.ny = Math.max(0, Math.min(1, s.ny));
    e.nx = Math.max(0, Math.min(1, e.nx));
    e.ny = Math.max(0, Math.min(1, e.ny));

    if (tool === 'circle') {
        var rx = Math.abs(e.nx - s.nx) / 2;
        var ry = Math.abs(e.ny - s.ny) / 2;
        // 最小半徑檢查（用歸一化值，約 1% 的圖片尺寸）
        if (rx < 0.008 && ry < 0.008) return null;
        return {
            type: 'circle',
            cx: s.nx + (e.nx - s.nx) / 2,
            cy: s.ny + (e.ny - s.ny) / 2,
            rx: rx,
            ry: ry
        };
    } else if (tool === 'line') {
        // 最小長度檢查
        var dx = e.nx - s.nx;
        var dy = e.ny - s.ny;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.01) return null;
        return {
            type: 'line',
            x1: s.nx,
            y1: s.ny,
            x2: e.nx,
            y2: e.ny
        };
    }
    return null;
}

/**
 * 繪製所有已確認的 annotations
 * @param {CanvasRenderingContext2D} [ctx] - 可選，若未提供則從 canvas 取得
 */
function _renderAllAnnotations(ctx) {
    var canvas = document.getElementById('annotationCanvas');
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    if (!ctx) ctx = canvas.getContext('2d');

    // 清除 canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製所有 annotations
    var allAnns = _annoState.currentAnnotations;
    if (!allAnns || allAnns.length === 0) return;

    var img = document.getElementById('photoViewerImg');
    var wrap = document.getElementById('annotationCanvasWrap');
    if (!img || !wrap) return;
    var imgRect = _getImageDisplayRect(img, wrap);
    if (imgRect.width <= 0 || imgRect.height <= 0) return;

    ctx.save();

    for (var i = 0; i < allAnns.length; i++) {
        var ann = allAnns[i];
        ctx.strokeStyle = ANNO_COLOR;
        ctx.lineWidth = ANNO_LINE_WIDTH * dpr;
        ctx.setLineDash([]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (ann.type === 'circle') {
            var cx = (imgRect.left + ann.cx * imgRect.width) * dpr;
            var cy = (imgRect.top + ann.cy * imgRect.height) * dpr;
            var rx = ann.rx * imgRect.width * dpr;
            var ry = ann.ry * imgRect.height * dpr;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (ann.type === 'line') {
            var x1 = (imgRect.left + ann.x1 * imgRect.width) * dpr;
            var y1 = (imgRect.top + ann.y1 * imgRect.height) * dpr;
            var x2 = (imgRect.left + ann.x2 * imgRect.width) * dpr;
            var y2 = (imgRect.top + ann.y2 * imgRect.height) * dpr;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            _drawArrowHead(ctx, x1, y1, x2, y2, dpr);
        }
    }

    ctx.restore();
}

/**
 * 在線條末端繪製箭頭
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1 - start X
 * @param {number} y1 - start Y
 * @param {number} x2 - end X
 * @param {number} y2 - end Y
 * @param {number} dpr - devicePixelRatio
 */
function _drawArrowHead(ctx, x1, y1, x2, y2, dpr) {
    var headLen = 14 * dpr;
    var angle = Math.atan2(y2 - y1, x2 - x1);
    var arrowAngle = Math.PI / 7; // ~25 degrees

    ctx.fillStyle = ANNO_COLOR;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - headLen * Math.cos(angle - arrowAngle),
        y2 - headLen * Math.sin(angle - arrowAngle)
    );
    ctx.lineTo(
        x2 - headLen * Math.cos(angle + arrowAngle),
        y2 - headLen * Math.sin(angle + arrowAngle)
    );
    ctx.closePath();
    ctx.fill();
}

// ============================================================
// Annotation Toolbar 互動
// ============================================================

/**
 * 設定 annotation 工具
 * @param {string} tool - 'view' | 'circle' | 'line' | 'undo' | 'clear' | 'save'
 */
function setAnnotationTool(tool) {
    if (tool === 'undo') {
        if (_annoState.currentAnnotations.length > 0) {
            _annoState.currentAnnotations.pop();
            _annoState.dirty = true;
            _renderAllAnnotations();
            _updateAnnotationHint();
        }
        return;
    }

    if (tool === 'clear') {
        if (_annoState.currentAnnotations.length === 0) return;
        if (!confirm('確定清除所有標記？')) return;
        _annoState.currentAnnotations = [];
        _annoState.dirty = true;
        _renderAllAnnotations();
        _updateAnnotationHint();
        return;
    }

    if (tool === 'save') {
        saveAnnotations();
        return;
    }

    // 切換繪圖工具
    _annoState.currentTool = tool;
    _updateAnnotationToolUI();
    _updateAnnotationHint();
    _setCanvasMode();
    // 重繪（清除預覽殘影）
    _renderAllAnnotations();
}

/**
 * 更新 annotation 工具列 UI（active 狀態）
 */
function _updateAnnotationToolUI() {
    var tools = document.querySelectorAll('.annotation-tool');
    tools.forEach(function(btn) {
        btn.classList.remove('active');
        var t = btn.getAttribute('data-anno-tool');
        if (t === _annoState.currentTool) {
            btn.classList.add('active');
        }
    });
}

/**
 * 更新 annotation 提示文字
 */
function _updateAnnotationHint() {
    var hint = document.getElementById('annotationHint');
    if (!hint) return;
    hint.classList.remove('warn');

    var toolNames = {
        'view': '🖐️ 檢視模式 — 點擊工具開始標記',
        'circle': '⭕ 畫圈模式 — 拖曳滑鼠畫紅圈',
        'line': '📏 畫線模式 — 拖曳滑鼠畫直線（帶箭頭）'
    };

    var countInfo = '';
    if (_annoState.currentAnnotations.length > 0) {
        countInfo = '（已標記 ' + _annoState.currentAnnotations.length + ' 處';
        if (_annoState.dirty) countInfo += '，未儲存';
        countInfo += '）';
    }

    hint.textContent = (toolNames[_annoState.currentTool] || '') + ' ' + countInfo;
    if (_annoState.dirty) hint.classList.add('warn');
}

/**
 * 儲存 annotations 到 Supabase
 */
async function saveAnnotations() {
    var p = AppState._photoData[AppState._photoViewerIndex];
    if (!p || !AppState.supabase) {
        toast('⚠️ 無法儲存', 'warning');
        return;
    }

    if (!_annoState.dirty) {
        toast('ℹ️ 沒有新的變更需要儲存', 'warning');
        return;
    }

    var saveBtn = document.querySelector('.annotation-tool[data-anno-tool="save"]');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ 儲存中...';
    }

    try {
        var annotationsJson = JSON.stringify(_annoState.currentAnnotations);
        var r = await AppState.supabase.from('tree_photos')
            .update({ annotations: _annoState.currentAnnotations, updated_at: new Date().toISOString() })
            .eq('id', p.id);

        if (r.error) {
            toast('❌ 儲存失敗: ' + r.error.message, 'error');
        } else {
            // 更新本地狀態
            p.annotations = JSON.parse(JSON.stringify(_annoState.currentAnnotations));
            _annoState.savedAnnotations = JSON.parse(JSON.stringify(_annoState.currentAnnotations));
            _annoState.dirty = false;
            _updateAnnotationHint();
            renderPhotoGrid();

            // Flash 儲存按鈕
            if (saveBtn) {
                saveBtn.classList.add('saved');
                setTimeout(function() { saveBtn.classList.remove('saved'); }, 600);
            }
            toast('✅ 標記已儲存 (' + _annoState.currentAnnotations.length + ' 處)', 'success');
        }
    } catch(e) {
        toast('❌ 儲存失敗: ' + e.message, 'error');
    }

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 儲存標記';
    }
}

/**
 * 從 annotation toolbar 按鈕事件觸發
 * 此函式在 dom.js event delegation 中被呼叫
 */
function handleAnnotationToolClick(toolName) {
    setAnnotationTool(toolName);
}

// ============================================================
// Resize handler: 當視窗大小改變時，重新對齊 canvas
// ============================================================
var _resizeDebounceTimer = null;
window.addEventListener('resize', function() {
    if (_resizeDebounceTimer) clearTimeout(_resizeDebounceTimer);
    _resizeDebounceTimer = setTimeout(function() {
        var modal = document.getElementById('photoViewerModal');
        if (modal && !modal.classList.contains('hidden')) {
            var p = AppState._photoData[AppState._photoViewerIndex];
            if (p) initAnnotationCanvas(p);
        }
    }, 200);
});

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.photos = {
    loadTreePhotos: loadTreePhotos,
    renderPhotoGrid: renderPhotoGrid,
    handlePhotoFilesSelected: handlePhotoFilesSelected,
    processAndUploadPhoto: processAndUploadPhoto,
    compressImage: compressImage,
    openPhotoViewer: openPhotoViewer,
    updatePhotoViewer: updatePhotoViewer,
    photoViewerNav: photoViewerNav,
    downloadCurrentPhoto: downloadCurrentPhoto,
    editPhotoCaption: editPhotoCaption,
    savePhotoCaption: savePhotoCaption,
    deleteCurrentPhoto: deleteCurrentPhoto,
    deletePhoto: deletePhoto,
    loadPhotosIntoPopup: loadPhotosIntoPopup,
    renderPhotoStripContent: renderPhotoStripContent,
    openPhotoViewerForTree: openPhotoViewerForTree,
    // Annotation
    initAnnotationCanvas: initAnnotationCanvas,
    setAnnotationTool: setAnnotationTool,
    handleAnnotationToolClick: handleAnnotationToolClick,
    saveAnnotations: saveAnnotations,
    _renderAllAnnotations: _renderAllAnnotations
};

TreeApp.annotations = {
    setTool: setAnnotationTool,
    save: saveAnnotations,
    getState: function() { return _annoState; }
};