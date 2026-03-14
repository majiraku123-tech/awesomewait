import { createClient } from '@/lib/supabase/server';
import type { EventBooth, BoothWithStatus, QueueSnapshot } from '@/types';
import { getCongestionLevel } from '@/types';
import VisitorDashboardClient from './VisitorDashboardClient';

// 静的生成（Vercel Edge負荷軽減）
// 待ち時間データはクライアントコンポーネントで Realtime 受信
export const dynamic = 'force-static';
export const revalidate = 60; // 60秒ごとに再生成

// ──────────────────────────────────────────────
// サーバーサイドデータ取得
// ──────────────────────────────────────────────

async function fetchInitialBoothData(): Promise<BoothWithStatus[]> {
  try {
    const supabase = createClient();

    // イベントブース一覧（カラム明示でover-fetchingを防止）
    const { data: booths, error: boothError } = await supabase
      .from('event_booths')
      .select(
        'id, name, location_x, location_y, service_rate, satisfaction_rating, is_active, created_at'
      )
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (boothError || !booths) {
      console.error('[VisitorPage] ブース取得エラー:', boothError);
      return [];
    }

    // 最新スナップショット（各ブースの最新1件）
    const { data: snapshots, error: snapError } = await supabase
      .from('queue_snapshots')
      .select(
        'booth_id, current_queue_length, predicted_wait_minutes, arrival_rate, recorded_at'
      )
      .in(
        'booth_id',
        booths.map((b: EventBooth) => b.id)
      )
      .order('recorded_at', { ascending: false });

    if (snapError) {
      console.error('[VisitorPage] スナップショット取得エラー:', snapError);
    }

    // 各ブースの最新スナップショットをマップ
    type SnapPartial = Pick<QueueSnapshot, 'booth_id' | 'current_queue_length' | 'predicted_wait_minutes' | 'arrival_rate' | 'recorded_at'>;
    const latestSnapMap = new Map<string, SnapPartial>();
    (snapshots ?? []).forEach((snap: SnapPartial) => {
      if (!latestSnapMap.has(snap.booth_id)) {
        latestSnapMap.set(snap.booth_id, snap);
      }
    });

    // BoothWithStatus の構築
    return booths.map((booth: EventBooth): BoothWithStatus => {
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
  } catch (err) {
    console.error('[VisitorPage] 予期しないエラー:', err);
    return [];
  }
}

// ──────────────────────────────────────────────
// ページコンポーネント（Server Component）
// ──────────────────────────────────────────────

export default async function VisitorPage() {
  const initialBooths = await fetchInitialBoothData();

  return <VisitorDashboardClient initialBooths={initialBooths} />;
}
