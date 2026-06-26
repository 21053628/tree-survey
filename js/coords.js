/**
 * 🌳 樹木調查系統 — 座標轉換模組 (WGS84 ↔ HK1980)
 * @module coords
 *
 * 使用 proj4 進行雙向座標轉換。
 * 依賴：proj4 (從 CDN 載入)
 */

// ============================================================
// HK1980 投影定義 (EPSG:2326)
// ============================================================

/** @type {string} Proj4 定義字串 */
const HK1980_PROJ4 = '+proj=tmerc +lat_0=22.3121333 +lon_0=114.1785556 +k=1 +x_0=836694.05 +y_0=819069.80 +ellps=intl +towgs84=-162.619,-276.959,-161.764,0.067753,-2.24365,-1.15883,-1.09425 +units=m +no_defs';

// ============================================================
// proj4 可用性檢查
// ============================================================

/**
 * proj4 是否已載入
 * @returns {boolean}
 */
function proj4Ready() {
    return !!(window.proj4 && typeof window.proj4 === 'function');
}

// ============================================================
// 座標轉換函數
// ============================================================

/**
 * WGS84 → HK1980 (EPSG:2326)
 * @param {number} lat - 緯度 (WGS84)
 * @param {number} lng - 經度 (WGS84)
 * @returns {{easting: number, northing: number}|null} HK1980 座標（公尺），若 proj4 未載入回傳 null
 */
function wgs84ToHK1980(lat, lng) {
    if (!proj4Ready()) return null;
    try {
        const result = proj4('EPSG:4326', HK1980_PROJ4, [lng, lat]);
        return {
            easting: Math.round(result[0] * 1000) / 1000,
            northing: Math.round(result[1] * 1000) / 1000
        };
    } catch (e) {
        console.warn('wgs84ToHK1980 error:', e.message);
        return null;
    }
}

/**
 * HK1980 (EPSG:2326) → WGS84
 * @param {number} easting - 東向座標（公尺）
 * @param {number} northing - 北向座標（公尺）
 * @returns {{lat: number, lng: number}|null} WGS84 座標，若 proj4 未載入回傳 null
 */
function hk1980ToWGS84(easting, northing) {
    if (!proj4Ready()) return null;
    try {
        const result = proj4(HK1980_PROJ4, 'EPSG:4326', [easting, northing]);
        return {
            lng: Math.round(result[0] * 10000000) / 10000000,
            lat: Math.round(result[1] * 10000000) / 10000000
        };
    } catch (e) {
        console.warn('hk1980ToWGS84 error:', e.message);
        return null;
    }
}

/**
 * 根據目前座標欄位內容自動判斷模式並轉換
 * 若 lat/lng 欄位有值 → 從 WGS84 計算 HK1980
 * 若 easting/northing 欄位有值 → 從 HK1980 計算 WGS84
 * @returns {{lat: number, lng: number, easting: number, northing: number}|null}
 */
function syncCoords() {
    const latVal = parseFloat(document.getElementById('tree_latitude').value);
    const lngVal = parseFloat(document.getElementById('tree_longitude').value);
    const eVal = parseFloat(document.getElementById('tree_easting').value);
    const nVal = parseFloat(document.getElementById('tree_northing').value);

    // 優先從 WGS84 計算 HK1980
    if (!isNaN(latVal) && !isNaN(lngVal)) {
        const hk = wgs84ToHK1980(latVal, lngVal);
        if (hk) {
            document.getElementById('tree_easting').value = hk.easting;
            document.getElementById('tree_northing').value = hk.northing;
        }
        return { lat: latVal, lng: lngVal, easting: hk ? hk.easting : null, northing: hk ? hk.northing : null };
    }

    // 否則從 HK1980 計算 WGS84
    if (!isNaN(eVal) && !isNaN(nVal)) {
        const wgs = hk1980ToWGS84(eVal, nVal);
        if (wgs) {
            document.getElementById('tree_latitude').value = wgs.lat;
            document.getElementById('tree_longitude').value = wgs.lng;
        }
        return { lat: wgs ? wgs.lat : null, lng: wgs ? wgs.lng : null, easting: eVal, northing: nVal };
    }

    return null;
}

// ============================================================
// Export to TreeApp namespace
// ============================================================
TreeApp.coords = {
    proj4Ready: proj4Ready,
    wgs84ToHK1980: wgs84ToHK1980,
    hk1980ToWGS84: hk1980ToWGS84,
    syncCoords: syncCoords
};