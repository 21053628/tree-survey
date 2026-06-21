# 🌳 樹木調查工具 Tree Survey Tool (v19.5)

這是一款專為前線樹藝師和樹木調查員設計的輕量、高效、深色主題（Dark Mode）網頁應用程式。本專案採用單一檔案架構，核心基於 `initial_form V19.5 map.html` 開發，讓使用者能流暢地進行專案追蹤、樹種自動補完、即時 GPS 座標擷取，並結合 Supabase 後端實現互動式地圖視覺化功能。

本專案由 **Terry Cheung** 開發設計。

---

## ✨ 核心功能

* **🗂️ 專案與庫存管理**：支援將樹木調查數據按專案分門別類，記錄專案名稱、調查日期及備註，並動態統計專案內的樹木總數。
* **🌿 智慧樹種自動完成**：內建學名（Botanical Name）與中文名雙向聯想輸入功能。從資料庫載入樹種清單後，能大幅減少前線人員在手機上打字的時間。
* **🗺️ 互動式 Leaflet 地圖檢視**：運用不同顏色的標記即時在地圖上顯示樹木位置。標記顏色對應樹木健康狀況（**Good**, **Fair**, **Poor**, **Dead**），並可在地圖畫面上直接切換篩選器。
* **🛰️ 漸進式 GPS Geolocation 定位鏈**：專為流動裝置設計的多層級定位後備機制：
    1.  *高精度衛星 GPS 追蹤*（優先嘗試）。
    2.  *低精度裝置定位*（後備方案）。
    3.  *基於 IP 的粗略地理位置查詢*（網絡後備）。
    4.  *互動式「地圖揀位」工具*（使用者可直接點擊地圖上的精確位置來手動修正座標）。
* **📥 完整 Excel 數據匯出**：整合 SheetJS 處理套件，支援一鍵匯出單一專案的樹木詳細記錄，或匯出包含所有專案摘要的完整總表。
* **📱 行動裝置優先架構（Mobile-First）**：UI 針對手機與平板進行深度優化，採用高對比度的深色系風格，確保前線人員在戶外強光下仍能清晰閱讀數據。
* **🔍 一鍵應用程式診斷**：內建一鍵診斷指令碼（Diagnosis），可即時檢查各項 CDN 套件載入狀態、資料庫連線、HTTPS 環境及權限架構。

---

## 🛠️ 技術棧

* **前端架構**：純 HTML5、CSS3 Variables（深色主題矩陣）、Vanilla JavaScript（原生 JavaScript）。
* **後端資料庫**：Supabase JavaScript Client SDK v2。
* **地圖引擎**：Leaflet.js v1.9.4，底圖採用 CARTO Dark Matter 向量圖層。
* **數據處理**：SheetJS (XLSX 試算表處理套件)。

---

## 🚀 資料庫初始化設定 (`Supabase`)

為了確保 `initial_form V19.5 map.html` 順利運作，請前往你的 **Supabase SQL Editor** 貼上並執行以下 SQL 語句，以建立專案所需的資料表（`projects`、`trees` 及 `species_list`）：

### 1. 樹種清單設定表 (Species List)
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
> 💡 *提示：建立此表後，請記得批次匯入你的樹種對照資料（約 862 條數據），即可啟用前端的智慧搜尋下拉選單。*

### 2. 專案主表設定 (Projects)
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    surveyDate DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. 樹木調查明細表 (Trees Inventory)
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

## 🌐 瀏覽器權限與資安注意事項

現代網頁瀏覽器對隱私和裝置追蹤有嚴格的限制：
* **HTTPS 必要性**：瀏覽器的安全協定規定，在未加密的 `http://` 環境下（除了 localhost），會直接封鎖 `navigator.geolocation` 定位功能。
* **雲端部署**：請務必將本專案部署於支援 **HTTPS** 的雲端平台（例如：*GitHub Pages*、*Vercel* 或 *Netlify*），以確保前線人員在使用流動裝置調查時，能正常啟動高精度衛星定位功能。

---

## 🧑‍💻 關於作者

由 **Terry Cheung** 開發設計。歡迎根據具體的樹藝法規、地區樹種清單或調查標準，自由分支出原始碼並優化資料庫欄位架構！
