import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase Server Client (SSR)
 *
 * Server Components、Server Actions、Route Handlers で使用するSupabaseクライアント。
 * セッションCookieを自動的に読み書きし、認証状態を維持する。
 *
 * ⚠️ 重要: このファイルはサーバーサイドでのみ実行されること。
 *            クライアントコンポーネントでは lib/supabase/client.ts を使用すること。
 */
export const createClient = () => {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component から呼ばれた場合は Cookie の書き込みができないため
            // このエラーは無視する（読み取り専用操作は正常に動作する）
          }
        },
      },
    }
  );
};
