/**
 * 🌳 樹木調查系統 — 照片管理模組
 * @module photos
 * 
 * 照片上傳（含 HEIC 轉換 + 雙軌壓縮 1920px/300px）、
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
        div.innerHTML =
            '<img src="' + esc(url || '') + '" alt="Photo" onerror="this.style.display=\'none\'">' +
            (p.caption ? '<div class="photo-caption-badge">' + esc(p.caption) + '</div>' : '') +
            '<button class="photo-delete" title="刪除照片">✕</button>';
        div.querySelector('img').addEventListener('click', function(e) {
            e.stopPropagation();
            openPhotoViewer(idx);
        });
        div.querySelector('.photo-delete').addEventListener('click', function(e) {
            e.stopPropagation();
            deletePhoto(p.id, idx);
        });
        grid.appendChild(div);
    });
}

// ============================================================
// 照片選取 → 上傳
// ============================================================

/**
 * 處理檔案選擇，逐張上傳
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
    toast('📷 正在處理 ' + files.length + ' 張照片...', 'warning');
    for (var i = 0; i < files.length; i++) {
        await processAndUploadPhoto(files[i]);
    }
    await loadTreePhotos(AppState._photoCurrentTreeId);
    toast('✅ 上傳完成', 'success');
}

/**
 * 處理單張照片：HEIC 轉換 → 壓縮 → 上傳 → 寫入 DB
 * @param {File} file
 */
async function processAndUploadPhoto(file) {
    try {
        // 處理 HEIC
        var blob = file;
        if (file.type === 'image/heic' || file.type === 'image/heif' ||
            file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            if (window.heic2any) {
                try {
                    var heicBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
                    blob = Array.isArray(heicBlob) ? heicBlob[0] : heicBlob;
                } catch(e) { console.warn('HEIC conversion failed, trying raw upload:', e.message); }
            }
        }

        // 壓縮產生縮圖
        var compressed = await compressImage(blob, 1920, 0.8);
        var thumb = await compressImage(blob, 300, 0.6);

        // 產生檔名
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'heic' || ext === 'heif') ext = 'jpg';
        var fileName = uuid() + '.' + ext;
        var storagePath = AppState.currentProjectId + '/' + AppState._photoCurrentTreeId + '/' + fileName;

        // 上傳到 Supabase Storage
        var upResult = await AppState.supabase.storage.from('tree-photos').upload(storagePath, compressed, {
            contentType: 'image/jpeg',
            upsert: false
        });
        if (upResult.error) {
            console.warn('Storage upload err:', upResult.error.message);
            toast('⚠️ 請先建立 Supabase Storage bucket: tree-photos', 'warning');
            return;
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
            thumb_path: storagePath, // 縮圖用同一路徑，CSS 會縮小顯示
            created_at: new Date().toISOString()
        };

        var insResult = await AppState.supabase.from('tree_photos').insert(photoRecord);
        if (insResult.error) {
            console.warn('Photo record insert err:', insResult.error.message);
            toast('⚠️ 請先建立 tree_photos 資料表 (SQL)', 'warning');
        }
    } catch(e) {
        console.error('Photo upload error:', e.message || e);
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
    if (photo && photo.storage_path) {
        try { await AppState.supabase.storage.from('tree-photos').remove([photo.storage_path]); } catch(e) {}
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
    stripEl.innerHTML = '<div class="strip-loading">⏳ 載入中...</div>';
    try {
        var r = await AppState.supabase.from('tree_photos')
            .select('*')
            .eq('tree_id', treeId)
            .order('created_at', { ascending: false })
            .limit(5);
        var photos = (r.data && r.data.length > 0) ? r.data : [];
        AppState._popupPhotoCache[treeId] = photos;
        renderPhotoStripContent(stripEl, photos, treeId);
    } catch(e) {
        stripEl.innerHTML = '<div class="strip-empty">❌ 載入失敗</div>';
    }
}

/**
 * 渲染照片 strip 內容
 * @param {HTMLElement} stripEl
 * @param {object[]} photos
 * @param {string} treeId
 */
function renderPhotoStripContent(stripEl, photos, treeId) {
    if (!photos || photos.length === 0) {
        stripEl.innerHTML = '<div class="strip-empty">📭 未有照片</div>';
        return;
    }
    var displayPhotos = photos.slice(0, 4);
    var hasMore = photos.length > 4;
    var html = '<div class="strip-label">📸 ' + photos.length + ' 張照片</div>';
    for (var i = 0; i < displayPhotos.length; i++) {
        var p = displayPhotos[i];
        var url = p.storage_path;
        if (url && !url.startsWith('http')) {
            try { url = AppState.supabase.storage.from('tree-photos').getPublicUrl(url).data.publicUrl; } catch(e) {}
        }
        html += '<img class="strip-thumb" src="' + esc(url || '') +
            '" onclick="event.stopPropagation();openPhotoViewerForTree(\'' + treeId + '\', ' + i + ')"' +
            ' onerror="this.style.display=\'none\'" title="' + esc(p.caption || '') + '">';
    }
    if (hasMore) {
        html += '<span class="strip-more" onclick="event.stopPropagation();openPhotoViewerForTree(\'' + treeId + '\', 0)">📷 查看全部 ▶</span>';
    }
    stripEl.innerHTML = html;
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