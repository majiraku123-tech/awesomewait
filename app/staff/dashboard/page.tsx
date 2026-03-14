import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile, EventBooth } from '@/types';
import StaffDashboardClient from './StaffDashboardClient';

// ──────────────────────────────────────────────
// スタッフダッシュボード（Server Component）
// ──────────────────────────────────────────────

export default async function StaffDashboardPage() {
  const supabase = createClient();

  // 認証確認
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/staff');
  }

  // ロール確認
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, role, assigned_booth_id, created_at')
    .eq('id', user.id)
    .single<UserProfile>();

  if (profileError || !profile || !['staff', 'admin'].includes(profile.role)) {
    redirect('/staff');
  }

  // ブース一覧取得
  let boothQuery = supabase
    .from('event_booths')
    .select(
      'id, name, location_x, location_y, service_rate, satisfaction_rating, is_active, created_at'
    )
    .eq('is_active', true)
    .order('name', { ascending: true });

  // スタッフは自分のブースのみ（管理者は全ブース）
  if (profile.role === 'staff' && profile.assigned_booth_id) {
    boothQuery = boothQuery.eq('id', profile.assigned_booth_id);
  }

  const { data: booths, error: boothError } = await boothQuery;

  if (boothError) {
    console.error('[StaffDashboardPage] ブース取得エラー:', boothError);
  }

  return (
    <StaffDashboardClient
      staffProfile={profile}
      booths={(booths as EventBooth[]) ?? []}
    />
  );
}
