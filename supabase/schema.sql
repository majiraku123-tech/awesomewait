-- ============================================================
-- FestivalFlow AI — 完全データベーススキーマ
-- Supabase (PostgreSQL) + Row Level Security (RLS)
-- ============================================================
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて実行
-- ============================================================

-- ──────────────────────────────────────────────
-- 拡張機能の有効化
-- ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────
-- ユーザープロファイル
-- auth.users と 1:1 で紐付くプロファイルテーブル
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id               UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email            TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('visitor', 'staff', 'admin')),
  assigned_booth_id UUID,           -- スタッフが担当するブース（管理者は NULL）
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- イベントブース
-- 文化祭の各出し物（展示・模擬店・ステージ等）
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_booths (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,           -- 出し物名（例: お化け屋敷）
  location_x          INTEGER NOT NULL CHECK (location_x BETWEEN 0 AND 9),   -- ヒートマップ X座標（0〜9）
  location_y          INTEGER NOT NULL CHECK (location_y BETWEEN 0 AND 7),   -- ヒートマップ Y座標（0〜7）
  service_rate        NUMERIC NOT NULL CHECK (service_rate > 0),              -- μ: 処理能力（人/分）
  satisfaction_rating NUMERIC DEFAULT 4.0 CHECK (satisfaction_rating BETWEEN 0 AND 5),
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- assigned_booth_id の外部キー制約（event_booths 作成後に追加）
ALTER TABLE user_profiles
  ADD CONSTRAINT fk_user_profiles_booth
  FOREIGN KEY (assigned_booth_id) REFERENCES event_booths(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────
-- 行列スナップショット
-- スタッフが入力する現在の行列状況（リアルタイム更新の核心）
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_snapshots (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booth_id               UUID REFERENCES event_booths(id) ON DELETE CASCADE NOT NULL,
  staff_id               UUID REFERENCES user_profiles(id) ON DELETE SET NULL NOT NULL,
  current_queue_length   INTEGER NOT NULL CHECK (current_queue_length >= 0),
  predicted_wait_minutes NUMERIC NOT NULL CHECK (predicted_wait_minutes >= 0),
  arrival_rate           NUMERIC CHECK (arrival_rate >= 0),  -- λ: 到着率（人/分）
  recorded_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 最新スナップショット取得の高速化インデックス
CREATE INDEX IF NOT EXISTS idx_queue_snapshots_booth_recorded
  ON queue_snapshots (booth_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_snapshots_recorded_at
  ON queue_snapshots (recorded_at DESC);

-- ──────────────────────────────────────────────
-- 来場者数時系列ログ
-- 管理者分析用の集計データ（スループットグラフ用）
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visitor_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booth_id      UUID REFERENCES event_booths(id) ON DELETE CASCADE NOT NULL,
  visitor_count INTEGER NOT NULL CHECK (visitor_count >= 0),
  logged_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 時系列クエリの高速化インデックス
CREATE INDEX IF NOT EXISTS idx_visitor_logs_booth_logged
  ON visitor_logs (booth_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_logged_at
  ON visitor_logs (logged_at DESC);

-- ──────────────────────────────────────────────
-- RLS（Row Level Security）の有効化
-- ──────────────────────────────────────────────
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_booths     ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_logs     ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- RLSポリシー: user_profiles
-- ──────────────────────────────────────────────

-- 自分のプロフィールのみ閲覧可能
CREATE POLICY "自分のプロフィールのみ閲覧可能"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- 管理者は全プロフィールを閲覧可能
CREATE POLICY "管理者は全プロフィールを閲覧可能"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- 自分のプロフィールは自分で更新可能
CREATE POLICY "自分のプロフィールは更新可能"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- サインアップ時に自動的にプロフィールを作成（INSERT は後述のトリガーで実行）
CREATE POLICY "自分のプロフィールを作成可能"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ──────────────────────────────────────────────
-- RLSポリシー: event_booths
-- ──────────────────────────────────────────────

-- 全員がブース情報を閲覧可能（来場者向け公開情報）
CREATE POLICY "全員がブース情報を閲覧可能"
  ON event_booths FOR SELECT
  USING (TRUE);

-- 管理者のみブース情報を追加・変更・削除可能
CREATE POLICY "管理者のみブース情報を変更可能"
  ON event_booths FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "管理者のみブース情報を更新可能"
  ON event_booths FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "管理者のみブース情報を削除可能"
  ON event_booths FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- ──────────────────────────────────────────────
-- RLSポリシー: queue_snapshots
-- ──────────────────────────────────────────────

-- 全員が最新スナップショットを閲覧可能（来場者向けリアルタイム情報）
CREATE POLICY "全員が最新スナップショットを閲覧可能"
  ON queue_snapshots FOR SELECT
  USING (TRUE);

-- スタッフは担当ブースのみ、管理者は全ブースのスナップショットを追加可能
CREATE POLICY "スタッフは担当ブースのみ更新可能"
  ON queue_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('staff', 'admin')
        AND (up.assigned_booth_id = booth_id OR up.role = 'admin')
    )
  );

-- ──────────────────────────────────────────────
-- RLSポリシー: visitor_logs
-- ──────────────────────────────────────────────

-- 管理者のみ visitor_logs を操作可能
CREATE POLICY "管理者のみvisitor_logsを閲覧可能"
  ON visitor_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "管理者のみvisitor_logsを追加可能"
  ON visitor_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- ──────────────────────────────────────────────
-- トリガー: ユーザー登録時にプロフィールを自動作成
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'visitor')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ──────────────────────────────────────────────
-- ビュー: 最新スナップショット（各ブースの最新1件）
-- ──────────────────────────────────────────────

CREATE OR REPLACE VIEW latest_queue_snapshots AS
SELECT DISTINCT ON (booth_id)
  qs.id,
  qs.booth_id,
  qs.staff_id,
  qs.current_queue_length,
  qs.predicted_wait_minutes,
  qs.arrival_rate,
  qs.recorded_at,
  eb.name AS booth_name,
  eb.service_rate,
  eb.satisfaction_rating,
  eb.location_x,
  eb.location_y,
  eb.is_active
FROM queue_snapshots qs
JOIN event_booths eb ON qs.booth_id = eb.id
WHERE eb.is_active = TRUE
ORDER BY booth_id, recorded_at DESC;

-- ──────────────────────────────────────────────
-- ビュー: 時系列スループット（30分刻み集計）
-- ──────────────────────────────────────────────

CREATE OR REPLACE VIEW throughput_by_time_slot AS
SELECT
  to_char(date_trunc('hour', recorded_at) +
    INTERVAL '30 min' * FLOOR(EXTRACT(MINUTE FROM recorded_at) / 30), 'HH24:MI') AS time_slot,
  date_trunc('hour', recorded_at) +
    INTERVAL '30 min' * FLOOR(EXTRACT(MINUTE FROM recorded_at) / 30) AS slot_start,
  SUM(current_queue_length) AS total_visitors,
  AVG(predicted_wait_minutes) AS avg_wait_minutes,
  COUNT(DISTINCT booth_id) AS active_booths
FROM queue_snapshots
WHERE recorded_at >= NOW() - INTERVAL '8 hours'
GROUP BY 1, 2
ORDER BY 2;

-- ──────────────────────────────────────────────
-- シードデータ（デモ・開発用）
-- ──────────────────────────────────────────────

INSERT INTO event_booths (name, location_x, location_y, service_rate, satisfaction_rating) VALUES
  ('お化け屋敷',          2, 1, 8.0,  4.7),
  ('カフェ・サクラ',      5, 1, 12.0, 4.5),
  ('脱出ゲーム',          8, 2, 6.0,  4.8),
  ('射的ゲーム',          1, 4, 15.0, 4.2),
  ('たこ焼きブース',      4, 4, 20.0, 4.6),
  ('ダンスステージ',      7, 4, 50.0, 4.9),
  ('占いコーナー',        2, 6, 5.0,  4.3),
  ('写真スタジオ',        5, 6, 10.0, 4.7),
  ('ゲームセンター',      8, 6, 25.0, 4.1),
  ('インスタ映えブース',  4, 8, 18.0, 4.8)
ON CONFLICT DO NOTHING;

-- デモ用の初期スナップショットデータ
-- （実際の運用ではスタッフが入力するが、デモ表示のために挿入）
DO $$
DECLARE
  v_booth_id UUID;
  v_booths CURSOR FOR
    SELECT id, service_rate FROM event_booths ORDER BY created_at;
  v_queue_lengths INTEGER[] := ARRAY[15, 8, 22, 5, 31, 3, 18, 12, 7, 25];
  v_idx INTEGER := 1;
BEGIN
  FOR rec IN v_booths LOOP
    INSERT INTO queue_snapshots (
      booth_id,
      staff_id,
      current_queue_length,
      predicted_wait_minutes,
      arrival_rate,
      recorded_at
    )
    SELECT
      rec.id,
      (SELECT id FROM user_profiles WHERE role = 'admin' LIMIT 1),
      v_queue_lengths[v_idx],
      v_queue_lengths[v_idx]::NUMERIC / rec.service_rate,
      rec.service_rate * 0.75,
      NOW() - INTERVAL '2 minutes'
    WHERE EXISTS (SELECT 1 FROM user_profiles WHERE role = 'admin');

    v_idx := v_idx + 1;
  END LOOP;
END;
$$;

-- デモ用のスループット履歴データ（過去8時間分）
DO $$
DECLARE
  v_booth RECORD;
  v_hour_offset INTEGER;
  v_base_count INTEGER;
BEGIN
  FOR v_booth IN SELECT id FROM event_booths LOOP
    FOR v_hour_offset IN 0..15 LOOP
      v_base_count := FLOOR(RANDOM() * 50 + 10)::INTEGER;
      INSERT INTO visitor_logs (booth_id, visitor_count, logged_at)
      VALUES (
        v_booth.id,
        v_base_count,
        NOW() - (v_hour_offset * 30 || ' minutes')::INTERVAL
      );
    END LOOP;
  END LOOP;
END;
$$;
