# 📋 版本紀錄 (Changelog)

本文件記錄「🌳 樹木調查與智慧管理系統」自 2020 年起的所有顯著變更。
格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

---

## [v21.0] — 2026-06-15

### Added
- 全面 CSP (Content Security Policy) 強化，阻止 XSS 攻擊向量
- 登入頁面加入免責聲明及系統擁有者資訊

### Changed
- 升級 Leaflet 至 v1.9.4
- 優化移動端觸控體驗

### Security
- 強化 `connect-src` 白名單，僅允許 Supabase 域名
- 加入 `worker-src blob:` 限制

---

## [v20.0] — 2026-05-20

### Added
- GPS 定位加入 IP 地理位置最終降級機制（ipapi.co）
- 地圖揀位 Modal 支援圖層切換（Dark / 衛星 / 地形 / 街道）

### Changed
- 將所有 CDN 資源固定版本號，防止供應鏈攻擊
- 重構 `gps.js` 模組，分離權限處理與定位邏輯

### Fixed
- 修復 iOS Safari 上 `<input type="date">` 預設值格式不一致問題
- 修復斷網狀態下重複 Toast 彈出問題

---

## [v19.0] — 2026-04-12

### Added
- 地圖上樹木 Marker 支援按 Health Condition 分色顯示（Good/Fair/Poor/Dead）
- 地圖搜尋欄：可按 Tree ID 或名稱快速定位

### Changed
- 地圖圖例（Legend）重新設計，置於地圖底部
- 拍照 Button 加入 `capture="environment"` 屬性，強制開啟後鏡頭

### Fixed
- 修復多次來回切換專案列表時 Memory Leak 問題
- 修復地圖 Marker Popup 在移動端無法關閉

---

## [v18.0] — 2026-03-08

### Added
- 樹木卡片視圖（Card View）：手機版自動切換，顯示縮圖與主要資訊
- 專案卡片視圖：手機版以卡片滑動瀏覽所有專案

### Changed
- 統計卡片（Stats Grid）加入動畫過渡效果
- 優化 `ui.js` 的 RWD 斷點偵測方式（改用 `matchMedia`）

### Fixed
- 修復 Android Chrome 上 GPS 定位逾時無回調問題

---

## [v17.1] — 2026-02-18

### Fixed
- 修復 HEIC 轉換在某些 iOS 16 裝置上失敗的邊緣案例
- 修復 Excel 匯出時 DBH 欄位格式為文字而非數字的問題

---

## [v17.0] — 2026-02-01

### Added
- 照片標註工具箱（Annotation Toolbar）：支援畫紅圈、畫線、撤銷、清除、儲存標記
- 照片檢視器支援前後張導航（◀ 上一張 / 下一張 ▶）

### Changed
- 照片檢視 Modal 尺寸擴大至 90vw
- `<canvas>` 標註層覆蓋於照片之上，支援縮放同步

---

## [v16.0] — 2026-01-10

### Added
- `tree_photos` 資料表加入 `caption`（說明）與 `photo_date`（拍攝日期）欄位
- 照片說明編輯 Modal
- 照片下載功能

### Changed
- 照片網格（Photo Grid）樣式改為 3 欄等寬佈局

### Fixed
- 修復儲存樹木時未一併儲存照片說明的問題

---

## [v15.0] — 2025-12-05

### Added
- 全系統專案大總結匯出（Export All Projects to Excel）
- 單一專案樹木清單匯出（Export Project to Excel）

### Changed
- Excel 匯出改用 `xlsx` 庫在前端直接生成，無需後端參與
- 匯出按鈕加入 loading spinner

### Fixed
- 修復匯出資料時中文欄位名稱亂碼問題（加入 BOM）

---

## [v14.0] — 2025-11-15

### Added
- 照片雙軌壓縮機制：上傳時自動生成 1920px 大圖 + 300px 縮圖
- HEIC/HEIF 前端自動轉換為標準 JPEG

### Changed
- 照片上傳流程改為先壓縮後上傳，節省頻寬約 60%
- 整合 `exifr` 庫讀取 EXIF 資訊

---

## [v13.0] — 2025-10-20

### Added
- 地圖圖層切換功能：Dark / 衛星 / 地形 / 街道四種圖層
- 地圖定位自身按鈕（📍 我）

### Changed
- 地圖初始化中心點改為香港座標（22.3964, 114.1095）
- Leaflet TileLayer URL 改用多個圖源供應商

---

## [v12.0] — 2025-09-10

### Security
- 全面實施 Row Level Security (RLS) 於 `projects`、`trees`、`tree_photos` 三表
- 多租戶數據隔離：每筆資料自動綁定 `auth.uid()`
- Storage Bucket `tree-photos` 加入 RLS Objects Policies

### Changed
- Supabase Client 初始化改用 `@supabase/supabase-js` v2.x
- 移除所有前端硬編碼的測試帳號

---

## [v11.0] — 2025-08-01

### Added
- 物種建議下拉選單（Botanical Name + Chinese Name 雙欄聯動）
- 建議選單支援鍵盤上下選擇與 Enter 確認

### Changed
- 樹木表單重新編排為兩欄 Grid 佈局
- `species_list` 查詢加入本地快取（`Map`），減少重複 API 請求

---

## [v10.0] — 2025-07-05

### Added
- Supabase Auth 登入系統（Email + Password）
- 登入遮罩層（Login Overlay）：未登入前強制鎖定所有功能
- 登出按鈕

### Security
- 關閉 Supabase 自主註冊（Allow new users to sign up = Disabled）
- Anon Key 不再暴露於前端可存取範圍以外

---

## [v9.5] — 2025-06-15

### Added
- GPS 高精度定位模式（`enableHighAccuracy: true`）
- GPS 權限被拒後的引導對話框（iOS / Android 分別指引）

### Changed
- GPS 定位逾時由 10s 延長至 20s

---

## [v9.0] — 2025-05-10

### Added
- 互動式地圖揀位功能（Map Picker Modal）
- 地圖上 Click 放標記，一鍵導入經緯度

### Changed
- GPS 群組重新設計，整合「Capture GPS」與「地圖揀位」雙按鈕

---

## [v8.0] — 2025-04-02

### Added
- 照片上傳功能：支援多張照片同時上傳至 Supabase Storage
- 照片網格預覽（Photo Grid）

### Changed
- 樹木表單新增照片區塊（Photo Section）

---

## [v7.1] — 2025-03-18

### Fixed
- 修復專案刪除時未一併刪除關聯樹木的問題（CASCADE）
- 修復樹木計數在刪除後未即時更新

---

## [v7.0] — 2025-03-01

### Added
- 樹木搜尋功能（Search by Tree ID / Name）
- 專案搜尋功能（Search by Project Name）

### Changed
- 搜尋欄加入即時過濾（Debounce 300ms）

---

## [v6.0] — 2025-02-10

### Added
- 專案內地圖視圖（Map View Tab）
- 專案內列表視圖（List View Tab）
- Tab 切換 UI 元件

### Changed
- 樹木列表由純表格改為 Table + Map 雙視圖

---

## [v5.10] — 2025-01-20

### Added
- 樹木表單新增完整欄位：Crown Spread、Amenity Value、Observed Defects
- Recommendation 下拉選單加入「Further Investigation」選項

### Changed
- 表單驗證邏輯重構，改用 HTML5 Constraint Validation API

---

## [v5.9] — 2024-12-10

### Added
- 確認刪除對話框（Confirm Modal），防止誤刪
- Toast 通知系統

### Changed
- 刪除操作由直接執行改為兩步驟確認

---

## [v5.8] — 2024-11-15

### Added
- `species_list` 資料表導入約 862 條香港常見樹種
- Botanical Name / Chinese Name 雙向查詢

---

## [v5.7] — 2024-10-20

### Added
- 專案備註欄位（Notes）
- 專案編輯功能

### Changed
- 專案 Modal 加入日期選擇器

---

## [v5.6] — 2024-09-05

### Added
- 連接狀態指示器（Connection Status Indicator）
- Supabase Realtime 訂閱（初步測試）

### Changed
- Header 重新設計，加入用戶資訊與登出按鈕

---

## [v5.5] — 2024-08-01

### Added
- 分頁功能（Pagination）用於專案列表與樹木列表
- 每頁顯示 10 筆，支援頁數導航

---

## [v5.0] — 2024-07-10

### Added
- 統計儀表板：專案總數、樹木總數即時顯示
- 專案內統計：樹木數、有 GPS 座標數

### Changed
- 首頁重新設計為 Dashboard 佈局

---

## [v4.5] — 2024-06-15

### Added
- 樹木 GPS 座標欄位（Latitude / Longitude）
- 手動輸入經緯度

### Changed
- 資料庫 `trees` 表新增 `latitude`、`longitude` 欄位

---

## [v4.0] — 2024-05-20

### Added
- Leaflet 地圖整合
- 地圖上顯示所有樹木 Marker

### Changed
- 前端架構模組化：分離 `map.js`、`photos.js`、`excel.js`
- CDN 引入 Leaflet CSS/JS

---

## [v3.8] — 2024-04-10

### Added
- 樹木表單基本欄位：Tree ID、Botanical Name、Chinese Name、DBH、Height、Health、Structural、Recommendation

### Changed
- 表單由純文字輸入改為結構化 Grid 佈局

---

## [v3.5] — 2024-03-01

### Added
- 專案 CRUD（Create / Read / Update / Delete）完整實作
- 專案內樹木列表關聯顯示

---

## [v3.0] — 2024-02-14

### Changed
- **重大架構變更：由 Firebase 遷移至 Supabase**
- 資料庫由 Firestore (NoSQL) 改為 PostgreSQL (RDBMS)
- 認證由 Firebase Auth 改為 Supabase Auth

### Added
- `supabase-client.js` 模組：封裝 Supabase JS Client

---

## [v2.6] — 2024-01-20

### Changed
- Firebase Firestore 安全性規則強化
- 前端 UI 改用 CSS Variables 統一主題色

### Fixed
- 修復移動端表格橫向捲動問題

---

## [v2.5] — 2023-12-01

### Added
- 用戶認證（Firebase Auth Email/Password）
- 登入/登出流程

### Changed
- 重構 `main.js`，引入 Module Pattern

---

## [v2.4] — 2023-11-05

### Added
- 專案日期欄位
- 簡單的資料驗證（必填欄位檢查）

---

## [v2.3] — 2023-10-01

### Added
- 基本樹木資料 CRUD（Firebase Firestore）
- 專案與樹木的一對多關聯

---

## [v2.2] — 2023-09-10

### Added
- 專案（Project）概念引入：樹木歸屬於專案
- 專案列表頁面

---

## [v2.1] — 2023-08-15

### Changed
- 遷移至 Firebase Firestore 作為後端資料庫
- 移除靜態 JSON 數據檔案

---

## [v2.0] — 2023-07-20

### Added
- 初次整合 Firebase SDK（Firestore + Auth）
- 基本讀取測試

---

## [v1.12] — 2023-06-10

### Added
- 基本搜尋過濾（純前端 `Array.filter`）
- 簡易統計數字顯示

### Changed
- 改進 CSS 響應式設計，初步支援平板

---

## [v1.11] — 2023-05-05

### Added
- 表格排序功能（按 Tree ID / DBH）

### Changed
- 表格 UI 改用原生 `<table>` 取代 `<div>` 模擬

---

## [v1.10] — 2023-04-01

### Added
- 編輯樹木資訊功能
- 刪除樹木功能（含 `confirm()` 提示）

---

## [v1.9] — 2023-03-10

### Added
- 新增樹木表單（Modal 彈窗）
- 表單包含 Tree ID、Botanical Name、DBH 等基本欄位
- 基本表單驗證

---

## [v1.8] — 2023-02-15

### Added
- 樹木列表展示（從靜態 JSON 讀取）
- 基本 CSS 樣式（行動裝置優先 RWD）

### Changed
- 更換字型為系統原生字型堆疊

---

## [v1.7] — 2023-01-20

### Added
- 專案資料夾結構建立（`css/`、`js/`、`data/`）
- `index.html` 基礎骨架與導覽列
- 靜態測試資料（`data/sample_trees.json`，約 20 條記錄）

---

## [v1.6] — 2022-12-05

### Added
- 樹木資料模型初稿（Tree ID、Species、DBH、Height、Health）
- 紙本表格數碼化概念驗證

### Changed
- 決定採用純前端 Jamstack 架構

---

## [v1.5] — 2022-11-01

### Added
- 第一次客戶現場實測（香港某建築地盤）
- 收集前線調查員使用回饋

### Fixed
- 修復多個 UI 可用性問題（按鈕過小、字體難以閱讀）

---

## [v1.4] — 2022-10-10

### Added
- Leaflet 地圖初步實驗（僅顯示一個靜態 Marker）
- `map.js` 原型

---

## [v1.3] — 2022-09-05

### Added
- 研究 Supabase 作為潛在後端替代方案
- 撰寫技術評估文件（`docs/tech_evaluation.md`）

---

## [v1.2] — 2022-08-01

### Added
- Firebase Firestore 連接測試
- 基本 CRUD 原型（純 console 操作）

### Changed
- 決定使用 Firebase 作為 MVP 後端

---

## [v1.1] — 2022-07-15

### Added
- 後端方案調研：Firebase vs Supabase vs 自建 API
- 技術棧評估筆記

---

## [v1.0] — 2022-06-20

### Added
- **首個可演示的 MVP 版本**
- 純靜態 HTML + CSS + Vanilla JS
- 單頁樹木列表（硬編碼資料）
- 基本表格樣式
- 專案 README 文件

---

## [v0.12] — 2022-05-10

### Added
- 引入 CSS Flexbox 佈局
- 基本表單元件樣式庫

### Changed
- 重構所有 CSS，改用一致的 class 命名規則

---

## [v0.11] — 2022-04-05

### Added
- 多頁面導航邏輯（純前端 hash routing）
- 頁面切換動畫

---

## [v0.10] — 2022-03-15

### Added
- 行動裝置適配測試（iPhone SE / iPad / Android）
- `viewport` meta 標籤優化

### Fixed
- 修復 iOS Safari 上 100vh 滾動問題

---

## [v0.9] — 2022-02-20

### Added
- 表單驗證邏輯（純 JS）
- 錯誤訊息顯示元件

---

## [v0.8] — 2022-01-10

### Added
- 「樹木詳情」頁面原型
- 麵包屑導航元件

---

## [v0.7] — 2021-12-01

### Added
- 內聯 SVG 圖標系統
- UI 元件庫初版（按鈕、卡片、Modal 框架）

---

## [v0.6] — 2021-11-05

### Added
- 鍵盤快捷鍵支援（初步）
- `accesskey` 屬性加入主要按鈕

---

## [v0.5] — 2021-10-10

### Added
- 暗色模式 CSS 變數實驗
- 基本無障礙（a11y）審查

---

## [v0.4] — 2021-09-01

### Added
- LocalStorage 資料持久化實驗
- 離線模式概念驗證

---

## [v0.3] — 2021-08-15

### Added
- 靜態 JSON 資料架構設計
- 樹木資料結構 Schema 初稿

---

## [v0.2] — 2021-07-20

### Added
- `utils.js` 工具函式庫
- DOM 操作輔助函式

### Changed
- JavaScript 程式碼由內聯 `<script>` 遷移至外部 `.js` 檔案

---

## [v0.1] — 2021-06-01

### Added
- 專案初始化
- 單一 `index.html` 檔案，內含嵌入式 CSS 與 JS
- 手繪 Wireframe 掃描檔（`docs/wireframes/`）
- 需求訪談記錄（與 Terry Cheung 初次會議）

---

## [v0.0.12] — 2021-05-03

### Added
- 技術可行性評估報告（`docs/feasibility_report.pdf`）
- 初步系統架構圖（手繪）

### Changed
- 確認技術棧：HTML + CSS + Vanilla JS，不採用前端框架

---

## [v0.0.11] — 2021-04-01

### Added
- 競爭產品分析（市場上現有樹木管理軟件比較）
- 功能需求清單 v1.0

### Changed
- 由「原生 App」方案轉向「PWA 網頁 App」方案

---

## [v0.0.10] — 2021-03-08

### Added
- 第一次利害關係人簡報會議
- 初步功能 Scope 文檔

### Changed
- 縮減 MVP 範圍至核心功能：樹木 CRUD + 基本列表

---

## [v0.0.9] — 2021-02-01

### Added
- 調查員工作流程訪談（3 位前線樹木調查員）
- 紙本調查表格樣本收集（共 5 款不同格式）

### Changed
- 根據訪談結果修訂 UI 概念設計

---

## [v0.0.8] — 2021-01-04

### Added
- 項目啟動會議紀要
- 初步項目時程表（預計 18 個月內交付 MVP）

---

## [v0.0.7] — 2020-12-01

### Added
- 技術調研：GPS 定位網頁 API 可行性測試
- 簡單的 `navigator.geolocation` 原型

### Changed
- 確認目標平台：以流動裝置（手機/平板）為主力

---

## [v0.0.6] — 2020-11-02

### Added
- 數據庫方案初步比較（Firebase vs Supabase vs MongoDB Atlas）
- 成本估算試算表

---

## [v0.0.5] — 2020-10-05

### Added
- 地圖整合技術調研（Google Maps vs Leaflet vs Mapbox）
- 初步選擇 Leaflet（開源、輕量）

---

## [v0.0.4] — 2020-09-01

### Added
- 用戶故事（User Stories）撰寫（共 12 條）
- 角色定義：系統管理員、調查員、審查員

---

## [v0.0.3] — 2020-08-03

### Added
- 與 Terry Cheung 初步概念討論
- 專案代號定為「TreeProject」

### Changed
- 由「園藝管理系統」更聚焦為「樹木調查系統」

---

## [v0.0.2] — 2020-07-06

### Added
- 香港樹木保育法規研究筆記
- 業界標準參考（ISA 樹木風險評估表格）

---

## [v0.0.1] — 2020-06-01

### Added
- 概念發想：建築地盤樹木數碼化管理的需求
- 初步市場調查（香港建築業樹木調查流程）
- 第一次非正式團隊討論

---

## [v0.0.0] — 2020-01-15

### Added
- 專案概念萌芽
- Terry Cheung 提出初步構想：將紙本樹木調查流程數碼化
- 初始想法筆記（手寫）

---

> 📝 **備註**
> - **v0.0.0 至 v0.0.12**（2020–2021）為概念發想與調研階段。
> - **v0.1 至 v0.12**（2021–2022）為概念驗證與原型階段，使用純靜態 HTML/CSS/JS。
> - **v1.0 至 v2.6**（2022–2024）為 Firebase 時代，逐步建立完整功能。
> - **v3.0**（2024-02）起全面遷移至 Supabase，奠定企業級安全架構基礎。
> - 目前最新穩定版為 **v21.0**（2026-06-15）。
> - 本系統由 **Terry Cheung (60524440)** 主導開發。
