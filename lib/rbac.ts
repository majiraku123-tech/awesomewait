import type { UserRole, UserProfile } from '@/types';

/**
 * FestivalFlow AI — Role-Based Access Control (RBAC) ロジック
 *
 * 権限階層:
 * visitor (来場者) < staff (スタッフ) < admin (管理者)
 */

// ──────────────────────────────────────────────
// 権限定義
// ──────────────────────────────────────────────

/** 各ロールが持つ権限リスト */
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  visitor: [
    'view:wait_times',
    'view:booths',
    'play:quiz',
    'view:recommendations',
  ],
  staff: [
    'view:wait_times',
    'view:booths',
    'play:quiz',
    'view:recommendations',
    'update:queue_snapshot',
    'view:staff_dashboard',
    'view:own_booth',
  ],
  admin: [
    'view:wait_times',
    'view:booths',
    'play:quiz',
    'view:recommendations',
    'update:queue_snapshot',
    'view:staff_dashboard',
    'view:own_booth',
    'view:admin_dashboard',
    'view:heatmap',
    'view:analytics',
    'manage:booths',
    'manage:users',
    'view:all_booths',
  ],
};

/** 保護されたルートとその必要権限のマッピング */
const ROUTE_PERMISSIONS: Record<string, string> = {
  '/staff/dashboard': 'view:staff_dashboard',
  '/admin/dashboard': 'view:admin_dashboard',
};

/** 保護されたルートの最低ロール要件 */
const ROUTE_MIN_ROLES: Record<string, UserRole[]> = {
  '/staff/dashboard': ['staff', 'admin'],
  '/admin/dashboard': ['admin'],
};

// ──────────────────────────────────────────────
// 権限チェック関数
// ──────────────────────────────────────────────

/**
 * 指定されたロールが特定の権限を持つかチェック
 */
export const hasPermission = (role: UserRole, permission: string): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};

/**
 * 指定されたロールが対象ルートへアクセス可能かチェック
 */
export const canAccessRoute = (role: UserRole | null, pathname: string): boolean => {
  // 未認証ユーザーは保護されたルートにアクセス不可
  if (!role) {
    return !isProtectedRoute(pathname);
  }

  const allowedRoles = ROUTE_MIN_ROLES[pathname];
  if (!allowedRoles) {
    // ルートマッピングがない場合はパブリックルートとみなす
    return true;
  }

  return allowedRoles.includes(role);
};

/**
 * 指定されたパスが認証必須のルートかどうか判定
 */
export const isProtectedRoute = (pathname: string): boolean => {
  return Object.keys(ROUTE_PERMISSIONS).some((route) =>
    pathname.startsWith(route)
  );
};

/**
 * 指定されたパスが管理者専用ルートかどうか判定
 */
export const isAdminRoute = (pathname: string): boolean => {
  return pathname.startsWith('/admin');
};

/**
 * 指定されたパスがスタッフ以上のルートかどうか判定
 */
export const isStaffRoute = (pathname: string): boolean => {
  return pathname.startsWith('/staff/dashboard');
};

/**
 * ロールに基づいたリダイレクト先を返す
 *
 * @param role    ユーザーのロール（null = 未認証）
 * @param pathname 現在のパス
 * @returns       リダイレクト先パス（リダイレクト不要の場合は null）
 */
export const getRedirectPath = (
  role: UserRole | null,
  pathname: string
): string | null => {
  // 未認証でスタッフ/管理者ルートにアクセスしようとした場合
  if (!role && isProtectedRoute(pathname)) {
    return '/staff';
  }

  // スタッフが管理者ルートにアクセスしようとした場合
  if (role === 'staff' && isAdminRoute(pathname)) {
    return '/staff/dashboard';
  }

  // 認証済みユーザーがログインページにアクセスした場合
  if (role && (role === 'staff' || role === 'admin') && pathname === '/staff') {
    if (role === 'admin') return '/admin/dashboard';
    return '/staff/dashboard';
  }

  return null;
};

// ──────────────────────────────────────────────
// プロファイルベースのチェック
// ──────────────────────────────────────────────

/**
 * スタッフが特定のブースを操作可能かチェック
 * - admin は全ブースを操作可能
 * - staff は自分のアサインされたブースのみ操作可能
 */
export const canManageBooth = (
  profile: UserProfile,
  boothId: string
): boolean => {
  if (profile.role === 'admin') return true;
  if (profile.role === 'staff') {
    return profile.assigned_booth_id === boothId;
  }
  return false;
};

/**
 * ロール名を日本語で返す
 */
export const getRoleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    visitor: '来場者',
    staff: 'スタッフ',
    admin: '管理者',
  };
  return labels[role];
};
