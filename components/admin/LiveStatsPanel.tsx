'use client';

import React, { useEffect, useRef, useCallback, memo } from 'react';
import { Users, Clock, Flame, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useFestivalStore } from '@/store/festivalStore';
import type { LiveStats, QueueSnapshot } from '@/types';

// ──────────────────────────────────────────────
// ライブ統計の計算
// ──────────────────────────────────────────────

const computeLiveStats = (
  booths: ReturnType<typeof useFestivalStore.getState>['booths']
): LiveStats => {
  if (booths.length === 0) {
    return {
      totalCurrentVisitors: 0,
      overallAvgWaitMinutes: 0,
      mostCongestedBoothName: '—',
      mostCongestedQueueLength: 0,
      systemUtilization: 0,
    };
  }

  const activeBooths = booths.filter((b) => b.is_active);

  // 現在の総来場者数 = sum(current_queue_length)
  const totalCurrentVisitors = activeBooths.reduce(
    (sum, b) => sum + b.currentQueueLength,
    0
  );

  // 全体平均待ち時間 = avg(predicted_wait_minutes)
  const finiteWaits = activeBooths
    .map((b) => b.currentWaitMinutes)
    .filter((w) => isFinite(w));
  const overallAvgWaitMinutes =
    finiteWaits.length > 0
      ? finiteWaits.reduce((sum, w) => sum + w, 0) / finiteWaits.length
      : 0;

  // 最混雑ブース = max(current_queue_length)
  const mostCongested = activeBooths.reduce(
    (max, b) => (b.currentQueueLength > max.currentQueueLength ? b : max),
    activeBooths[0]
  );

  // システム利用率 ρ = avg(arrival_rate / service_rate)
  const utilizationValues = activeBooths
    .map((b) => b.utilization)
    .filter((u) => isFinite(u));
  const systemUtilization =
    utilizationValues.length > 0
      ? utilizationValues.reduce((sum, u) => sum + u, 0) / utilizationValues.length
      : 0;

  return {
    totalCurrentVisitors,
    overallAvgWaitMinutes,
    mostCongestedBoothName: mostCongested?.name ?? '—',
    mostCongestedQueueLength: mostCongested?.currentQueueLength ?? 0,
    systemUtilization,
  };
};

// ──────────────────────────────────────────────
// 統計カード（メモ化）
// ──────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  accentColor: string;
  bgColor: string;
}

const StatCard = memo(function StatCard({
  icon,
  label,
  value,
  subtext,
  trend,
  accentColor,
  bgColor,
}: StatCardProps) {
  const TrendIcon =
    trend === 'up'
      ? TrendingUp
      : trend === 'down'
      ? TrendingDown
      : Minus;

  const trendColor =
    trend === 'up'
      ? 'text-red-500'
      : trend === 'down'
      ? 'text-green-500'
      : 'text-gray-400';

  return (
    <div
      className={`rounded-xl p-4 border ${bgColor} transition-all duration-300 hover:shadow-md`}
    >
      {/* アイコン + ラベル */}
      <div className="flex items-start justify-between mb-2">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${accentColor}`}
        >
          {icon}
        </div>
        {trend && (
          <TrendIcon
            size={14}
            className={trendColor}
            aria-label={
              trend === 'up' ? '増加傾向' : trend === 'down' ? '減少傾向' : '変化なし'
            }
          />
        )}
      </div>

      {/* 数値 */}
      <p className="text-2xl font-bold font-inter text-[#0f172a] leading-tight mt-1">
        {value}
      </p>

      {/* ラベル */}
      <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>

      {/* サブテキスト */}
      {subtext && (
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{subtext}</p>
      )}
    </div>
  );
});

// ──────────────────────────────────────────────
// ライブ統計パネル本体
// ──────────────────────────────────────────────

export default function LiveStatsPanel() {
  const supabase = createClient();
  const booths = useFestivalStore((s) => s.booths);
  const { liveStats, setLiveStats, updateBoothStatus } = useFestivalStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ブースデータが変わるたびに統計を再計算
  useEffect(() => {
    const stats = computeLiveStats(booths);
    setLiveStats(stats);
  }, [booths, setLiveStats]);

  // Supabase Realtime で live更新
  const subscribeToUpdates = useCallback(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    channelRef.current = supabase
      .channel('live-stats-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'queue_snapshots' },
        (payload) => {
          updateBoothStatus(payload.new as QueueSnapshot);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, updateBoothStatus]);

  useEffect(() => {
    const cleanup = subscribeToUpdates();
    return cleanup;
  }, [subscribeToUpdates]);

  const stats = liveStats ?? computeLiveStats(booths);

  const utilizationPercent = Math.round(stats.systemUtilization * 100);
  const utilizationTrend =
    utilizationPercent > 80 ? 'up' : utilizationPercent < 40 ? 'down' : 'neutral';

  const waitTrend =
    stats.overallAvgWaitMinutes > 20
      ? 'up'
      : stats.overallAvgWaitMinutes < 10
      ? 'down'
      : 'neutral';

  return (
    <section aria-label="リアルタイム統計パネル">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <Activity size={18} className="text-green-600" aria-hidden />
          </div>
          <div>
            <h2 className="font-bold text-base text-[#0f172a]">
              ライブ統計
            </h2>
            <p className="text-xs text-gray-500">全ブースのリアルタイム集計</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden />
          <span className="text-xs text-green-600 font-medium">ライブ</span>
        </div>
      </div>

      {/* 統計カードグリッド */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 現在の総来場者数 */}
        <StatCard
          icon={<Users size={18} className="text-blue-600" aria-hidden />}
          label="現在の総来場者数"
          value={`${stats.totalCurrentVisitors.toLocaleString()}人`}
          subtext="全ブース合計行列人数"
          accentColor="bg-blue-100"
          bgColor="bg-white border-blue-100"
        />

        {/* 全体平均待ち時間 */}
        <StatCard
          icon={<Clock size={18} className="text-orange-500" aria-hidden />}
          label="全体平均待ち時間"
          value={
            stats.overallAvgWaitMinutes > 0
              ? `${stats.overallAvgWaitMinutes.toFixed(1)}分`
              : '待ちなし'
          }
          subtext="全ブース待ち時間の平均"
          trend={waitTrend}
          accentColor="bg-orange-100"
          bgColor="bg-white border-orange-100"
        />

        {/* 最混雑ブース */}
        <StatCard
          icon={<Flame size={18} className="text-red-500" aria-hidden />}
          label="最混雑ブース"
          value={stats.mostCongestedBoothName}
          subtext={`行列 ${stats.mostCongestedQueueLength}人`}
          accentColor="bg-red-100"
          bgColor="bg-white border-red-100"
        />

        {/* システム利用率 */}
        <StatCard
          icon={<TrendingUp size={18} className="text-purple-600" aria-hidden />}
          label="システム利用率 (ρ)"
          value={`${utilizationPercent}%`}
          subtext={
            utilizationPercent >= 80
              ? '⚠️ 高負荷状態です'
              : utilizationPercent >= 50
              ? '適切な稼働状態'
              : '余裕あり'
          }
          trend={utilizationTrend}
          accentColor="bg-purple-100"
          bgColor="bg-white border-purple-100"
        />
      </div>

      {/* システム利用率プログレスバー */}
      <div className="mt-3 bg-white border border-gray-100 rounded-xl p-3">
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <span className="text-gray-600 font-medium">全体システム利用率</span>
          <span className="font-bold font-inter text-gray-800">
            {utilizationPercent}%
          </span>
        </div>
        <div className="progress-bar-track">
          <div
            className={`progress-bar-fill ${
              utilizationPercent >= 80
                ? 'bg-red-500'
                : utilizationPercent >= 50
                ? 'bg-yellow-400'
                : 'bg-green-500'
            }`}
            style={{ width: `${utilizationPercent}%` }}
            role="progressbar"
            aria-valuenow={utilizationPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`システム利用率 ${utilizationPercent}%`}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1 font-inter">
          <span>0%（余裕）</span>
          <span>50%（適切）</span>
          <span>100%（過負荷）</span>
        </div>
      </div>
    </section>
  );
}
