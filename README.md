# 🌳 樹木調查工具 Tree Survey Tool (v20)

這是一款專為前線樹藝師、攀樹師及樹木調查員設計的高效、輕量、深色主題（Dark Mode）無伺服器架構網頁應用程式。本專案採用高度整合的單一檔案架構，核心基於 `initial_form V20 new map.html` 開發，結合 **Supabase 雲端資料庫**，實現流暢的專案庫存管理、智慧樹種聯想輸入、四階式漸進 GPS 座標擷取，以及強大的互動式多底圖視覺化分析功能。

本專案由 **Terry Cheung** 開發設計。

---

## 🚀 v20 全新升級亮點

* 🔮 **動態多底圖切換系統 (Multi-Layer Basemaps)**：
  全新引入 `LAYER_CONFIG` 圖層管理架構。不論是在**主專案地圖檢視**或**彈出式「地圖揀位」視窗**中，前線人員皆可一鍵無縫切換四種專業地圖：
  * 🌙 **Dark 模式**：採用 CARTO 高對比深色地圖，適合戶外高強光下突顯健康狀況標記。
  * 🛰️ **衛星模式**：採用 Esri 高解析度世界航照影像，協助精確比對樹冠（Crown Spread）與現場實際地物。
  * 🗺️ **地形模式**：採用 Esri 世界地形等高線圖，方便評估樹木生長的坡度與微地形環境。
  * 🏙️ **街道模式**：採用 OpenStreetMap 街道圖，提供前線定位所需的詳細路名與都市基礎設施資訊。
* ⚡ **地圖同步效能優化 (Map Sync Optimizations)**：
  重構了「列表 ➔ 地圖」的導航邏輯，引入全新的連鎖狀態旗標群（`_focusInProgress` 與 `_focusResolved`），徹底解決舊版本在慢速流動裝置上因非同步載入地圖、DOM 未渲染完成所導致的 Popup 彈出動畫衝突與視角飄移（Race Condition）問題。

---

## ✨ 核心功能

* **🗂️ 專案與庫存管理**：動態分類追蹤不同調查案件，即時回傳與統計全案樹木總數（Total Trees）、專案樹木量及已完成座標標記之樹木（Mapped Count）。
* **🌿 雙向智慧樹種 autocomplete**：內建學名（Botanical Name）與中文名雙向即時過濾及自動補完機制。只要輸入部分關鍵字，系統即自動填寫對應欄位，大幅減少前線手打打字時間。
* **🗺️ 互動式顏色編碼標記**：地圖上所有樹木標記均根據健康狀況（**Good**, **Fair**, **Poor**, **Dead**）進行嚴格的顏色編碼，並支援動態篩選器（Filter Toggles），可單獨隱藏或顯示特定健康指標的樹木。
* **🛰️ 四階式漸進 GPS 定位鏈**：
  1. *一階優先*：啟動高精度流動裝置衛星定位（High Accuracy GPS Tracker）。
  2. *二階後備*：若訊號不佳，自動調降為裝置低耗能大氣定位。
  3. *三階網絡*：若硬體無回應，自動無縫切換至 IP-based 網絡粗略地理位置估算。
  4. *四階手動*：整合「地圖揀位」視窗，配合全新 v20 衛星圖層，可在地圖上直接點擊，手動配置微調座標。
* **📥 跨專案數據矩陣匯出**：整合進階 SheetJS 處理套件，提供一鍵快速匯出單一專案詳細數據表格，或一鍵產出包含所有專案彙整明細與 Summary 摘要總表的複合式分頁 Excel (`.xlsx`) 活頁簿。
* **📱 流動裝置優先與單鍵診斷**：完全針對 field tablet 與流動電話進行 RWD 響應式佈局優化。內建一鍵系統診斷選單（Diagnosis Matrix），可即時調閱、檢查 CDN 快取、Supabase API 連線狀況與 HTTPS 權限邊界。

---

## 🛠️ 技術棧

* **前端核心**：純原生 HTML5、CSS3 Variables（深色高對比度 UI 矩陣）、Vanilla JavaScript（無第三方肥大框架依賴）。
* **後端架構**：Supabase JavaScript Client SDK v2 (PostgreSQL 即時雲端引擎)。
* **地圖視覺化**：Leaflet.js v1.9.4（底圖經由 CARTO & Esri ArcGIS Rest Pipeline 提供）。
* **數據分析處置**：SheetJS (XLSX 核心引擎)。

---

## 🚀 資料庫初始化設定 (`Supabase`)

為了確保 `initial_form V20 new map.html` 順利運作，請前往您的 **Supabase SQL Editor** 貼上並執行以下 SQL 語句，以建立專案所需的資料表結構：

### 1. 樹種清單對照表 (species_list)
```sql
DROP TABLE IF EXISTS species_list CASCADE;

CREATE TABLE species_list (
    id SERIAL PRIMARY KEY,
    botanical_name TEXT NOT NULL,
    chinese_name TEXT NOT NULL DEFAULT '',
    full_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
> 💡 *提示：建表後請批次匯入您本地的樹種對照數據（~862 條），即可全面啟用前端雙向智慧自動完成下拉選單。*

### 2. 專案主表 (projects)
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    surveyDate DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. 樹木調查庫存明細表 (trees)
```sql
CREATE TABLE trees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projectId UUID REFERENCES projects(id) ON DELETE CASCADE,
    treeIdNo TEXT NOT NULL,
    botanicalName TEXT,
    chineseName TEXT,
    trunkDiameter NUMERIC,
    overallHeight NUMERIC,
    crownSpread NUMERIC,
    healthCondition TEXT,
    structuralCondition TEXT,
    amenityValue TEXT,
    observedDefects TEXT,
    recommendation TEXT,
    remarks TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    syncStatus TEXT DEFAULT 'local',
    updatedAt TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🌐 瀏覽器安全性與 Geolocation 規範

根據現代網頁瀏覽器（iOS Safari / Android Chrome）的最高安全權限矩陣：
* **HTTPS 傳輸協定強制性**：除了本地端（`localhost`、`127.0.0.1`）以外，所有利用舊式 `http://` 傳輸或 `file://` 直接開檔的網頁，瀏覽器一律會強制封鎖 `navigator.geolocation` API。
* **部署方案**：請務必將本專案的 `html` 原始碼部署於具備安全憑證（**HTTPS**）的發佈 pipeline（如 *GitHub Pages*、*Vercel* 或 *Netlify*），以確保前線流動端在現場調查時能順利呼叫高精度 GPS 模組。

---

## 🧑‍💻 關於作者

由 **Terry Cheung** 研發設計。歡迎根據不同國家、地區的樹藝法規、特定樹種保育清單或特定的 arborist 調查標準，自由分支出原始碼並優化資料表欄位架構！
