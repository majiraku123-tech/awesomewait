import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isProtectedRoute, isAdminRoute, canAccessRoute } from '@/lib/rbac';
import type { UserRole } from '@/types';

/**
 * FestivalFlow AI — Next.js Edge Middleware
 *
 * 役割:
 * 1. Supabase セッションの自動リフレッシュ（全ルート）
 * 2. RBAC ルーティングガード（保護ルートへの未認証アクセスをブロック）
 * 3. ロールベースのリダイレクト
 *
 * Edge Runtime で動作するため、Node.js API は使用不可。
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ──────────────────────────────────────────────
  // Step 1: Supabase セッション更新
  // ──────────────────────────────────────────────
  const { supabaseResponse, user } = await updateSession(request);

  // ──────────────────────────────────────────────
  // Step 2: パブリックルートはそのまま通過
  // ──────────────────────────────────────────────
  if (!isProtectedRoute(pathname)) {
    return supabaseResponse;
  }

  // ──────────────────────────────────────────────
  // Step 3: 未認証ユーザーをログインページへリダイレクト
  // ──────────────────────────────────────────────
  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/staff';
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ──────────────────────────────────────────────
  // Step 4: ユーザープロフィール（ロール）をCookieから取得
  // Note: Edge Runtime では DB クエリを避けるため、
  //       JWT クレームからロールを取得する
  // ──────────────────────────────────────────────
  const {
    app_metadata: appMeta,
    user_metadata: userMeta,
  } = user;

  // カスタムクレームからロールを取得（なければ user_metadata にフォールバック）
  const role: UserRole | null =
    (appMeta?.role as UserRole) ??
    (userMeta?.role as UserRole) ??
    null;

  // ──────────────────────────────────────────────
  // Step 5: ロールベースアクセス制御
  // ──────────────────────────────────────────────

  // 管理者ルートにスタッフがアクセスしようとした場合
  if (isAdminRoute(pathname) && role !== 'admin') {
    if (role === 'staff') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/staff/dashboard';
      return NextResponse.redirect(redirectUrl);
    }
    // ロール不明 → ログインへ
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/staff';
    return NextResponse.redirect(redirectUrl);
  }

  // スタッフルートに来場者がアクセスしようとした場合
  if (pathname.startsWith('/staff/dashboard') && role === 'visitor') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/staff';
    return NextResponse.redirect(redirectUrl);
  }

  // ──────────────────────────────────────────────
  // Step 6: アクセス許可 — レスポンスをそのまま返す
  // ──────────────────────────────────────────────
  return supabaseResponse;
}

/**
 * Middleware が適用されるルートのマッチャー
 *
 * 除外: _next/static, _next/image, favicon.ico, その他の静的アセット
 */
export const config = {
  matcher: [
    /*
     * 以下で始まるパスを除外:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico
     * - public フォルダの静的ファイル
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
