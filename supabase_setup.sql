-- ============================================================
-- 🌳 樹木調查系統 — Supabase 資料庫安全設定
-- 使用方法：到 Supabase Dashboard → SQL Editor → 貼上此檔案全部內容 → Run
-- 可用 https://supabase.com/dashboard/project/_/sql/new
-- ============================================================

-- ============================================================
-- 第一部分：啟用 Row Level Security (RLS)
-- ============================================================

-- 啟用 projects 資料表的 RLS
ALTER TABLE IF EXISTS projects ENABLE ROW LEVEL SECURITY;

-- 啟用 trees 資料表的 RLS
ALTER TABLE IF EXISTS trees ENABLE ROW LEVEL SECURITY;

-- 啟用 species_list 資料表的 RLS（若有的話）
ALTER TABLE IF EXISTS species_list ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 第二部分：建立 tree_photos 資料表
-- ============================================================

CREATE TABLE IF NOT EXISTS tree_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id UUID NOT NULL,
    project_id UUID,
    storage_path TEXT NOT NULL,
    thumb_path TEXT,
    file_name TEXT,
    caption TEXT DEFAULT '',
    taken_at TIMESTAMPTZ,
    file_size BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 為 tree_photos 啟用 RLS
ALTER TABLE IF EXISTS tree_photos ENABLE ROW LEVEL SECURITY;

-- 索引：加速查詢特定樹木的照片
CREATE INDEX IF NOT EXISTS idx_tree_photos_tree_id ON tree_photos(tree_id);
-- 索引：加速查詢特定專案的照片
CREATE INDEX IF NOT EXISTS idx_tree_photos_project_id ON tree_photos(project_id);
-- 索引：按建立時間排序
CREATE INDEX IF NOT EXISTS idx_tree_photos_created_at ON tree_photos(created_at DESC);

-- ============================================================
-- 第三部分：建立 RLS Policies（安全政策）
-- 只允許「已登入的用戶（authenticated）」進行所有操作
-- 匿名路人（anon / public）一律拒絕存取
-- ============================================================

-- --- projects 資料表 ---

-- 已登入用戶可以讀取所有 projects
DROP POLICY IF EXISTS "Authenticated users can read projects" ON projects;
CREATE POLICY "Authenticated users can read projects"
    ON projects
    FOR SELECT
    TO authenticated
    USING (true);

-- 已登入用戶可以新增 projects
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON projects;
CREATE POLICY "Authenticated users can insert projects"
    ON projects
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 已登入用戶可以更新 projects
DROP POLICY IF EXISTS "Authenticated users can update projects" ON projects;
CREATE POLICY "Authenticated users can update projects"
    ON projects
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 已登入用戶可以刪除 projects
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON projects;
CREATE POLICY "Authenticated users can delete projects"
    ON projects
    FOR DELETE
    TO authenticated
    USING (true);

-- --- trees 資料表 ---

-- 已登入用戶可以讀取所有 trees
DROP POLICY IF EXISTS "Authenticated users can read trees" ON trees;
CREATE POLICY "Authenticated users can read trees"
    ON trees
    FOR SELECT
    TO authenticated
    USING (true);

-- 已登入用戶可以新增 trees
DROP POLICY IF EXISTS "Authenticated users can insert trees" ON trees;
CREATE POLICY "Authenticated users can insert trees"
    ON trees
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 已登入用戶可以更新 trees
DROP POLICY IF EXISTS "Authenticated users can update trees" ON trees;
CREATE POLICY "Authenticated users can update trees"
    ON trees
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 已登入用戶可以刪除 trees
DROP POLICY IF EXISTS "Authenticated users can delete trees" ON trees;
CREATE POLICY "Authenticated users can delete trees"
    ON trees
    FOR DELETE
    TO authenticated
    USING (true);

-- --- tree_photos 資料表 ---

-- 已登入用戶可以讀取所有 tree_photos
DROP POLICY IF EXISTS "Authenticated users can read tree_photos" ON tree_photos;
CREATE POLICY "Authenticated users can read tree_photos"
    ON tree_photos
    FOR SELECT
    TO authenticated
    USING (true);

-- 已登入用戶可以新增 tree_photos
DROP POLICY IF EXISTS "Authenticated users can insert tree_photos" ON tree_photos;
CREATE POLICY "Authenticated users can insert tree_photos"
    ON tree_photos
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 已登入用戶可以更新 tree_photos
DROP POLICY IF EXISTS "Authenticated users can update tree_photos" ON tree_photos;
CREATE POLICY "Authenticated users can update tree_photos"
    ON tree_photos
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 已登入用戶可以刪除 tree_photos
DROP POLICY IF EXISTS "Authenticated users can delete tree_photos" ON tree_photos;
CREATE POLICY "Authenticated users can delete tree_photos"
    ON tree_photos
    FOR DELETE
    TO authenticated
    USING (true);

-- --- species_list 資料表（唯讀，已登入用戶才可查詢）---

-- 已登入用戶可以唯讀 species_list
DROP POLICY IF EXISTS "Authenticated users can read species_list" ON species_list;
CREATE POLICY "Authenticated users can read species_list"
    ON species_list
    FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================
-- 第四部分：Storage Bucket 設定（需手動操作）
-- ============================================================

/*
 * ⚠️ 注意：Storage Bucket 無法透過 SQL 建立，請到 Supabase Dashboard 手動操作：
 *
 * 步驟 1：前往 Storage 頁面
 *   https://supabase.com/dashboard/project/_/storage/buckets
 *
 * 步驟 2：點擊「New Bucket」
 *   - Name: tree-photos
 *   - Public bucket: ✅ 勾選（讓照片公開可讀取）
 *   - File size limit: 10 MB（或根據需求調整）
 *   - Allowed MIME types: image/jpeg, image/png, image/webp, image/heic, image/heif
 *
 * 步驟 3：設定 Storage RLS Policies
 *   在 Storage → Policies 頁面，為 tree-photos bucket 新增以下 policy：
 *
 *   -- 允許已登入用戶讀取照片（SELECT）
 *   CREATE POLICY "Authenticated users can read photos"
 *       ON storage.objects
 *       FOR SELECT
 *       TO authenticated
 *       USING (bucket_id = 'tree-photos');
 *
 *   -- 允許已登入用戶上傳照片（INSERT）
 *   CREATE POLICY "Authenticated users can upload photos"
 *       ON storage.objects
 *       FOR INSERT
 *       TO authenticated
 *       WITH CHECK (bucket_id = 'tree-photos');
 *
 *   -- 允許已登入用戶刪除照片（DELETE）
 *   CREATE POLICY "Authenticated users can delete photos"
 *       ON storage.objects
 *       FOR DELETE
 *       TO authenticated
 *       USING (bucket_id = 'tree-photos');
 */

-- ============================================================
-- 第五部分：多租戶資料隔離 (Multi-Tenant Isolation)
-- ============================================================

-- 為 projects 加入 user_id 欄位
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 為 trees 加入 user_id 欄位
ALTER TABLE trees ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 為 tree_photos 加入 user_id 欄位
ALTER TABLE tree_photos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 建立索引加速 user_id 查詢
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_trees_user_id ON trees(user_id);
CREATE INDEX IF NOT EXISTS idx_tree_photos_user_id ON tree_photos(user_id);

-- 重建所有 RLS Policy，加入 user_id 過濾
-- （DROP 舊的 USING (true) 版本，重建為 user_id = auth.uid()）

-- --- projects ---
DROP POLICY IF EXISTS "Authenticated users can read projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON projects;

CREATE POLICY "Users can read own projects"
    ON projects FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own projects"
    ON projects FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- --- trees ---
DROP POLICY IF EXISTS "Authenticated users can read trees" ON trees;
DROP POLICY IF EXISTS "Authenticated users can insert trees" ON trees;
DROP POLICY IF EXISTS "Authenticated users can update trees" ON trees;
DROP POLICY IF EXISTS "Authenticated users can delete trees" ON trees;

CREATE POLICY "Users can read own trees"
    ON trees FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own trees"
    ON trees FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own trees"
    ON trees FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own trees"
    ON trees FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- --- tree_photos ---
DROP POLICY IF EXISTS "Authenticated users can read tree_photos" ON tree_photos;
DROP POLICY IF EXISTS "Authenticated users can insert tree_photos" ON tree_photos;
DROP POLICY IF EXISTS "Authenticated users can update tree_photos" ON tree_photos;
DROP POLICY IF EXISTS "Authenticated users can delete tree_photos" ON tree_photos;

CREATE POLICY "Users can read own tree_photos"
    ON tree_photos FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tree_photos"
    ON tree_photos FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tree_photos"
    ON tree_photos FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tree_photos"
    ON tree_photos FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- ============================================================
-- 第六部分：CASCADE 外鍵約束
-- ============================================================

-- 確保刪除專案時自動清除關聯的樹木和照片
ALTER TABLE trees 
  DROP CONSTRAINT IF EXISTS trees_projectid_fkey,
  ADD CONSTRAINT trees_projectid_fkey 
    FOREIGN KEY ("projectId") REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE tree_photos 
  DROP CONSTRAINT IF EXISTS tree_photos_tree_id_fkey,
  ADD CONSTRAINT tree_photos_tree_id_fkey 
    FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

-- trees 刪除時自動清除 tree_photos（進一步防護）
ALTER TABLE tree_photos 
  DROP CONSTRAINT IF EXISTS tree_photos_project_id_fkey,
  ADD CONSTRAINT tree_photos_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- ============================================================
-- 完成！
-- 執行後請回到 index.html 重新整理頁面。
-- 你需要在 Supabase Authentication 頁面手動建立員工帳號：
--   Authentication → Users → Add User → 輸入 Email 和 Password
-- 
-- ⚠️ 重要提醒：
-- 1. 舊有資料可能沒有 user_id，你可以用以下 SQL 將它們指定給特定用戶：
--    UPDATE projects SET user_id = 'your-user-uuid' WHERE user_id IS NULL;
--    UPDATE trees SET user_id = 'your-user-uuid' WHERE user_id IS NULL;
-- 2. 到 Supabase Storage 也要加 RLS policy（見第四部分註解）
-- ============================================================
