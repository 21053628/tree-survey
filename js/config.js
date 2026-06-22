/**
 * 🌳 樹木調查系統 — 環境配置
 * @module config
 */

/**
 * Supabase 專案 URL
 * @type {string}
 */
var SUPABASE_URL = 'https://qdwccjempkczvgewiepi.supabase.co';

/**
 * Supabase Anon (Public) Key
 * @type {string}
 */
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkd2NjamVtcGtjenZnZXdpZXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NzI4NTMsImV4cCI6MjA5NzQ0ODg1M30.XoAly_tar_hUuNTXMJ0t4qkXst08JKzF9VQcs-Ov960';

/**
 * 香港中心座標 [lat, lng]
 * @type {number[]}
 */
var HK_CENTER = [22.35, 114.15];

/**
 * Leaflet 圖層設定
 * @type {Object<string, {name: string, url: string, options: Object}>}
 */
var LAYER_CONFIG = {
    dark:   { name: '🌙 Dark',   url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',              options: { attribution: '&copy; <a href="https://carto.com/">CARTO</a>', maxZoom: 19 } },
    imagery:{ name: '🛰️ 衛星',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', options: { attribution: '&copy; Esri, Maxar, Earthstar Geographics', maxZoom: 19 } },
    topo:   { name: '🗺️ 地形',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',  options: { attribution: '&copy; Esri', maxZoom: 19 } },
    street: { name: '🏙️ 街道',   url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                          options: { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>', maxZoom: 19 } }
};

/**
 * 列表每頁筆數
 * @type {number}
 */
var PAGE_SIZE = 30;

/**
 * 搜尋去抖動延遲（毫秒）
 * @type {number}
 */
var DEBOUNCE_DELAY = 300;

/**
 * 資料快取 TTL（毫秒）— 5 分鐘
 * @type {number}
 */
var CACHE_TTL = 5 * 60 * 1000;

// ============================================================
// 批次與輪詢常數
// ============================================================

/** @type {number} 分頁/批次載入大小 */
var FETCH_PAGE_SIZE = 1000;

/** @type {number} CDN 輪詢最大次數 */
var CDN_POLL_MAX = 150;

/** @type {number} CDN 輪詢間隔 (ms) */
var CDN_POLL_INTERVAL_MS = 100;

/** @type {number} 地圖初始化輪詢重試上限 */
var MAP_RETRY_MAX = 80;

/** @type {number} 地圖定位輪詢重試上限 */
var MAP_FOCUS_RETRY_MAX = 66;

/** @type {number} 地圖輪詢間隔 (ms) */
var MAP_RETRY_INTERVAL_MS = 150;

// ============================================================
// setTimeout 延遲常數 (ms)
// ============================================================

/** @type {number} 建議下拉初始化延遲 */
var DELAY_SUGGEST_INIT = 200;

/** @type {number} 地圖 invalidateSize 第一階段延遲 */
var DELAY_MAP_INVALIDATE_1 = 200;

/** @type {number} 地圖 invalidateSize 第二階段延遲 */
var DELAY_MAP_INVALIDATE_2 = 600;

/** @type {number} renderMap 延遲觸發 */
var DELAY_RENDER_MAP = 100;

/** @type {number} 聚焦後打開 popup 延遲 */
var DELAY_FOCUS_OPEN_POPUP = 300;

/** @type {number} 聚焦標籤動畫延遲 */
var DELAY_FOCUS_LABEL = 400;

/** @type {number} 聚焦圖示動畫延遲 */
var DELAY_FOCUS_ICON_ANIM = 500;

/** @type {number} GPS 警告延遲顯示 */
var DELAY_GPS_WARN = 2000;

/** @type {number} 物種清單載入重試延遲 */
var DELAY_LOAD_SPECIES_RETRY = 1000;

// ============================================================
// UI 常數
// ============================================================

/** @type {number} Toast 顯示時長 (ms) */
var TOAST_DURATION_MS = 3000;

/** @type {number} Toast 淡出動畫時長 (ms) */
var TOAST_FADE_MS = 500;

/** @type {number} Resize debounce 延遲 (ms) */
var RESIZE_DEBOUNCE_MS = 500;

/** @type {number} Resize 寬度變化閾值 (px) */
var RESIZE_THRESHOLD_PX = 5;

/** @type {number} 手機斷點寬度 (px) */
var MOBILE_BREAKPOINT_PX = 768;

// ============================================================
// 地圖常數
// ============================================================

/** @type {number} 地圖預設縮放等級 */
var MAP_DEFAULT_ZOOM = 15;

/** @type {number} 專注樹木時縮放等級 */
var MAP_FOCUS_ZOOM = 18;

/** @type {number} 無座標樹木時縮放等級 */
var MAP_NO_COORDS_ZOOM = 14;

/** @type {number} 單一標記時縮放等級 */
var MAP_SINGLE_MARKER_ZOOM = 17;

// ============================================================
// GPS 常數
// ============================================================

/** @type {number} 高精度 GPS 超時 (ms) */
var GPS_HIGH_ACCURACY_TIMEOUT = 15000;

/** @type {number} 低精度 GPS 超時 (ms) */
var GPS_LOW_ACCURACY_TIMEOUT = 30000;

/** @type {number} 高精度 GPS 最大快取時長 (ms) */
var GPS_MAX_AGE_HIGH = 30000;

/** @type {number} 低精度 GPS 最大快取時長 (ms) */
var GPS_MAX_AGE_LOW = 120000;

/** @type {number} 「定位自己」GPS 超時 */
var GPS_LOCATE_ME_TIMEOUT = 12000;

// ============================================================
// 照片常數
// ============================================================

/** @type {number} 照片壓縮最大邊長 (px) */
var PHOTO_MAX_DIM = 1920;

/** @type {number} 縮圖最大邊長 (px) */
var THUMB_MAX_DIM = 300;

/** @type {number} 照片 JPEG 品質 */
var PHOTO_QUALITY = 0.8;

/** @type {number} 縮圖 JPEG 品質 */
var THUMB_QUALITY = 0.6;

// ============================================================
// 搜尋建議常數
// ============================================================

/** @type {number} 建議下拉最大顯示數 */
var SUGGEST_MAX_ITEMS = 200;

// ============================================================
// Popup 照片 Strip 常數
// ============================================================

/** @type {number} Popup 照片最大查詢數 */
var POPUP_PHOTO_LIMIT = 5;

/** @type {number} Popup Strip 顯示張數 */
var POPUP_STRIP_DISPLAY = 4;

/**
 * CDN 資源映射表
 * @type {Array<{key: string, urls: string[]}>}
 */
var CDN_LIBS = [
    { key: 'supabase', urls: [
        'https://unpkg.com/@supabase/supabase-js@2',
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
    ]},
    { key: 'xlsx', urls: [
        'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
        'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    ]},
    { key: 'leaflet', urls: [
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'
    ]},
    { key: 'heic2any', urls: [
        'https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js',
        'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js'
    ]}
];