import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase Browser Client
 *
 * クライアントコンポーネント（'use client'）内で使用するSupabaseクライアント。
 * NEXT_PUBLIC_ プレフィックスの付いた環境変数のみ使用し、
 * service_role キーは絶対に使用しない。
 */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
