/**
 * 🌳 樹木調查系統 — 集中式狀態管理 (AppState)
 * @module state
 * 
 * 所有原先的全域變數統一收攏至此物件，消除全域污染。
 * 所有模組透過 AppState.xxx 讀寫狀態。
 */

/**
 * @typedef {Object} AppState
 * @property {object|null} supabase - Supabase client 實例
 * @property {string} currentView - 當前視圖 ('projects' | 'project-detail')
 * @property {string} currentDetailTab - 專案詳情頁籤 ('list' | 'map')
 * @property {string|null} currentProjectId - 當前專案 ID
 * @property {string} currentProjectName - 當前專案名稱
 * @property {number} projPage - 專案列表當前頁碼
 * @property {number} treePage - 樹木列表當前頁碼
 * @property {object|null} pendingDelete - 待刪除物件 {type, id, name}
 * @property {boolean} initDone - 是否已完成初始化
 * @property {string[]} botanicalNames - 植物學名清單
 * @property {string[]} chineseNames - 中文名清單
 * @property {Object<string, string>} speciesMap - 學名↔中文名雙向映射
 * @property {boolean} speciesLoaded - 物種清單是否已載入
 * @property {boolean} _loadingProjects - 專案載入鎖
 * @property {boolean} _loadingTrees - 樹木載入鎖
 * 
 * @property {L.Map|null} mapObj - Leaflet 地圖實例
 * @property {L.Marker[]} mapMarkers - 地圖標記陣列
 * @property {Object<string, L.Marker>} markerLookup - treeId → marker 查找表
 * @property {object[]} _cachedTreeData - 地圖用的樹木快取
 * @property {Object<string, boolean>} _hiddenHealth - 被濾鏡隱藏的健康狀態
 * @property {L.Marker|null} _locateMarker - 「定位自己」標記
 * @property {L.Map|null} _pickerMap - 地圖揀位器實例
 * @property {L.Marker|null} _pickerMarker - 地圖揀位標記
 * @property {number|null} _pickerLat - 揀位緯度
 * @property {number|null} _pickerLng - 揀位經度
 * @property {string} _currentLayer - 主地圖當前圖層 key
 * @property {string} _pickerCurrentLayer - 揀位器當前圖層 key
 * @property {string|null} _pendingFocusTreeId - 等待定位的樹 ID
 * @property {boolean} _focusResolved - 定位是否已解決
 * @property {boolean} _focusInProgress - 定位是否進行中
 * @property {number} _gpsFallbackStage - GPS 降級階段
 * @property {boolean} _suggestReady - 建議下拉是否已初始化
 * @property {Object<string, boolean>} _suggestSetupDone - 已設定下拉的 input ID
 * @property {Object<string, object[]>} _popupPhotoCache - 地圖 popup 照片快取
 * 
 * @property {boolean} isAuthenticated - 是否已登入
 * @property {object|null} currentUser - 當前使用者 {id, email, ...}
 * 
 * @property {object[]} _photoData - 當前樹木的照片資料
 * @property {number} _photoViewerIndex - 照片檢視器當前索引
 * @property {string|null} _photoCurrentTreeId - 照片關聯的樹 ID
 * 
 * @property {object} projectsCache - 專案列表快取 {get, set, invalidate}
 * @property {object} treesCache - 樹木列表快取 {get, set, invalidate}
 */

const AppState = {
    supabase: null,
    currentView: 'projects',
    currentDetailTab: 'list',
    currentProjectId: null,
    currentProjectName: '',
    projPage: 0,
    treePage: 0,
    pendingDelete: null,
    initDone: false,

    botanicalNames: [],
    chineseNames: [],
    speciesMap: {},
    speciesLoaded: false,

    _loadingProjects: false,
    _loadingTrees: false,

    mapObj: null,
    mapMarkers: [],
    markerLookup: {},
    _cachedTreeData: [],
    _hiddenHealth: {},
    _locateMarker: null,
    _pickerMap: null,
    _pickerMarker: null,
    _pickerLat: null,
    _pickerLng: null,
    _currentLayer: 'dark',
    _pickerCurrentLayer: 'dark',
    _pendingFocusTreeId: null,
    _focusResolved: false,
    _focusInProgress: false,
    _gpsFallbackStage: 0,
    _suggestReady: false,
    _suggestSetupDone: {},
    _popupPhotoCache: {},

    isAuthenticated: false,
    currentUser: null,

    _photoData: [],
    _photoViewerIndex: 0,
    _photoCurrentTreeId: null,

    projectsCache: createCache(),
    treesCache: createCache()
};