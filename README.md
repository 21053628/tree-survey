# 🌳 樹木調查與智慧管理系統 (Tree Survey & Management System)

這是一套專為建築地盤環境與專業樹木調查（Tree Survey）設計的輕量化、高安全性 **Jamstack 前後端分離網頁系統**。前端採用響應式（Mobile-First）架構設計，方便前線調查員在戶外使用流動裝置即時記錄；後端完全整合 **Supabase 雲端架構**，具備企業級的身份驗證、行級安全防禦（RLS）以及多租戶數據隔離機制。

---

## 🛡️ 核心資安與架構亮點 (Security & Architecture)

本系統已通過安全性硬化與優化，專為企業內部營運與合規審查（Compliance）量身打造，具備以下軍事級安全機制：

* **🔐 企業級身份驗證 (Supabase Auth)：** 系統全面實施門禁機制，未登入前會強制鎖定。前端不留任何帳密痕跡，完全杜絕匿名登入與未授權存取。
* **🚧 資料列級安全性防禦 (Row Level Security, RLS)：** 資料庫大門全面關閉。縱使前端 API 金鑰（Anon Key）不慎外洩，未經認證的請求將直接被 Supabase 伺服器拒絕，無法讀取或竄改任何欄位。
* **👥 多租戶數據隔離 (Multi-Tenant Isolation)：** 深度整合 `auth.uid()` 機制。系統會自動在 `projects`、`trees` 與 `tree_photos` 資料表中綁定 `user_id`。**每位調查員登入後只能存取與修改自己建立的專案與樹木數據**，完美保障商業機密。
* **🔒 相片儲存安全箱 (Secure Storage Bucket)：** 相片存儲庫實施 RLS Objects Policies。只有已認證員工能夠執行照片上傳（INSERT）與刪除（DELETE），防止雲端儲存空間遭惡意爆破或盜用。

---

## ✨ 核心功能 (Core Features)

### 1. 地盤流動優化介面 (Mobile-Responsive Dashboard)
* 支援 RWD 響應式介面，自動判別裝置：電腦版顯示完整專業數據報表（Table View），手機版自動切換為卡片式滑動介面（Card View），極度適合前線地盤作業。

### 2. 智慧型 GPS 定位鏈與地圖揀位
* **高精度 GPS 鏈結：** 具備自動降級防錯機制（高精度 Hardware GPS ➔ 網絡低精度 ➔ IP 地理位置定位），確保在郊區或密網地盤收訊差時仍能獲取座標。
* **互動式地圖揀位：** 調查員可直接在 Leaflet 地圖上點擊位置放針（Pin），一鍵精確導入座標，免去手動輸入的繁瑣。

### 3. 相片智能上傳與自動壓縮 (支援 HEIC)
* **HEIC 原生轉換：** 調查員使用 iPhone 拍照時，系統會自動在前端將 `.heic` / `.heif` 轉換為標準 `.jpg` 格式。
* **前端智能雙軌壓縮：** 檔案上傳前，會自動壓縮成 `1920px` 高清大圖與 `300px` 輕量縮圖，大幅節省流動網路頻寬與雲端儲存空間。

### 4. 數據智能匯出 (Excel Reporting)
* 全自動產生格式化報表，支援「單一專案樹木清單匯出」與「全系統專案大總結匯出」，一鍵產出符合工程部與客戶審查標準的 `.xlsx` 檔案。

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
3. 分批貼入物種 INSERT 語句（約 862 條）。完成後樹木表單的 Botanical Name / Chinese Name 建議下拉選單即可正常使用。

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