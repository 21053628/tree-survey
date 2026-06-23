/**
 * 🌳 樹木調查系統 — 物種清單與建議下拉模組
 * @module species
 * 
 * 從 Supabase 載入物種清單（species_list），並建立自訂搜尋式下拉選單
 * （botanical_name / chinese_name 雙欄位互聯自動補全）。
 */

// ============================================================
// 載入物種清單
// ============================================================

/**
 * 從 Supabase 載入物種清單
 * 優先使用 botanical_name + chinese_name 欄位，若無則fallback到舊版 species 欄位
 */
function loadSpeciesList() {
    const supabase = AppState.supabase;
    if (!supabase) { setTimeout(function(){ loadSpeciesList(); }, 1000); return; }
    supabase.from('species_list').select('botanical_name,chinese_name').order('botanical_name', { ascending: true }).then(function(r) {
        if (!r.error && r.data && r.data.length > 0) {
            buildSpeciesLists(r.data.map(function(x){ return {bot: x.botanical_name, chi: x.chinese_name}; }));
            return;
        }
        // Empty data: show warning
        AppState.botanicalNames = [];
        AppState.chineseNames = [];
        AppState.speciesMap = {};
        AppState.speciesLoaded = false;
        document.getElementById('speciesWarning').classList.remove('hidden');
        initSuggestDropdowns();
    });
}

/**
 * 根據資料列建立物種清單
 * @param {Array<{bot: string, chi: string}>} rows
 */
function buildSpeciesLists(rows) {
    AppState.botanicalNames = [];
    AppState.chineseNames = [];
    AppState.speciesMap = {};
    const seenBot = {}, seenChi = {};
    rows.forEach(function(r) {
        const bot = (r.bot || '').trim(), chi = (r.chi || '').trim();
        if (bot && !seenBot[bot]) { AppState.botanicalNames.push(bot); seenBot[bot] = true; }
        if (chi && chi !== '-' && !seenChi[chi]) { AppState.chineseNames.push(chi); seenChi[chi] = true; }
        if (bot && chi && chi !== '-') {
            AppState.speciesMap[bot] = chi;
            AppState.speciesMap[chi] = bot;
        }
    });
    AppState.speciesLoaded = (AppState.botanicalNames.length > 0);
    if (AppState.speciesLoaded) document.getElementById('speciesWarning').classList.add('hidden');
    else document.getElementById('speciesWarning').classList.remove('hidden');
    initSuggestDropdowns();
}

// ============================================================
// 自訂搜尋式下拉選單
// ============================================================

/**
 * 初始化兩個建議下拉選單（botanical + chinese）
 * 防重複初始化
 */
function initSuggestDropdowns() {
    if (AppState._suggestReady) return;
    if (!AppState.speciesLoaded && AppState.botanicalNames.length === 0) return;
    AppState._suggestReady = true;
    setupSuggest('tree_botanicalName', 'suggestBotanical', AppState.botanicalNames, 'chinese');
    setupSuggest('tree_chineseName', 'suggestChinese', AppState.chineseNames, 'botanical');
}

/**
 * 對指定 input 設定建議下拉
 * @param {string} inputId - input element ID
 * @param {string} wrapId - .suggest-wrap wrapper ID
 * @param {string[]} dataList - 資料清單
 * @param {string} autoFillType - 反向自動補全的目標欄位類型 ('chinese' | 'botanical')
 */
function setupSuggest(inputId, wrapId, dataList, autoFillType) {
    if (AppState._suggestSetupDone[inputId]) return;
    AppState._suggestSetupDone[inputId] = true;
    const input = document.getElementById(inputId);
    const wrap = document.getElementById(wrapId);
    if (!input || !wrap) return;
    const dropdown = wrap.querySelector('.suggest-dropdown');
    if (!dropdown) return;
    let selectedIndex = -1;

    /**
     * 渲染下拉選單
     * @param {string} [filter] - 過濾關鍵字
     */
    function render(filter) {
        dropdown.innerHTML = '';
        selectedIndex = -1;
        let filtered = dataList;
        if (filter) {
            const lower = filter.toLowerCase();
            filtered = dataList.filter(function(item) { return item.toLowerCase().indexOf(lower) >= 0; });
        }
        const show = filtered.slice(0, 200);
        if (show.length === 0) {
            dropdown.innerHTML = '<div class="no-results">' + (dataList.length === 0 ? 'Species list is empty' : 'No results') + '</div>';
        } else {
            show.forEach(function(item, idx) {
                const div = document.createElement('div');
                div.className = 'suggest-item';
                if (filter && filter.length > 0) {
                    const esc2 = filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp('(' + esc2 + ')', 'gi');
                    const match = regex.exec(item);
                    if (match) {
                        const mIdx = match.index;
                        const before = document.createTextNode(item.substring(0, mIdx));
                        div.appendChild(before);
                        const hl = document.createElement('span');
                        hl.className = 'hl';
                        hl.textContent = match[1];
                        div.appendChild(hl);
                        const after = document.createTextNode(item.substring(mIdx + match[1].length));
                        div.appendChild(after);
                    } else {
                        div.textContent = item;
                    }
                } else {
                    div.textContent = item;
                }
                div.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    input.value = item;
                    dropdown.classList.remove('show');
                    autoFillOpposite(inputId, item);
                });
                div.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    input.value = item;
                    dropdown.classList.remove('show');
                    autoFillOpposite(inputId, item);
                });
                dropdown.appendChild(div);
            });
        }
        dropdown.classList.add('show');
        if (isMobile()) {
            setTimeout(function(){ dropdown.scrollIntoView({block:'nearest'}); }, 50);
        }
    }

    /**
     * 反向自動補全：根據物種映射填入對面欄位
     * @param {string} fromId - 來源 input ID
     * @param {string} val - 選取的值
     */
    function autoFillOpposite(fromId, val) {
        const opp = AppState.speciesMap[val];
        if (!opp) return;
        if (fromId === 'tree_botanicalName') {
            document.getElementById('tree_chineseName').value = opp;
        } else {
            document.getElementById('tree_botanicalName').value = opp;
        }
    }

    // 事件監聽
    input.addEventListener('focus', function() { render(input.value); });
    input.addEventListener('input', function() { render(input.value); });
    input.addEventListener('keydown', function(e) {
        if (!dropdown.classList.contains('show')) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { render(input.value); e.preventDefault(); }
            return;
        }
        const items = dropdown.querySelectorAll('.suggest-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            items.forEach(function(it, i){ it.classList.toggle('active', i === selectedIndex); });
            if (items[selectedIndex]) items[selectedIndex].scrollIntoView({block:'nearest'});
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            items.forEach(function(it, i){ it.classList.toggle('active', i === selectedIndex); });
            if (items[selectedIndex]) items[selectedIndex].scrollIntoView({block:'nearest'});
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && items[selectedIndex]) {
                input.value = items[selectedIndex].textContent;
                dropdown.classList.remove('show');
                autoFillOpposite(inputId, input.value);
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('show');
        }
    });
    // 點擊外部關閉下拉
    document.addEventListener('click', function(e) {
        if (!wrap.contains(e.target)) { dropdown.classList.remove('show'); }
    }, true);
}

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.species = {
    loadSpeciesList: loadSpeciesList,
    buildSpeciesLists: buildSpeciesLists,
    initSuggestDropdowns: initSuggestDropdowns,
    setupSuggest: setupSuggest
};