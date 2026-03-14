'use client';

import React, { useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, LayoutDashboard, Users, ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useFestivalStore } from '@/store/festivalStore';
import HeatMap from '@/components/admin/HeatMap';
import ThroughputChart from '@/components/admin/ThroughputChart';
import LiveStatsPanel from '@/components/admin/LiveStatsPanel';
import type { UserProfile, ThroughputDataPoint, EventBooth, BoothWithStatus, QueueSnapshot } from '@/types';
import { getCongestionLevel } from '@/types';

interface AdminDashboardClientProps {
  adminProfile: UserProfile;
  throughputData: ThroughputDataPoint[];
}

export default function AdminDashboardClient({
  adminProfile,
  throughputData,
}: AdminDashboardClientProps) {
  const supabase = createClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { setBooths, setLoadingBooths } = useFestivalStore();

  // 全ブースデータの初期ロード
  const loadBoothData = useCallback(async () => {
    setLoadingBooths(true);

    const { data: booths, error: boothError } = await supabase
      .from('event_booths')
      .select(
        'id, name, location_x, location_y, service_rate, satisfaction_rating, is_active, created_at'
      )
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (boothError || !booths) {
      console.error('[AdminDashboard] ブース取得エラー:', boothError);
      setLoadingBooths(false);
      return;
    }

    // 最新スナップショット
    const { data: snapshots } = await supabase
      .from('queue_snapshots')
      .select(
        'booth_id, current_queue_length, predicted_wait_minutes, arrival_rate, recorded_at'
      )
      .in('booth_id', booths.map((b: EventBooth) => b.id))
      .order('recorded_at', { ascending: false });

    type SnapPartial = Pick<QueueSnapshot, 'booth_id' | 'current_queue_length' | 'predicted_wait_minutes' | 'arrival_rate' | 'recorded_at'>;
    const latestSnapMap = new Map<string, SnapPartial>();
    (snapshots ?? []).forEach((snap: SnapPartial) => {
      if (!latestSnapMap.has(snap.booth_id)) {
        latestSnapMap.set(snap.booth_id, snap);
      }
    });

    const boothsWithStatus: BoothWithStatus[] = booths.map((booth: EventBooth) => {
      const snap = latestSnapMap.get(booth.id);
      const waitMinutes = snap?.predicted_wait_minutes ?? 0;
      const queueLength = snap?.current_queue_length ?? 0;
      const arrivalRate = snap?.arrival_rate ?? 0;
      const utilization =
        arrivalRate > 0 && booth.service_rate > 0
          ? Math.min(1, arrivalRate / booth.service_rate)
          : 0;
      return {
        ...booth,
        currentQueueLength: queueLength,
        currentWaitMinutes: waitMinutes,
        arrivalRate,
        utilization,
        congestionLevel: getCongestionLevel(waitMinutes),
        totalVisitorsToday: queueLength,
      };
    });

    setBooths(boothsWithStatus);
    setLoadingBooths(false);
  }, [supabase, setBooths, setLoadingBooths]);

  useEffect(() => {
    loadBoothData();
  }, [loadBoothData]);

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
            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
              <LayoutDashboard size={15} className="text-purple-600" aria-hidden />
            </div>
            <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              管理者
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[#0f172a]">
            管理者アナリティクスセンター
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {adminProfile.email} — リアルタイム全体監視
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/staff/dashboard"
            className="btn-secondary text-xs px-3 py-2 min-h-[40px]"
            aria-label="スタッフダッシュボードへ移動"
          >
            <ChevronLeft size={14} aria-hidden />
            スタッフ画面
          </a>
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

      {/* ライブ統計パネル */}
      <div className="mb-6">
        <LiveStatsPanel />
      </div>

      {/* ヒートマップ + スループットチャート */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <HeatMap />
        <ThroughputChart data={throughputData.length > 0 ? throughputData : undefined} />
      </div>

      {/* ブース一覧テーブル */}
      <AdminBoothTable />
    </div>
  );
}

// ──────────────────────────────────────────────
// 管理者向けブース詳細テーブル
// ──────────────────────────────────────────────

function AdminBoothTable() {
  const booths = useFestivalStore((s) => s.booths);

  if (booths.length === 0) return null;

  return (
    <section className="card" aria-label="全ブース詳細データ">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
          <Users size={18} className="text-gray-600" aria-hidden />
        </div>
        <h2 className="font-bold text-base text-[#0f172a]">全ブース詳細データ</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="ブース別統計テーブル">
          <thead>
            <tr className="border-b border-gray-100">
              {['ブース名', '行列', '待ち時間', '処理能力', '利用率', '満足度', '状態'].map(
                (h) => (
                  <th
                    key={h}
                    scope="col"
                    className="text-left text-xs font-medium text-gray-500 pb-2 pr-4 last:pr-0"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {booths
              .filter((b) => b.is_active)
              .sort((a, b) => b.currentWaitMinutes - a.currentWaitMinutes)
              .map((booth) => {
                const utilizationPct = Math.round(booth.utilization * 100);
                return (
                  <tr
                    key={booth.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-2.5 pr-4 font-medium text-[#0f172a]">
                      {booth.name}
                    </td>
                    <td className="py-2.5 pr-4 font-inter text-gray-700">
                      {booth.currentQueueLength}人
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`font-bold font-inter ${
                          booth.congestionLevel === 'low'
                            ? 'text-blue-600'
                            : booth.congestionLevel === 'mid'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {Math.ceil(booth.currentWaitMinutes)}分
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-inter text-gray-700">
                      {booth.service_rate}人/分
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 progress-bar-track">
                          <div
                            className={`progress-bar-fill ${
                              utilizationPct >= 80
                                ? 'bg-red-500'
                                : utilizationPct >= 50
                                ? 'bg-yellow-400'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${utilizationPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-inter text-gray-600 w-8">
                          {utilizationPct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 font-inter text-gray-700">
                      ★{booth.satisfaction_rating.toFixed(1)}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`badge text-xs ${
                          booth.congestionLevel === 'low'
                            ? 'badge-blue'
                            : booth.congestionLevel === 'mid'
                            ? 'badge-yellow'
                            : 'badge-red'
                        }`}
                      >
                        {booth.congestionLevel === 'low'
                          ? '空き'
                          : booth.congestionLevel === 'mid'
                          ? '普通'
                          : '混雑'}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
