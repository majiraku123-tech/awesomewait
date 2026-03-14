import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Supabase Auth Middleware
 *
 * Edge Runtime で動作するセッション管理ミドルウェア。
 * 各リクエストでセッションCookieを更新し、認証状態を維持する。
 *
 * Next.js の middleware.ts から呼び出して使用する。
 */
export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // セッションの更新（アクセストークンの自動リフレッシュ）
  // ⚠️ getUser() を必ず呼び出すこと（セッションリフレッシュのトリガー）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
};
