# 🌳 樹木調查系統 Tree Survey Tool (v20 旗艦相片版)

這是一款專為前線樹藝師、植物學家、樹木風險評估員及景觀工程師設計的高效、輕量、深色主題（Dark Mode）無伺服器架構（Serverless）核心網頁應用程式。本專案採用高度整合的單一檔案（Single-file Application）架構，核心基於 `initial_form V20 new map.html` 開發，結合 **Supabase 雲端資料庫與存儲桶（Storage）**，實現了前線數據採集、多媒體照片記錄、智慧樹種補完、四階式漸進定位以及互動式 GIS 地圖分析的一體化工作流。

本專案由 **Terry Cheung** 開發設計。

---

## 🚀 v20 重大功能升級亮點

### 1. 📸 雲端多媒體相片管理架構 (Photo Upload & Media Framework)
新版本打破了過往單純的文字與數字框架，全面引入了完整的影像資產管理模組，解決了前線評估樹木缺陷（Observed Defects）時最核心的影像留檔需求：
* **🍏 iOS HEIC 原生兼容性**：整合 `heic2any` 解碼器，前線人員使用 iPhone/iPad 現地拍照上傳（`.heic` / `.heif` 格式）時，系統會在流動端自動在背景實時轉碼為通用高壓縮率的 `.jpg`，防止上傳失敗。
* **📐 前端雙階畫布壓縮 (Canvas-based Resizing)**：內建非同步影像縮放演算法。相片上傳前，瀏覽器會使用 Canvas 自動生成兩種規格：一組為 `1920px` 高清存檔（品質 0.8），另一組為 `300px` 的輕量縮圖，大幅優化山區弱網環境下的上傳速度，同時極致節省雲端存儲空間。
* **🗺️ 地圖快顯相片條 (Popup Photo Strip)**：Leaflet 地圖上的氣泡彈窗（Popup）全面動態化。點擊任何標記時，系統會從遠端非同步載入該樹木最新的 5 張現場照片，並以優雅的預覽條（Photo Strip）呈現，點擊即可直達相片檢視器。
* **🖼️ 旗艦級相片檢視與編輯器 (Media Viewer Matrix)**：內建全功能互動視窗（Modal），支援多圖滑動輪播（Prev/Next）、自訂相片詳細備註（Caption）、拍攝日期微調（Taken At 變更）、一鍵獨立高清下載，以及同步刪除遠端 Storage 與資料庫關聯。

### 2. 🗺️ 多源專業 GIS 底圖切換矩陣 (Multi-Layer TileMatrix)
全新封裝 `LAYER_CONFIG` 配置架構。不論是在**主專案地圖分頁**或**彈出式「地圖揀位」視窗**中，前線人員皆可無縫一鍵切換四種針對不同調查場景的專業地圖圖層：
* **🌙 Dark 模式 (Carto Dark)**：高對比深色地圖，能有效過濾都市雜訊，在戶外強光下最能清晰突顯 Good / Fair / Poor / Dead 顏色編碼的樹木健康標記。
* **🛰️ 衛星航照 (Esri Imagery)**：調用高解析度世界航照影像，前線人員可以實時比對環境地物，精確評估外觀樹冠幅（Crown Spread）與實際生長邊界。
* **⛰️ 地形等高線 (Esri Topo)**：提供世界地形等高線圖，方便山區或郊野調查員精確評估坡度、坍塌風險與微地形生長環境。
* **🏙️ 街道地圖 (OpenStreetMap)**：標準 OSM 向量街道圖，提供詳細的城鎮路名、地號及都市基礎設施資訊，便利前線尋車與確認地址。

### 3. 🔒 異步線程死鎖防護控制 (Map Sync Engine Lock)
針對從列表分頁點擊「📍 地圖」跳轉特定樹木時可能引發的 Race Condition（特別是流動端 DOM 未完全渲染時導致的地圖視角飄移、Popup 卡死 Bug），v20 重構了導航同步邏輯：
* 引入核心鎖定控制旗標（`_focusInProgress` 與 `_focusResolved`）。當定位任務啟動時會立即凍結衝突線程，強制排隊等待 Leaflet 初始化完畢，並在 setView 視角就位後，再觸發 Popup 開啟、Tooltip 高亮（Highlight）閃爍動畫以及健康圖層篩選自動解鎖。

---

## ✨ 核心基礎功能

* **🗂️ 專案與庫存矩陣**：建立無限量的樹木調查專案，主介面動態回傳與統計全案樹木總數（Total Trees）、特定專案樹木量及已配有座標之樹木總數（Mapped Count）。
* **🌿 雙向智慧樹種補完**：內建學名（Botanical Name）與中文名雙向即時過濾及自動補完機制。只要輸入部分關鍵字，系統自動連鎖填寫對應欄位，免除前線反覆翻查樹木手冊的繁瑣程序。
* **📊 專業級數據匯出**：整合 SheetJS 處理套件，提供一鍵快速匯出單一專案詳細數據表格，或一鍵產出包含所有專案彙整明細與 Summary 摘要總表的複合式多活頁 Excel (`.xlsx`) 報告書。
* **🛰️ 四階式斷網定位鏈**：一階啟動高精度流動裝置衛星定位（High Accuracy GPS Tracker）；二階自動調降為裝置低耗能大氣定位；三階網絡無縫切換至 IP-based 網絡粗略地理位置估算；四階整合全新多底圖「地圖揀位」視窗，無訊號時仍可看圖點擊配置座標。

---

## 🚀 資料庫與雲端存儲初始化設定 (`Supabase`)

為了確保 v20 旗艦相片版各模組順利運作，請前往您的 **Supabase SQL Editor** 貼上並執行以下 SQL 語句，以建立完整的關係型資料庫架構：

### 1. 智慧樹種清單對照表 (species_list)
```sql
DROP TABLE IF EXISTS species_list CASCADE;

CREATE TABLE species_list (
    id SERIAL PRIMARY KEY,
    botanical_name TEXT NOT NULL,
    chinese_name TEXT NOT NULL DEFAULT '',
    full_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 💡 提示：建表後請批次匯入您本地的樹種對照數據（~862 條），即可全面啟用前端雙向自動補完選單。
```

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

### 4. 【v20 新增】樹木調查照片關聯表 (tree_photos)
```sql
CREATE TABLE tree_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id UUID REFERENCES trees(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    thumb_path TEXT,
    caption TEXT,
    taken_at TIMESTAMPTZ DEFAULT NOW(),
    file_size INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. 【v20 新增】雲端存儲桶設定 (Supabase Storage Bucket)
請在您的 Supabase 管理後台左側選單點擊 **Storage**，並按照以下參數手動配置：
1. 點擊 **New Bucket**。
2. 命名為：`tree-photos` (必須與程式碼內 `storage.from('tree-photos')` 完全一致)。
3. 將 Bucket 權限設定為 **Public**（允許公開訪問，以便地圖和縮圖能透過 Public URL 直連渲染）。
4. *推薦添加 Policy 安全原則*：設定所有人（或 Anon 角色）擁有 `Select`、`Insert`、`Delete` 權限。

---

## 🌐 流動端權限與資安限制 (Critical Compliance)

現代流動瀏覽器（iOS Safari / Android Chrome）為了用戶隱私，設有極嚴格的硬體邊界限制：
* **HTTPS 安全通道限制**：除本機環境（`localhost`、`127.0.0.1`）外，瀏覽器規定所有透過舊式 `http://` 傳輸或 `file://` 直接雙擊開啟的網頁，將**永久強制封鎖**相機調用（`capture="environment"`）以及高精度 GPS 定位（`navigator.geolocation`）。
* **正確部署路徑**：請務必將本專案的單一 `html` 檔案部署於具備安全凭证（**HTTPS**）的發佈託管管道（如 *GitHub Pages*、*Vercel* 或 *Netlify*），才能在前線戶外調查時順利啟用相機與 GPS 硬件。

---

## 🧑‍💻 關於作者

由 **Terry Cheung** 研發設計。本專案保持零框架（Zero-framework）極致精簡效能，歡迎自由分支出原始碼、優化大容量數據矩陣、或自訂符合在地政府法規的調查基準與報告格式！
