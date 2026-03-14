// ============================================================
// FestivalFlow AI — 全TypeScript型定義
// ============================================================

// ──────────────────────────────────────────────
// ユーザー・認証関連
// ──────────────────────────────────────────────

export type UserRole = 'visitor' | 'staff' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  assigned_booth_id: string | null;
  created_at: string;
}

// ──────────────────────────────────────────────
// イベントブース
// ──────────────────────────────────────────────

export interface EventBooth {
  id: string;
  name: string;
  location_x: number;
  location_y: number;
  service_rate: number;        // μ: 処理能力（人/分）
  satisfaction_rating: number;
  is_active: boolean;
  created_at: string;
}

// ブース + 最新スナップショットを結合したビュー型
export interface BoothWithStatus extends EventBooth {
  currentQueueLength: number;
  currentWaitMinutes: number;
  arrivalRate: number;
  utilization: number;
  congestionLevel: CongestionLevel;
  totalVisitorsToday: number;
}

// ──────────────────────────────────────────────
// 行列スナップショット
// ──────────────────────────────────────────────

export interface QueueSnapshot {
  id: string;
  booth_id: string;
  staff_id: string;
  current_queue_length: number;
  predicted_wait_minutes: number;
  arrival_rate: number | null;
  recorded_at: string;
}

// スタッフが送信するフォームデータ
export interface QueueInputPayload {
  booth_id: string;
  current_queue_length: number;
  arrival_rate?: number;
}

// ──────────────────────────────────────────────
// 来場者ログ
// ──────────────────────────────────────────────

export interface VisitorLog {
  id: string;
  booth_id: string;
  visitor_count: number;
  logged_at: string;
}

// ──────────────────────────────────────────────
// 混雑レベル
// ──────────────────────────────────────────────

export type CongestionLevel = 'low' | 'mid' | 'high';

export interface CongestionConfig {
  level: CongestionLevel;
  label: string;
  colorClass: string;
  bgColorClass: string;
  textColorClass: string;
  progressColor: string;
}

export const CONGESTION_CONFIG: Record<CongestionLevel, CongestionConfig> = {
  low: {
    level: 'low',
    label: '空いています',
    colorClass: 'border-blue-400',
    bgColorClass: 'bg-blue-50',
    textColorClass: 'text-blue-700',
    progressColor: 'bg-blue-500',
  },
  mid: {
    level: 'mid',
    label: '普通',
    colorClass: 'border-yellow-400',
    bgColorClass: 'bg-yellow-50',
    textColorClass: 'text-yellow-700',
    progressColor: 'bg-yellow-400',
  },
  high: {
    level: 'high',
    label: '混雑中',
    colorClass: 'border-red-400',
    bgColorClass: 'bg-red-50',
    textColorClass: 'text-red-700',
    progressColor: 'bg-red-500',
  },
};

export const getCongestionLevel = (waitMinutes: number): CongestionLevel => {
  if (waitMinutes < 10) return 'low';
  if (waitMinutes < 20) return 'mid';
  return 'high';
};

// ──────────────────────────────────────────────
// クイズ（エンターテイメントパネル）
// ──────────────────────────────────────────────

export type QuizCategory = 'ohtani' | 'kpop';

export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  question: string;
  answer: string;
  options?: string[];
}

// ──────────────────────────────────────────────
// スマートレコメンデーション
// ──────────────────────────────────────────────

export interface HiddenGemRecommendation {
  booth: BoothWithStatus;
  score: number;
  reason: string;
}

// ──────────────────────────────────────────────
// ヒートマップ
// ──────────────────────────────────────────────

export interface HeatMapCell {
  x: number;
  y: number;
  congestionPercent: number; // 0〜100
  boothId: string | null;
  boothName: string | null;
}

export type HeatMapColorThreshold = {
  maxPercent: number;
  color: string;
};

export const HEATMAP_COLOR_THRESHOLDS: HeatMapColorThreshold[] = [
  { maxPercent: 20,  color: '#dbeafe' },
  { maxPercent: 50,  color: '#fef08a' },
  { maxPercent: 80,  color: '#fb923c' },
  { maxPercent: 100, color: '#ef4444' },
];

// ──────────────────────────────────────────────
// スループットグラフ
// ──────────────────────────────────────────────

export interface ThroughputDataPoint {
  time: string;       // "09:00", "09:30", ...
  visitors: number;   // その時間帯の来場者数
  avgWait: number;    // 平均待ち時間（分）
  throughput: number; // 処理済み人数
}

// ──────────────────────────────────────────────
// ライブ統計
// ──────────────────────────────────────────────

export interface LiveStats {
  totalCurrentVisitors: number;
  overallAvgWaitMinutes: number;
  mostCongestedBoothName: string;
  mostCongestedQueueLength: number;
  systemUtilization: number; // ρ（ロー）= avg(λ/μ)
}

// ──────────────────────────────────────────────
// 待ち行列理論
// ──────────────────────────────────────────────

export interface MM1Result {
  waitTime: number;
  utilization: number;
  isStable: boolean;
}

export interface WaitTimePredictionResult {
  littlesLaw: number;
  mm1: MM1Result;
  recommended: number; // 最終的に表示する予測値
}

// ──────────────────────────────────────────────
// Supabase Realtime ペイロード
// ──────────────────────────────────────────────

export interface RealtimeQueuePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: QueueSnapshot;
  old: Partial<QueueSnapshot>;
  schema: string;
  table: string;
}

// ──────────────────────────────────────────────
// フォーム入力
// ──────────────────────────────────────────────

export interface StaffLoginFormValues {
  email: string;
  password: string;
}

export interface QueueFormValues {
  boothId: string;
  queueLength: number;
  arrivalRate: number;
}

// ──────────────────────────────────────────────
// エラー
// ──────────────────────────────────────────────

export interface AppError {
  code: string;
  message: string;
  details?: string;
}

// ──────────────────────────────────────────────
// Zustand ストア型
// ──────────────────────────────────────────────

export interface QuizState {
  currentQuestion: QuizQuestion | null;
  isAnswerVisible: boolean;
  correctCount: number;
  totalAttempts: number;
  answeredQuestionIds: string[];
}

export interface FestivalStore {
  // ブースデータ
  booths: BoothWithStatus[];
  setBooths: (booths: BoothWithStatus[]) => void;
  updateBoothStatus: (snapshot: QueueSnapshot) => void;

  // ライブ統計
  liveStats: LiveStats | null;
  setLiveStats: (stats: LiveStats) => void;

  // クイズ状態
  quiz: QuizState;
  setCurrentQuestion: (question: QuizQuestion) => void;
  showAnswer: () => void;
  recordAnswer: (isCorrect: boolean) => void;
  nextQuestion: (question: QuizQuestion) => void;

  // スタッフ認証状態
  staffUser: UserProfile | null;
  setStaffUser: (user: UserProfile | null) => void;

  // ローディング状態
  isLoadingBooths: boolean;
  setLoadingBooths: (loading: boolean) => void;
}
