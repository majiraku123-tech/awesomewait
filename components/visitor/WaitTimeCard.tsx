'use client';

import React, { useEffect, useRef, useCallback, memo } from 'react';
import { Clock, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useFestivalStore } from '@/store/festivalStore';
import type { BoothWithStatus, QueueSnapshot } from '@/types';
import { CONGESTION_CONFIG } from '@/types';

// ──────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────

interface WaitTimeCardProps {
  booth: BoothWithStatus;
}

// ──────────────────────────────────────────────
// 単体カード（メモ化で不要な再レンダリングを防止）
// ──────────────────────────────────────────────

const WaitTimeCardItem = memo(function WaitTimeCardItem({ booth }: WaitTimeCardProps) {
  const config = CONGESTION_CONFIG[booth.congestionLevel];

  // プログレスバーの幅: 最大60分を上限として割合を計算
  const progressPercent = Math.min(100, (booth.currentWaitMinutes / 60) * 100);

  const waitLabel = useCallback((minutes: number): string => {
    if (minutes <= 0) return '待ちなし';
    if (!isFinite(minutes) || minutes > 120) return '1時間以上';
    if (minutes < 1) return '約1分';
    return `約${Math.ceil(minutes)}分`;
  }, []);

  return (
    <article
      className={`card-hover border-l-4 ${config.colorClass} animate-fade-in`}
      aria-label={`${booth.name} — 待ち時間: ${waitLabel(booth.currentWaitMinutes)}`}
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base text-[#0f172a] truncate leading-snug">
            {booth.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`badge text-xs ${
                booth.congestionLevel === 'low'
                  ? 'badge-blue'
                  : booth.congestionLevel === 'mid'
                  ? 'badge-yellow'
                  : 'badge-red'
              }`}
            >
              {config.label}
            </span>
          </div>
        </div>

        {/* 待ち時間数字 */}
        <div className="text-right shrink-0">
          <div
            className={`text-2xl font-bold font-inter leading-none ${
              booth.congestionLevel === 'low'
                ? 'text-blue-600'
                : booth.congestionLevel === 'mid'
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {Math.ceil(Math.max(0, booth.currentWaitMinutes))}
          </div>
          <div className="text-xs text-gray-500 font-medium mt-0.5">分待ち</div>
        </div>
      </div>

      {/* プログレスバー */}
      <div className="progress-bar-track mb-3" role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`混雑度: ${Math.round(progressPercent)}%`}
      >
        <div
          className={`progress-bar-fill ${config.progressColor}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* フッター統計 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Users size={12} className="shrink-0" aria-hidden />
          <span>行列 {booth.currentQueueLength}人</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp size={12} className="shrink-0" aria-hidden />
          <span>処理 {booth.service_rate}人/分</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} className="shrink-0" aria-hidden />
          <span>利用率 {Math.round(booth.utilization * 100)}%</span>
        </div>
      </div>
    </article>
  );
});

// ──────────────────────────────────────────────
// リアルタイムリスト（Supabase Realtime 購読）
// ──────────────────────────────────────────────

export default function WaitTimeCard() {
  const supabase = createClient();
  const { booths, updateBoothStatus, isLoadingBooths } = useFestivalStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Supabase Realtime: queue_snapshots の INSERT を監視
  const subscribeToRealtimeUpdates = useCallback(() => {
    // 既存チャンネルをクリーンアップ
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // 最適化: 最新5分以内のINSERTのみを購読（over-subscribeを防止）
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    channelRef.current = supabase
      .channel('queue-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'queue_snapshots',
        },
        (payload) => {
          const snapshot = payload.new as QueueSnapshot;
          updateBoothStatus(snapshot);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug('[FestivalFlow] Realtime チャンネル接続完了');
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, updateBoothStatus]);

  useEffect(() => {
    const cleanup = subscribeToRealtimeUpdates();
    return cleanup;
  }, [subscribeToRealtimeUpdates]);

  // ローディング状態
  if (isLoadingBooths) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton h-5 w-3/4 mb-3" />
            <div className="skeleton h-4 w-1/3 mb-3" />
            <div className="skeleton h-2 w-full mb-3" />
            <div className="skeleton h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // データなし
  if (booths.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle size={48} className="text-gray-300 mb-3" aria-hidden />
        <p className="text-gray-500 font-medium">現在表示できるブース情報がありません</p>
        <p className="text-sm text-gray-400 mt-1">しばらくしてからページを更新してください</p>
      </div>
    );
  }

  return (
    <section aria-label="全ブース待ち時間一覧">
      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-3 mb-4 px-1" role="legend" aria-label="混雑度の凡例">
        <span className="text-xs text-gray-500 font-medium">混雑度:</span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" aria-hidden />
          <span className="text-gray-600">空き（10分未満）</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" aria-hidden />
          <span className="text-gray-600">普通（10〜20分）</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" aria-hidden />
          <span className="text-gray-600">混雑（20分以上）</span>
        </span>
      </div>

      {/* カードグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {booths
          .filter((b) => b.is_active)
          .sort((a, b) => a.currentWaitMinutes - b.currentWaitMinutes)
          .map((booth) => (
            <WaitTimeCardItem key={booth.id} booth={booth} />
          ))}
      </div>
    </section>
  );
}
