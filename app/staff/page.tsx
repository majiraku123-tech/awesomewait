'use client';

import React, { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Eye, EyeOff, Loader2, AlertCircle, Lock, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { StaffLoginFormValues, UserProfile } from '@/types';

// ──────────────────────────────────────────────
// スタッフログインページ
// ──────────────────────────────────────────────

export default function StaffLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [formValues, setFormValues] = useState<StaffLoginFormValues>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErrorMessage('');

      if (!formValues.email.trim() || !formValues.password) {
        setErrorMessage('メールアドレスとパスワードを入力してください');
        return;
      }

      startTransition(async () => {
        // Supabase Auth でサインイン
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: formValues.email.trim(),
          password: formValues.password,
        });

        if (authError || !authData.user) {
          const msg =
            authError?.message?.includes('Invalid login credentials')
              ? 'メールアドレスまたはパスワードが正しくありません'
              : `ログインに失敗しました: ${authError?.message ?? '不明なエラー'}`;
          setErrorMessage(msg);
          return;
        }

        // user_profiles からロールを取得
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, email, role, assigned_booth_id, created_at')
          .eq('id', authData.user.id)
          .single<UserProfile>();

        if (profileError || !profile) {
          setErrorMessage('プロフィール情報の取得に失敗しました。管理者に連絡してください。');
          await supabase.auth.signOut();
          return;
        }

        // ロール検証
        if (profile.role === 'visitor') {
          setErrorMessage('スタッフまたは管理者アカウントが必要です');
          await supabase.auth.signOut();
          return;
        }

        // ロールに応じてリダイレクト
        if (profile.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          router.push('/staff/dashboard');
        }

        router.refresh();
      });
    },
    [formValues, supabase, router]
  );

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* カードコンテナ */}
        <div className="card shadow-xl">
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0056b3] to-[#003d82] flex items-center justify-center shadow-lg mx-auto mb-4">
              <Lock size={24} className="text-white" aria-hidden />
            </div>
            <h1 className="text-2xl font-bold text-[#0f172a]">
              スタッフログイン
            </h1>
            <p className="text-sm text-gray-500 mt-1.5">
              FestivalFlow AI スタッフポータル
            </p>
          </div>

          {/* フォーム */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* メールアドレス */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                メールアドレス
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Mail size={16} className="text-gray-400" aria-hidden />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={formValues.email}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="staff@school.jp"
                  className="input-field pl-9"
                  required
                  aria-label="メールアドレス"
                  aria-describedby={errorMessage ? 'login-error' : undefined}
                />
              </div>
            </div>

            {/* パスワード */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                パスワード
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Lock size={16} className="text-gray-400" aria-hidden />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formValues.password}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  placeholder="パスワードを入力"
                  className="input-field pl-9 pr-10"
                  required
                  aria-label="パスワード"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0056b3] focus:ring-offset-1 rounded"
                  aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
            </div>

            {/* エラーメッセージ */}
            {errorMessage && (
              <div
                id="login-error"
                className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle
                  size={16}
                  className="text-red-500 mt-0.5 shrink-0"
                  aria-hidden
                />
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full mt-2"
              aria-label="ログインする"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  ログイン中...
                </>
              ) : (
                <>
                  <LogIn size={16} aria-hidden />
                  ログイン
                </>
              )}
            </button>
          </form>

          {/* フッター */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              アカウントをお持ちでない方は管理者にお問い合わせください
            </p>
            <div className="mt-3 bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 text-center font-medium mb-1">
                デモ用アカウント情報
              </p>
              <div className="text-xs text-gray-500 text-center space-y-0.5">
                <p>スタッフ: staff@demo.festivalflow.ai</p>
                <p>管理者: admin@demo.festivalflow.ai</p>
                <p className="text-gray-400">パスワード: demo1234!</p>
              </div>
            </div>
          </div>
        </div>

        {/* 来場者ダッシュボードへのリンク */}
        <p className="text-center mt-4 text-sm text-gray-500">
          来場者の方は{' '}
          <a
            href="/"
            className="text-[#0056b3] font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-[#0056b3] focus:ring-offset-1 rounded"
          >
            来場者ダッシュボード
          </a>
          {' '}をご利用ください
        </p>
      </div>
    </div>
  );
}
