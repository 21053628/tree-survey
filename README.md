# 🌳 樹木調查與智慧管理系統 (Tree Survey & Management System) — v22.0

這是一套專為建築地盤環境與專業樹木調查（Tree Survey）設計的輕量化、高安全性 **Jamstack 前後端分離網頁系統**。前端採用響應式（Mobile-First）架構設計，方便前線調查員在戶外使用流動裝置即時記錄；後端完全整合 **Supabase 雲端架構**，具備企業級的身份驗證、行級安全防禦（RLS）以及多租戶數據隔離機制。

---

## 🛡️ 核心資安與架構亮點 (Security & Architecture)

本系統已通過安全性硬化與優化，專為企業內部營運與合規審查（Compliance）量身打造，具備以下軍事級安全機制：

* **🔐 企業級身份驗證 (Supabase Auth)：** 系統全面實施門禁機制，未登入前會強制鎖定。前端不留任何帳密痕跡，完全杜絕匿名登入與未授權存取。
* **🚧 資料列級安全性防禦 (Row Level Security, RLS)：** 資料庫大門全面關閉。縱使前端 API 金鑰（Anon Key）不慎外洩，未經認證的請求將直接被 Supabase 伺服器拒絕，無法讀取或竄改任何欄位。
* **👥 多租戶數據隔離 (Multi-Tenant Isolation)：** 深度整合 `auth.uid()` 機制。系統會自動在 `projects`、`trees` 與 `tree_photos` 資料表中綁定 `user_id`。**每位調查員登入後只能存取與修改自己建立的專案與樹木數據**，完美保障商業機密。
* **🔒 相片儲存安全箱 (Secure Storage Bucket)：** 相片存儲庫實施 RLS Objects Policies。只有已認證員工能夠執行照片上傳（INSERT）與刪除（DELETE），防止雲端儲存空間遭惡意爆破或盜用。
* **🛡️ 內容安全政策 (Content Security Policy, CSP)：** 全面實施 CSP 標頭，精細控制 `script-src`、`connect-src` 與 `worker-src` 白名單，有效阻止 XSS 攻擊向量與供應鏈污染。
* **⚠️ 登入免責聲明：** 登入頁面包含法律免責聲明及系統擁有者資訊，明確告知未經授權存取之法律後果。
* **🚨 EXIF GPS 防偽雷達：** 從照片 EXIF 提取 GPS 座標，與樹木記錄座標進行 Haversine 比對（閾值 50m），自動標記疑似非現場照片（`is_spoofed`）。
* **🔄 DB-First 交易安全：** 照片上傳採用「先寫 DB → 再上傳 Storage → 失敗 Rollback DB」模式，防止孤兒雲端檔案。

---

## ✨ 核心功能 (Core Features)

### 1. 🖥️ 地盤流動優化介面 (Mobile-Responsive Dashboard)
* 支援 RWD 響應式介面，自動判別裝置：電腦版顯示完整專業數據報表（Table View），手機版自動切換為卡片式滑動介面（Card View），極度適合前線地盤作業。
* 統計儀表板即時顯示專案總數、樹木總數，卡片加入動畫過渡效果。

### 2. 🗺️ 智慧型 GPS 定位鏈與地圖揀位
* **高精度 GPS 鏈結：** 具備三級自動降級防錯機制（高精度 Hardware GPS ➔ 網絡低精度 ➔ IP 地理位置定位 ipapi.co），確保在郊區或密網地盤收訊差時仍能獲取座標。
* **互動式地圖揀位：** 調查員可直接在 Leaflet 地圖上點擊位置放針（Pin），一鍵精確導入座標，免去手動輸入的繁瑣。地圖揀位 Modal 支援 Dark / 衛星 / 地形 / 街道四種圖層切換。

### 3. 🗺️ 地圖視圖與健康狀態篩選系統
* **分色 Marker：** 樹木 Marker 按 Health Condition 自動分色顯示（Good🟢 / Fair🟡 / Poor🟠 / Dead🔴），一目了然。
* **地圖搜尋欄：** 支援按 Tree ID 或名稱快速定位樹木。
* **健康狀態過濾開關：** 可獨立開關 Good / Fair / Poor / Dead 四種狀態的顯示。
* **多圖層切換：** 支援 Dark / 衛星 / 地形 / 街道四種底圖，附「📍 我」定位自身按鈕。
* **Tab 雙視圖：** 專案頁面支援 📋 列表 / 🗺️ 地圖 雙視圖切換。

### 4. 🌿 物種智慧建議選單
* **雙欄聯動：** Botanical Name（學名）與 Chinese Name（中文名）雙向查詢與自動填充。
* **鍵盤導航：** 建議下拉選單支援鍵盤上下選擇與 Enter 確認。
* **本地快取：** `species_list` 查詢結果加入 `Map` 快取，減少重複 API 請求（約 862 條香港常見樹種）。

### 5. 📸 相片智能上傳與標註工具箱 (支援 HEIC)
* **HEIC 原生轉換：** 調查員使用 iPhone 拍照時，系統會自動在前端將 `.heic` / `.heif` 轉換為標準 `.jpg` 格式。
* **前端智能雙軌壓縮：** 檔案上傳前，會自動壓縮成 `1920px` 高清大圖與 `300px` 輕量縮圖，大幅節省流動網路頻寬與雲端儲存空間。
* **並行上傳 + 進度追蹤：** Worker Pool（並行上限 4），即時顯示上傳進度。
* **照片標註工具箱：** 支援畫紅圈（⭕）、畫線（📏）、撤銷（↩️）、清除（🗑️）、儲存標記（💾），標註數據以歸一化座標儲存，不受圖片縮放影響。
* **前後張導航：** 照片檢視器支援 ◀ 上一張 / 下一張 ▶ 瀏覽。
* **照片管理：** 支援說明（Caption）編輯、拍攝日期記錄、照片下載與刪除。
* **🚨 防偽紅旗：** 樹木列表與照片縮圖顯示 🚨 紅旗圖示，照片檢視器內紅色 Spooff Banner，醒目警示。

### 6. 📊 數據智能匯出 (Excel Reporting)
* 全自動產生格式化報表，支援「單一專案樹木清單匯出」與「全系統專案大總結匯出」。
* 使用 `xlsx` 庫在前端直接生成 `.xlsx` 檔案，無需後端參與，中文欄位自動加入 BOM 防止亂碼。

### 7. 🔍 搜尋、分頁與確認機制
* **即時搜尋：** 專案列表與樹木列表皆支援關鍵字即時過濾（Debounce 300ms）。
* **分頁導航：** 每頁顯示 30 筆，支援頁數導航。
* **確認刪除對話框：** 刪除操作需經兩步驟確認（Confirm Modal），防止誤刪。
* **Toast 通知系統：** 操作結果即時彈出通知。

### 8. 📋 完整樹木調查欄位
* Tree ID、Botanical Name、Chinese Name、DBH (mm)、Height (m)、Crown Spread (m)
* Health Condition（Good / Fair / Poor / Dead）
* Structural Condition（Good / Fair / Poor / Hazardous）
* Amenity Value（High / Medium / Low）
* Observed Defects、Recommendation（Retain / Fell / Transplant / Prune / Monitor / Further Investigation）
* Remarks、GPS Coordinates（Latitude / Longitude）

---

## 🧱 技術架構 (Tech Stack)

| 層級 | 技術 |
|------|------|
| **前端框架** | Vanilla JS (ES6+ Modules) |
| **地圖** | Leaflet v1.9.4 (OpenStreetMap / CartoDB / ESRI 多圖源) |
| **後端 BaaS** | Supabase (PostgreSQL + Auth + Storage + RLS) |
| **Excel 匯出** | SheetJS (xlsx) |
| **圖片處理** | HTML5 Canvas + exifr (EXIF 讀取) + heic2any (HEIC 轉換) |
| **CDN** | unpkg / jsDelivr (所有資源固定版本號) |
| **安全** | CSP 標頭、Supabase RLS、多租戶 `auth.uid()` 隔離、EXIF GPS 防偽比對 |

### JS 模組架構

| 模組 | 職責 |
|------|------|
| `main.js` | CDN 資源動態載入、應用程式初始化、集中式事件委派 |
| `treeapp.js` | TreeApp 集中式命名空間，消除全域函數污染 |
| `config.js` | Supabase URL / Anon Key 配置、所有系統常數 |
| `supabase-client.js` | Supabase JS Client 封裝、錯誤處理 |
| `auth.js` | 登入/登出、Session 管理、Login Overlay |
| `state.js` | 全域狀態管理（當前專案、樹木分頁、地圖狀態） |
| `projects.js` | 專案 CRUD、列表渲染、卡片視圖 |
| `trees.js` | 樹木 CRUD、表單管理、表格/卡片渲染、Spoof 紅旗顯示 |
| `species.js` | 物種建議下拉選單、雙欄聯動 |
| `map.js` | Leaflet 地圖渲染、Marker 分色、圖層切換、地圖搜尋 |
| `gps.js` | GPS 三級定位、地圖揀位 Modal、圖層切換 |
| `photos.js` | 照片上傳/壓縮/HEIC轉換、EXIF GPS 防偽比對、標註工具箱、照片檢視器 |
| `excel.js` | Excel 報表匯出 |
| `ui.js` | Toast 通知、Modal 控制、視圖切換、連線狀態 |
| `dom.js` | DOM 輔助函式（建立元素、Badge 元件） |
| `utils.js` | 通用工具函式（UUID、日期、RWD 偵測、快取、分頁擷取） |

---

## 👤 系統擁有者

本系統由 **Terry Cheung (60524440)** 主導開發與維護。

> ⚠️ **免責聲明：** 此系統僅供授權人員使用。所有資料屬機密資訊，未經授權不得複製、分發或披露。系統內資料僅供參考，不構成任何法律或專業建議。未經授權之存取將被追究法律責任。

---

## 🛠️ 部署與環境架設指南 (Deployment Guide)

### 步驟 1：後端資料庫配置 (Supabase SQL Editor)
1. 登入 [Supabase Dashboard](https://supabase.com/) 並進入你的專案。
2. 點擊左側導覽列的 **SQL Editor** ➔ **New query**。
3. 將本專案中的 `supabase_setup.sql` 檔案內容完整複製並貼入編輯器中。
4. 點擊右下角的 **Run** 按鈕。這將會完成 RLS 牆的建立、照片資料表起建以及多租戶安全政策的注入。

### 步驟 2：匯入物種清單資料 (species_list)
1. 前往 Supabase ➔ **SQL Editor** ➔ **New query**。
2. 建立 `species_list` 資料表：
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
3. 分批貼入物種 INSERT 語句（約 862 條香港常見樹種）。完成後樹木表單的 Botanical Name / Chinese Name 建議下拉選單即可正常使用。

### 步驟 3：關閉自主註冊（企業安全關鍵）
為防止外人自行註冊帳號進入系統，必須關閉控制台的註冊後門：
1. 前往 Supabase ➔ **Authentication** ➔ **Auth Providers**。
2. 展開 **Email** 設定欄位。
3. **關閉（Disable）"Allow new users to sign up"** 選項並儲存。

### 步驟 4：建立員工調查員帳號
1. 前往 Supabase ➔ **Authentication** ➔ **Users**。
2. 點擊 **Add user** ➔ **Create user**。
3. 手動輸入指定員工/調查員的 **Email** 與 **Password**，點擊儲存即可。

### 步驟 5：設定雲端相片儲存箱 (Storage)
1. 前往 Supabase ➔ **Storage** ➔ 點擊 **New Bucket**。
2. 將 Bucket 命名為：`tree-photos`（大小寫需完全一致）。
3. 根據 `supabase_setup.sql` **第五部分**註解所述，進入該 Bucket 的 **Policies** 頁面，為 `storage.objects` 資料表允許 `authenticated` 用戶進行 `SELECT`、`INSERT` 和 `DELETE` 操作。

### 步驟 6：前端配置與上線 (Frontend Config)
1. 打開 `js/config.js`，修改以下設定值：
   ```javascript
   const SUPABASE_URL = '你的_SUPABASE_專案_URL';
   const SUPABASE_ANON_KEY = '你的_SUPABASE_ANON_KEY';
   ```
2. 將整個專案資料夾部署到你慣用的靜態託管平台（如 GitHub Pages、Netlify、Vercel），或直接用 `npx serve` 在本機測試。
3. 確保部署環境使用 **HTTPS**（localhost 除外），否則 GPS 定位功能會被瀏覽器封鎖。

---

## 📋 版本紀錄

詳細版本變更請參閱 [`CHANGELOG.md`](./CHANGELOG.md)。目前最新穩定版為 **v22.0**（2026-06-24）。

> © 2020–2026 Terry Cheung (60524440). All rights reserved.