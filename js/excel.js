/**
 * 🌳 樹木調查系統 — Excel 匯出模組
 * @module excel
 * 
 * 支援：
 * - 單一專案樹木清單匯出
 * - 全系統所有專案大總結匯出（每個專案獨立工作表 + Summary 工作表）
 */

// ============================================================
// 匯出當前專案的全部樹木
// ============================================================

/**
 * 匯出當前專案的所有樹木到 Excel
 */
async function exportProjectTreesExcel() {
    if (!AppState.currentProjectId || !xlsxReady()) { toast('⚠️ Excel library 未載入', 'warning'); return; }
    toast('📥 正在匯出...', 'warning');
    try {
        const allTrees = await fetchAllPages(
            AppState.supabase.from('trees')
                .select('*')
                .eq('projectId', AppState.currentProjectId)
                .order('treeIdNo', { ascending: true })
        );
        if (allTrees.length === 0) { toast('⚠️ 冇樹木資料', 'warning'); return; }

        /** @type {object[]} */
        const rows = allTrees.map(function(t) {
            return {
                'Tree ID': t.treeIdNo || '',
                'Species (Chinese Name)': t.chineseName || '',
                'Species (Botanical Name)': t.botanicalName || '',
                'DBH (mm)': t.trunkDiameter || '',
                'Height (m)': t.overallHeight || '',
                'Crown Spread (m)': t.crownSpread || '',
                'Health Condition': t.healthCondition || '',
                'Structural Condition': t.structuralCondition || '',
                'Amenity Value': t.amenityValue || '',
                'Observed Defects': t.observedDefects || '',
                'Recommendation': t.recommendation || '',
                'Remarks / Re-check': t.remarks || '',
                'Latitude': t.latitude || '',
                'Longitude': t.longitude || '',
                'Easting (HK1980)': t.easting || '',
                'Northing (HK1980)': t.northing || ''
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tree Survey');
        XLSX.writeFile(wb, (AppState.currentProjectName || 'project') + '_TreeSurvey_' + todayStr() + '.xlsx');
        toast('✅ 已匯出 ' + allTrees.length + ' 棵樹', 'success');
    } catch(e) {
        toast('❌ ' + e.message, 'error');
    }
}

// ============================================================
// 匯出全部專案的大總結 Excel
// ============================================================

/**
 * 匯出全部專案的樹木資料（多工作表 + Summary）
 */
async function exportAllProjectsExcel() {
    if (!xlsxReady()) { toast('⚠️ Excel library 未載入', 'warning'); return; }
    toast('📥 正在匯出全部...', 'warning');
    try {
        // 載入全部專案（使用 fetchAllPages）
        const allProjects = await fetchAllPages(
            AppState.supabase.from('projects')
                .select('*')
                .order('name', { ascending: true })
        );

        const wb = XLSX.utils.book_new();
        /** @type {object[]} */
        const summaryRows = [];
        let totalTrees = 0;

        for (let i = 0; i < allProjects.length; i++) {
            const proj = allProjects[i];
            // 載入此專案全部樹木
            const allTrees = await fetchAllPages(
                AppState.supabase.from('trees')
                    .select('*')
                    .eq('projectId', proj.id)
                    .order('treeIdNo', { ascending: true })
            );
            totalTrees += allTrees.length;
            summaryRows.push({
                '專案名稱': proj.name || '',
                '調查日期': proj.surveyDate || '',
                '樹木數量': allTrees.length,
                '備註': proj.notes || ''
            });

            if (allTrees.length > 0) {
                /** @type {object[]} */
                const treeRows = allTrees.map(function(t) {
                    return {
                        'Tree ID': t.treeIdNo || '',
                        'Species (Botanical Name)': t.botanicalName || '',
                        'Species (Chinese Name)': t.chineseName || '',
                        'DBH (mm)': t.trunkDiameter || '',
                        'Height (m)': t.overallHeight || '',
                        'Crown Spread (m)': t.crownSpread || '',
                        'Health Condition': t.healthCondition || '',
                        'Structural Condition': t.structuralCondition || '',
                        'Amenity Value': t.amenityValue || '',
                        'Observed Defects': t.observedDefects || '',
                        'Recommendation': t.recommendation || '',
                        'Remarks / Re-check': t.remarks || '',
                        'Latitude': t.latitude || '',
                        'Longitude': t.longitude || '',
                        'Easting (HK1980)': t.easting || '',
                        'Northing (HK1980)': t.northing || ''
                    };
                });
                const sn = (proj.name || 'Project').substring(0, 28).replace(/[\\/*?[\]:]/g, '');
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(treeRows), sn);
            }
        }

        // Summary 工作表
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
        XLSX.writeFile(wb, 'All_TreeSurveys_' + todayStr() + '.xlsx');
        toast('✅ 已匯出 ' + allProjects.length + ' 個專案，共 ' + totalTrees + ' 棵樹', 'success');
    } catch(e) {
        toast('❌ ' + e.message, 'error');
    }
}

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.excel = {
    exportProjectTreesExcel: exportProjectTreesExcel,
    exportAllProjectsExcel: exportAllProjectsExcel
};