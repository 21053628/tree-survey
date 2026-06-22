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