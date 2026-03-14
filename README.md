# FestivalFlow AI — 文化祭フロー AI

> 文化祭の混雑をリアルタイムで管理する、AI予測搭載のクラウドプラットフォーム

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com)

---

## 📋 概要

FestivalFlow AI は、日本の高校文化祭（学園祭）における来場者の混雑を効率的に管理するエンタープライズグレードのWebアプリケーションです。

### 主な機能

| 機能 | 説明 |
|------|------|
| **リアルタイム待ち時間** | Supabase Realtime により各ブースの待ち時間を即時反映 |
| **AI予測** | Little's Law + M/M/1 待ち行列理論による精度の高い予測 |
| **スマートレコメンデーション** | ロードバランシングアルゴリズムで「穴場ブース」を提案 |
| **ヒートマップ** | SVGグリッドで校内の混雑分布をリアルタイム可視化 |
| **スループット分析** | Recharts による時系列グラフで来場者の流れを分析 |
| **エンターテイメント** | 待ち時間中に大谷翔平・K-POPクイズを表示 |
| **RBAC** | 来場者・スタッフ・管理者の3段階ロール管理 |

---

## 🚀 ローカル起動手順

### 前提条件

- Node.js 18.17 以上
- npm 9.x 以上
- Supabase アカウント（[無料プランで可](https://supabase.com)）

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/festivalflow-ai.git
cd festivalflow-ai
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集し、Supabase の認証情報を入力：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

---

## 🗄️ Supabase セットアップ手順

### 1. プロジェクト作成

1. [Supabase ダッシュボード](https://app.supabase.com) にアクセス
2. 「New Project」をクリック
3. プロジェクト名・パスワード・リージョン（Northeast Asia - Tokyo）を設定

### 2. データベーススキーマの適用

1. ダッシュボード左メニュー → **SQL Editor**
2. `supabase/schema.sql` の内容を貼り付け
3. 「Run」ボタンをクリック

> ⚠️ スキーマには以下が含まれます:
> - テーブル定義（4テーブル）
> - RLSポリシー（全テーブル）
> - トリガー（ユーザー登録時プロフィール自動作成）
> - ビュー（最新スナップショット・スループット集計）
> - シードデータ（10ブース + デモデータ）

### 3. Realtime の有効化

1. ダッシュボード → **Database** → **Replication**
2. `queue_snapshots` テーブルの Realtime を **ON** に設定

### 4. 認証設定

1. ダッシュボード → **Authentication** → **Providers**
2. **Email** プロバイダーが有効になっていることを確認
3. 「Confirm email」を開発中は **OFF** に設定（任意）

### 5. デモユーザーの作成

1. ダッシュボード → **Authentication** → **Users** → **Add User**
2. スタッフユーザー: `staff@demo.festivalflow.ai` / `demo1234!`
3. 管理者ユーザー: `admin@demo.festivalflow.ai` / `demo1234!`

4. ダッシュボード → **SQL Editor** で以下を実行：

```sql
-- スタッフユーザーのロール設定
UPDATE user_profiles
SET role = 'staff',
    assigned_booth_id = (SELECT id FROM event_booths WHERE name = 'お化け屋敷' LIMIT 1)
WHERE email = 'staff@demo.festivalflow.ai';

-- 管理者ユーザーのロール設定
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'admin@demo.festivalflow.ai';
```

### 6. API キーの取得

1. ダッシュボード → **Settings** → **API**
2. `Project URL` と `anon public` キーを `.env.local` に設定
3. `service_role secret` キーを `SUPABASE_SERVICE_ROLE_KEY` に設定

---

## 📁 プロジェクト構造

```
festivalflow-ai/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # ルートレイアウト（Noto Sans JP）
│   ├── page.tsx                  # 来場者ダッシュボード（静的生成）
│   ├── VisitorDashboardClient.tsx # クライアントコンポーネント
│   ├── staff/
│   │   ├── page.tsx              # スタッフログイン
│   │   └── dashboard/
│   │       ├── page.tsx          # スタッフダッシュボード（SSR認証）
│   │       └── StaffDashboardClient.tsx
│   └── admin/
│       └── dashboard/
│           ├── page.tsx          # 管理者センター（SSR認証）
│           └── AdminDashboardClient.tsx
├── components/
│   ├── visitor/                  # 来場者向けコンポーネント
│   │   ├── WaitTimeCard.tsx      # リアルタイム待ち時間カード
│   │   ├── EntertainmentPanel.tsx # クイズパネル
│   │   └── SmartRecommendation.tsx # AIレコメンデーション
│   ├── staff/                    # スタッフ向けコンポーネント
│   │   ├── QueueInputForm.tsx    # 行列入力フォーム
│   │   └── WaitTimePrediction.tsx # 予測表示
│   └── admin/                   # 管理者向けコンポーネント
│       ├── HeatMap.tsx           # SVGヒートマップ
│       ├── ThroughputChart.tsx   # Rechartsスループットグラフ
│       └── LiveStatsPanel.tsx    # ライブ統計
├── lib/
│   ├── queuing-theory.ts         # Little's Law + M/M/1 実装
│   ├── rbac.ts                   # ロールベースアクセス制御
│   └── supabase/
│       ├── client.ts             # ブラウザクライアント
│       ├── server.ts             # サーバークライアント（SSR）
│       └── middleware.ts         # セッション更新
├── store/
│   └── festivalStore.ts          # Zustand グローバルストア
├── types/
│   └── index.ts                  # TypeScript型定義
├── supabase/
│   └── schema.sql                # DBスキーマ・RLS・シードデータ
└── middleware.ts                  # Next.js Edge Middleware（RBAC）
```

---

## 🧮 待ち行列理論

FestivalFlow AI は以下の2つのアルゴリズムを組み合わせて待ち時間を予測します：

### Little's Law

```
W = L / λ
W: 待ち時間（分）, L: 行列長, λ: 処理率（人/分）
```

### M/M/1 待ち行列モデル

```
Wq = λ / (μ(μ - λ))
λ: 到着率, μ: サービス率, ρ = λ/μ（利用率）
```

### 統合予測

```
最終予測 = M/M/1 × 70% + Little's Law × 30%
```

---

## 🔐 セキュリティ

- **RLS（Row Level Security）**: 全テーブルで有効
- **RBAC**: スタッフは担当ブースのみ更新可能
- **Edge Middleware**: 未認証アクセスをログインページへリダイレクト
- **環境変数分離**: `NEXT_PUBLIC_` プレフィックスで公開/非公開を明確化
- **service_role キー**: サーバーサイドのみ使用（クライアントには非公開）

---

## 🚀 Vercel デプロイ手順

1. [Vercel](https://vercel.com) に GitHub リポジトリをインポート
2. 環境変数を Vercel ダッシュボードで設定：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_BASE_URL`（本番URL）
3. デプロイを実行（フレームワーク: Next.js は自動検出）

---

## 📊 パフォーマンス最適化

| 技術 | 効果 |
|------|------|
| `force-static` | 来場者ページを静的生成でEdge負荷軽減 |
| `React.memo()` | Realtime更新時の不要な再レンダリング防止 |
| Supabase Realtime フィルタ | 必要なINSERTのみ受信 |
| `next/image` | 自動Lazy Load・WebP変換 |
| カラム明示 `.select()` | Over-fetchingを防止 |

---

## 📝 開発コマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm run start        # 本番サーバー起動
npm run lint         # ESLint チェック
npm run type-check   # TypeScript 型チェック
```

---

## 🤝 ライセンス

© 2025 FestivalFlow AI. All rights reserved.

---

*このプロジェクトは産業工学・オペレーションズリサーチの手法（待ち行列理論）をリアルタイムWebアプリケーションに応用した実装例です。*
