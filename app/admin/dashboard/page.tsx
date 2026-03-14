import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile, ThroughputDataPoint } from '@/types';
import AdminDashboardClient from './AdminDashboardClient';

// ──────────────────────────────────────────────
// 管理者アナリティクスセンター（Server Component）
// ──────────────────────────────────────────────

async function fetchThroughputData(): Promise<ThroughputDataPoint[]> {
  try {
    const supabase = createClient();

    // 直近8時間のスナップショットを30分刻みで集計
    const { data, error } = await supabase
      .from('queue_snapshots')
      .select(
        'current_queue_length, predicted_wait_minutes, recorded_at'
      )
      .gte(
        'recorded_at',
        new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
      )
      .order('recorded_at', { ascending: true });

    if (error || !data || data.length === 0) return [];

    // 30分スロット集計
    const slotMap = new Map<string, {
      visitors: number;
      waitSum: number;
      count: number;
    }>();

    data.forEach((row) => {
      const dt = new Date(row.recorded_at);
      const slotMinutes = Math.floor(dt.getMinutes() / 30) * 30;
      const key = `${String(dt.getHours()).padStart(2, '0')}:${String(slotMinutes).padStart(2, '0')}`;

      const existing = slotMap.get(key);
      if (existing) {
        existing.visitors += row.current_queue_length;
        existing.waitSum += row.predicted_wait_minutes;
        existing.count += 1;
      } else {
        slotMap.set(key, {
          visitors: row.current_queue_length,
          waitSum: row.predicted_wait_minutes,
          count: 1,
        });
      }
    });

    return Array.from(slotMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, { visitors, waitSum, count }]) => ({
        time,
        visitors,
        avgWait: Math.round((waitSum / count) * 10) / 10,
        throughput: Math.round(visitors * 0.85),
      }));
  } catch (err) {
    console.error('[AdminDashboardPage] スループットデータ取得エラー:', err);
    return [];
  }
}

export default async function AdminDashboardPage() {
  const supabase = createClient();

  // 認証確認
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/staff');
  }

  // 管理者ロール確認
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, role, assigned_booth_id, created_at')
    .eq('id', user.id)
    .single<UserProfile>();

  if (profileError || !profile || profile.role !== 'admin') {
    // スタッフはスタッフダッシュボードへリダイレクト
    if (profile?.role === 'staff') {
      redirect('/staff/dashboard');
    }
    redirect('/staff');
  }

  const throughputData = await fetchThroughputData();

  return (
    <AdminDashboardClient
      adminProfile={profile}
      throughputData={throughputData}
    />
  );
}
