import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'FestivalFlow AI | 文化祭フロー AI',
    template: '%s | FestivalFlow AI',
  },
  description:
    'FestivalFlow AI は、文化祭における来場者の混雑状況をリアルタイムで可視化し、AI予測によって快適な体験を提供するクラウド管理プラットフォームです。',
  keywords: ['文化祭', '混雑管理', 'リアルタイム', '待ち時間', 'AI予測', 'FestivalFlow'],
  authors: [{ name: 'FestivalFlow AI Team' }],
  creator: 'FestivalFlow AI',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  ),
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    title: 'FestivalFlow AI | 文化祭フロー AI',
    description: '文化祭の混雑を AI でスマートに管理。リアルタイム待ち時間・スマートレコメンデーション。',
    siteName: 'FestivalFlow AI',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  themeColor: '#0056b3',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* Google Fonts: Noto Sans JP（日本語）+ Inter（数値・英語） */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Inter:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased min-h-screen bg-surface-alt text-text-primary">
        {/* グローバルナビゲーションバー */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* ブランドロゴ */}
              <a
                href="/"
                className="flex items-center gap-2 group"
                aria-label="FestivalFlow AI ホームへ戻る"
              >
                <div className="w-8 h-8 rounded-lg bg-[#0056b3] flex items-center justify-center shadow-sm group-hover:bg-[#003d82] transition-colors">
                  <span className="text-white text-sm font-bold leading-none">FF</span>
                </div>
                <div className="hidden sm:block">
                  <span className="text-[#0056b3] font-bold text-base leading-tight font-inter">
                    FestivalFlow
                  </span>
                  <span className="text-[#ff8c00] font-bold text-base leading-tight font-inter ml-1">
                    AI
                  </span>
                </div>
              </a>

              {/* ナビゲーションリンク */}
              <nav
                className="flex items-center gap-1"
                aria-label="メインナビゲーション"
              >
                <a
                  href="/"
                  className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#0056b3] hover:bg-blue-50 rounded-lg transition-colors min-h-[44px] flex items-center"
                >
                  来場者
                </a>
                <a
                  href="/staff"
                  className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#0056b3] hover:bg-blue-50 rounded-lg transition-colors min-h-[44px] flex items-center"
                >
                  スタッフ
                </a>
                <a
                  href="/admin/dashboard"
                  className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#0056b3] hover:bg-blue-50 rounded-lg transition-colors min-h-[44px] flex items-center"
                >
                  管理者
                </a>
              </nav>
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1">
          {children}
        </main>

        {/* フッター */}
        <footer className="bg-white border-t border-gray-100 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#0056b3] flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">FF</span>
                </div>
                <span className="text-xs text-gray-500">
                  © 2025 FestivalFlow AI. All rights reserved.
                </span>
              </div>
              <p className="text-xs text-gray-400">
                文化祭クラウド管理プラットフォーム — Powered by Next.js &amp; Supabase
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
