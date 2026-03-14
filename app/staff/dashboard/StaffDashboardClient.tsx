'use client';

import React, { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronRight, User, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import QueueInputForm from '@/components/staff/QueueInputForm';
import WaitTimePrediction from '@/components/staff/WaitTimePrediction';
import { getRoleLabel } from '@/lib/rbac';
import { calculateCombinedWaitTime, estimateArrivalRate } from '@/lib/queuing-theory';
import type { UserProfile, EventBooth } from '@/types';

interface StaffDashboardClientProps {
  staffProfile: UserProfile;
  booths: EventBooth[];
}

export default function StaffDashboardClient({
  staffProfile,
  booths,
}: StaffDashboardClientProps) {
  const supabase = createClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // QueueInputForm から WaitTimePrediction へのリフトアップ状態
  const [selectedBoothId, setSelectedBoothId] = useState<string>(
    staffProfile.assigned_booth_id ?? (booths.length > 0 ? booths[0].id : '')
  );
  const [queueLength, setQueueLength] = useState<number>(0);
  const [arrivalRate, setArrivalRate] = useState<number>(0);

  const selectedBooth =
    booths.find((b) => b.id === selectedBoothId) ?? null;

  const handleSignOut = useCallback(() => {
    startTransition(async () => {
      await supabase.auth.signOut();
      router.push('/staff');
      router.refresh();
    });
  }, [supabase, router]);

  return (
    <div className="page-container">
      {/* ページヘッダー */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
              {staffProfile.role === 'admin' ? (
                <Shield size={15} className="text-[#0056b3]" aria-hidden />
              ) : (
                <User size={15} className="text-[#0056b3]" aria-hidden />
              )}
            </div>
            <span className="text-xs font-medium text-[#0056b3] bg-blue-50 px-2 py-0.5 rounded-full">
              {getRoleLabel(staffProfile.role)}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[#0f172a]">
            スタッフダッシュボード
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ようこそ、{staffProfile.email} さん
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 管理者ダッシュボードへのリンク */}
          {staffProfile.role === 'admin' && (
            <a
              href="/admin/dashboard"
              className="btn-secondary text-xs px-3 py-2 min-h-[40px]"
              aria-label="管理者ダッシュボードへ移動"
            >
              管理者画面
              <ChevronRight size={14} aria-hidden />
            </a>
          )}

          {/* ログアウト */}
          <button
            onClick={handleSignOut}
            disabled={isPending}
            className="btn-ghost text-xs px-3 py-2 min-h-[40px] border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
            aria-label="ログアウトする"
          >
            <LogOut size={14} aria-hidden />
            ログアウト
          </button>
        </div>
      </div>

      {/* ブース一覧がない場合 */}
      {booths.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-2">担当ブースが割り当てられていません</p>
          <p className="text-sm text-gray-400">管理者にブースの割り当てを依頼してください</p>
        </div>
      )}

      {/* メインコンテンツ */}
      {booths.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左カラム: 行列入力フォーム */}
          <div>
            <QueueInputForm
              staffProfile={staffProfile}
              booths={booths}
            />
          </div>

          {/* 右カラム: 待ち時間予測 */}
          <div>
            <WaitTimePrediction
              queueLength={queueLength}
              arrivalRate={arrivalRate}
              booth={selectedBooth}
            />
          </div>
        </div>
      )}

      {/* 操作ガイド */}
      <div className="mt-6 card bg-blue-50 border border-blue-200">
        <h3 className="font-bold text-sm text-blue-800 mb-2">📋 操作手順</h3>
        <ol className="text-xs text-blue-700 space-y-1.5 leading-relaxed list-decimal list-inside">
          <li>担当ブースを選択してください（スタッフは担当ブース固定）</li>
          <li>現在の行列人数を数えて入力してください</li>
          <li>「行列情報を更新する」ボタンを押すと即時反映されます</li>
          <li>5〜10分おきに定期的に更新することを推奨します</li>
          <li>到着率は空欄のまま送信すると自動推定されます</li>
        </ol>
      </div>
    </div>
  );
}
