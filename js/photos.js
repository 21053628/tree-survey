/**
 * 🌳 樹木調查系統 — 照片管理模組
 * @module photos
 * 
 * 照片上傳（含 HEIC 轉換 + 雙軌壓縮 1920px/300px，並行上傳 + 進度追蹤）、
 * 照片檢視器（前後瀏覽、下載、說明編輯）、
 * 照片刪除（含 Storage 清理）、
 * 地圖 Popup 照片 strip 載入。
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
        var r = await AppState.supabase.from('tree_photos')
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
    var grid = document.getElementById('photoGrid');
    var countLabel = document.getElementById('photoCountLabel');
    if (!grid) return;
    if (countLabel) countLabel.textContent = AppState._photoData.length + ' 張';
    grid.innerHTML = '';
    AppState._photoData.forEach(function(p, idx) {
        var div = document.createElement('div');
        div.className = 'photo-thumb';
        var url = p.thumb_path || p.storage_path;
        // 如果是 storage path，轉換為 public URL
        if (url && !url.startsWith('http')) {
            try { url = AppState.supabase.storage.from('tree-photos').getPublicUrl(url).data.publicUrl; } catch(e) {}
        }
        // 安全建立 img element
        var img = document.createElement('img');
        img.src = url || '';
        img.alt = 'Photo';
        img.onerror = function() { this.style.display = 'none'; };
        img.addEventListener('click', function(e) {
            e.stopPropagation();
            openPhotoViewer(idx);
        });
        div.appendChild(img);

        if (p.caption) {
            var cap = document.createElement('div');
            cap.className = 'photo-caption-badge';
            cap.textContent = p.caption;
            div.appendChild(cap);
        }

        var delBtn = document.createElement('button');
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
    var files = Array.from(input.files);
    input.value = '';
    var total = files.length;
    var completed = 0;
    var failed = 0;

    toast('📷 正在處理 ' + total + ' 張照片...', 'warning');
    _updatePhotoProgress(0, total);

    // 並行處理，限制同時上限 4
    var CONCURRENCY = 4;
    var idx = 0;

    async function worker() {
        while (idx < files.length) {
            var i = idx++;
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
    var workers = [];
    for (var w = 0; w < Math.min(CONCURRENCY, total); w++) {
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
    var label = document.getElementById('photoUploadLabel');
    if (label) {
        if (done < total) {
            label.textContent = '上傳中 ' + done + '/' + total;
        } else {
            label.textContent = '拍照/上傳';
        }
    }
}

/**
 * 處理單張照片：HEIC 轉換 → 壓縮 → 上傳 → 寫入 DB
 * @param {File} file
 */
async function processAndUploadPhoto(file) {
    // 處理 HEIC
    var blob = file;
    if (file.type === 'image/heic' || file.type === 'image/heif' ||
        file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        if (window.heic2any) {
            try {
                var heicBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: PHOTO_QUALITY });
                blob = Array.isArray(heicBlob) ? heicBlob[0] : heicBlob;
            } catch(e) { console.warn('HEIC conversion failed, trying raw upload:', e.message); }
        }
    }

    // 壓縮產生大圖 + 縮圖
    var compressed = await compressImage(blob, PHOTO_MAX_DIM, PHOTO_QUALITY);
    var thumb = await compressImage(blob, THUMB_MAX_DIM, THUMB_QUALITY);

    // 產生檔名
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'heic' || ext === 'heif') ext = 'jpg';
    var fileName = uuid() + '.' + ext;
    var storagePath = AppState.currentProjectId + '/' + AppState._photoCurrentTreeId + '/' + fileName;
    var thumbPath = AppState.currentProjectId + '/' + AppState._photoCurrentTreeId + '/thumb_' + fileName;

    // 並行上傳大圖 + 縮圖到 Supabase Storage
    var upResult = await AppState.supabase.storage.from('tree-photos').upload(storagePath, compressed, {
        contentType: 'image/jpeg',
        upsert: false
    });
    if (upResult.error) {
        console.warn('Storage upload err:', upResult.error.message);
        toast('⚠️ 請先建立 Supabase Storage bucket: tree-photos', 'warning');
        throw new Error('Storage upload failed: ' + upResult.error.message);
    }
    // 上傳縮圖（失敗唔影響主流程）
    try {
        await AppState.supabase.storage.from('tree-photos').upload(thumbPath, thumb, {
            contentType: 'image/jpeg',
            upsert: false
        });
    } catch(e) {
        console.warn('Thumb upload err (non-fatal):', e.message);
        thumbPath = storagePath;
    }

    // 插入 tree_photos 記錄
    var photoRecord = {
        id: uuid(),
        tree_id: AppState._photoCurrentTreeId,
        project_id: AppState.currentProjectId,
        user_id: AppState.currentUser?.id,
        file_name: file.name,
        storage_path: storagePath,
        caption: '',
        taken_at: new Date().toISOString(),
        file_size: file.size,
        thumb_path: thumbPath, // 獨立縮圖路徑，節省頻寬
        created_at: new Date().toISOString()
    };

    var insResult = await AppState.supabase.from('tree_photos').insert(photoRecord);
    if (insResult.error) {
        console.warn('Photo record insert err:', insResult.error.message);
        toast('⚠️ 請先建立 tree_photos 資料表 (SQL)', 'warning');
        throw new Error('DB insert failed: ' + insResult.error.message);
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
        var img = new Image();
        var url = URL.createObjectURL(blob);
        img.onload = function() {
            URL.revokeObjectURL(url);
            var w = img.width, h = img.height;
            if (w <= maxSize && h <= maxSize) { resolve(blob); return; }
            var ratio = Math.min(maxSize / w, maxSize / h);
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(w * ratio);
            canvas.height = Math.round(h * ratio);
            var ctx = canvas.getContext('2d');
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
    var p = AppState._photoData[AppState._photoViewerIndex];
    if (!p) return;
    var url = p.storage_path;
    if (url && !url.startsWith('http')) {
        try { url = AppState.supabase.storage.from('tree-photos').getPublicUrl(url).data.publicUrl; } catch(e) {}
    }
    document.getElementById('photoViewerImg').src = url || '';
    document.getElementById('photoViewerCaption').textContent = p.caption || '';
    document.getElementById('photoViewerCounter').textContent = (AppState._photoViewerIndex + 1) + ' / ' + AppState._photoData.length;
    document.getElementById('photoViewerPrev').disabled = (AppState._photoViewerIndex <= 0);
    document.getElementById('photoViewerNext').disabled = (AppState._photoViewerIndex >= AppState._photoData.length - 1);
}

/**
 * 照片檢視器前後瀏覽
 * @param {number} direction - -1 或 +1
 */
function photoViewerNav(direction) {
    AppState._photoViewerIndex = Math.max(0, Math.min(AppState._photoViewerIndex + direction, AppState._photoData.length - 1));
    updatePhotoViewer();
}

/**
 * 下載當前檢視的照片
 */
function downloadCurrentPhoto() {
    var p = AppState._photoData[AppState._photoViewerIndex];
    if (!p) return;
    var url = p.storage_path;
    if (url && !url.startsWith('http')) {
        try { url = AppState.supabase.storage.from('tree-photos').getPublicUrl(url).data.publicUrl; } catch(e) {}
    }
    if (url) {
        var a = document.createElement('a');
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
    var p = AppState._photoData[AppState._photoViewerIndex];
    if (!p) return;
    document.getElementById('photoCaptionInput').value = p.caption || '';
    document.getElementById('photoCaptionDate').value = p.taken_at ? p.taken_at.split('T')[0] : '';
    showModal('photoCaptionModal');
}

/**
 * 儲存照片說明
 */
async function savePhotoCaption() {
    var p = AppState._photoData[AppState._photoViewerIndex];
    if (!p || !AppState.supabase) return;
    var caption = document.getElementById('photoCaptionInput').value.trim();
    var takenAt = document.getElementById('photoCaptionDate').value;
    var updateData = { caption: caption, updated_at: new Date().toISOString() };
    if (takenAt) updateData.taken_at = new Date(takenAt + 'T00:00:00').toISOString();

    var r = await AppState.supabase.from('tree_photos').update(updateData).eq('id', p.id);
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
    var p = AppState._photoData[AppState._photoViewerIndex];
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
    var photo = AppState._photoData.find(function(p) { return p.id === photoId; });
    if (photo) {
        var toRemove = [];
        if (photo.storage_path) toRemove.push(photo.storage_path);
        if (photo.thumb_path && photo.thumb_path !== photo.storage_path) toRemove.push(photo.thumb_path);
        if (toRemove.length > 0) {
            try { await AppState.supabase.storage.from('tree-photos').remove(toRemove); } catch(e) {}
        }
    }
    var r = await AppState.supabase.from('tree_photos').delete().eq('id', photoId);
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
    var loadingDiv = document.createElement('div');
    loadingDiv.className = 'strip-loading';
    loadingDiv.textContent = '⏳ 載入中...';
    stripEl.appendChild(loadingDiv);
    try {
        var r = await AppState.supabase.from('tree_photos')
            .select('*')
            .eq('tree_id', treeId)
            .order('created_at', { ascending: false })
            .limit(POPUP_PHOTO_LIMIT);
        var photos = (r.data && r.data.length > 0) ? r.data : [];
        AppState._popupPhotoCache[treeId] = photos;
        renderPhotoStripContent(stripEl, photos, treeId);
    } catch(e) {
        stripEl.innerHTML = '';
        var errDiv = document.createElement('div');
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
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'strip-empty';
        emptyDiv.textContent = '📭 未有照片';
        stripEl.appendChild(emptyDiv);
        return;
    }
    var displayPhotos = photos.slice(0, POPUP_STRIP_DISPLAY);
    var hasMore = photos.length > POPUP_STRIP_DISPLAY;

    var label = document.createElement('div');
    label.className = 'strip-label';
    label.textContent = '📸 ' + photos.length + ' 張照片';
    stripEl.appendChild(label);

    for (var i = 0; i < displayPhotos.length; i++) {
        var p = displayPhotos[i];
        var url = p.thumb_path || p.storage_path;
        if (url && !url.startsWith('http')) {
            try { url = AppState.supabase.storage.from('tree-photos').getPublicUrl(url).data.publicUrl; } catch(e) {}
        }
        var img = document.createElement('img');
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
        var moreSpan = document.createElement('span');
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
    var photos = AppState._popupPhotoCache[treeId];
    if (!photos) {
        try {
            var r = await AppState.supabase.from('tree_photos')
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
    openPhotoViewerForTree: openPhotoViewerForTree
};
