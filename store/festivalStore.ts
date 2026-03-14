import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  FestivalStore,
  BoothWithStatus,
  QueueSnapshot,
  LiveStats,
  QuizQuestion,
  UserProfile,
} from '@/types';
import { getCongestionLevel } from '@/types';

/**
 * FestivalFlow AI — Zustand グローバルステート
 *
 * ステート管理の責務:
 * - ブース一覧と最新の混雑状況
 * - ライブ統計集計
 * - クイズ進行状態
 * - 認証済みスタッフ情報
 * - ローディング状態
 */
export const useFestivalStore = create<FestivalStore>()(
  devtools(
    (set, get) => ({
      // ──────────────────────────────────────────────
      // ブースデータ
      // ──────────────────────────────────────────────
      booths: [],

      setBooths: (booths: BoothWithStatus[]) => {
        set({ booths }, false, 'setBooths');
      },

      updateBoothStatus: (snapshot: QueueSnapshot) => {
        const { booths } = get();
        const updatedBooths = booths.map((booth) => {
          if (booth.id !== snapshot.booth_id) return booth;

          const congestionLevel = getCongestionLevel(snapshot.predicted_wait_minutes);
          const utilization =
            snapshot.arrival_rate != null && booth.service_rate > 0
              ? Math.min(1, snapshot.arrival_rate / booth.service_rate)
              : 0;

          return {
            ...booth,
            currentQueueLength: snapshot.current_queue_length,
            currentWaitMinutes: snapshot.predicted_wait_minutes,
            arrivalRate: snapshot.arrival_rate ?? booth.arrivalRate,
            utilization,
            congestionLevel,
            totalVisitorsToday: booth.totalVisitorsToday + snapshot.current_queue_length,
          };
        });

        set({ booths: updatedBooths }, false, 'updateBoothStatus');
      },

      // ──────────────────────────────────────────────
      // ライブ統計
      // ──────────────────────────────────────────────
      liveStats: null,

      setLiveStats: (stats: LiveStats) => {
        set({ liveStats: stats }, false, 'setLiveStats');
      },

      // ──────────────────────────────────────────────
      // クイズ状態
      // ──────────────────────────────────────────────
      quiz: {
        currentQuestion: null,
        isAnswerVisible: false,
        correctCount: 0,
        totalAttempts: 0,
        answeredQuestionIds: [],
      },

      setCurrentQuestion: (question: QuizQuestion) => {
        set(
          (state) => ({
            quiz: {
              ...state.quiz,
              currentQuestion: question,
              isAnswerVisible: false,
            },
          }),
          false,
          'setCurrentQuestion'
        );
      },

      showAnswer: () => {
        set(
          (state) => ({
            quiz: {
              ...state.quiz,
              isAnswerVisible: true,
            },
          }),
          false,
          'showAnswer'
        );
      },

      recordAnswer: (isCorrect: boolean) => {
        set(
          (state) => ({
            quiz: {
              ...state.quiz,
              correctCount: state.quiz.correctCount + (isCorrect ? 1 : 0),
              totalAttempts: state.quiz.totalAttempts + 1,
              answeredQuestionIds: state.quiz.currentQuestion
                ? [
                    ...state.quiz.answeredQuestionIds,
                    state.quiz.currentQuestion.id,
                  ]
                : state.quiz.answeredQuestionIds,
            },
          }),
          false,
          'recordAnswer'
        );
      },

      nextQuestion: (question: QuizQuestion) => {
        set(
          (state) => ({
            quiz: {
              ...state.quiz,
              currentQuestion: question,
              isAnswerVisible: false,
            },
          }),
          false,
          'nextQuestion'
        );
      },

      // ──────────────────────────────────────────────
      // スタッフ認証状態
      // ──────────────────────────────────────────────
      staffUser: null,

      setStaffUser: (user: UserProfile | null) => {
        set({ staffUser: user }, false, 'setStaffUser');
      },

      // ──────────────────────────────────────────────
      // ローディング状態
      // ──────────────────────────────────────────────
      isLoadingBooths: true,

      setLoadingBooths: (loading: boolean) => {
        set({ isLoadingBooths: loading }, false, 'setLoadingBooths');
      },
    }),
    {
      name: 'festivalflow-store',
    }
  )
);

// ──────────────────────────────────────────────
// セレクター（パフォーマンス最適化）
// ──────────────────────────────────────────────

/** 混雑レベル別にブースを絞り込む */
export const selectBoothsByCongestion = (level: 'low' | 'mid' | 'high') =>
  (state: FestivalStore) =>
    state.booths.filter((b) => b.congestionLevel === level);

/** 待ち時間順にブースをソート（昇順） */
export const selectBoothsSortedByWait = (state: FestivalStore) =>
  [...state.booths].sort(
    (a, b) => a.currentWaitMinutes - b.currentWaitMinutes
  );

/** スタッフのアサインされたブースを取得 */
export const selectAssignedBooth = (state: FestivalStore) => {
  const { staffUser, booths } = state;
  if (!staffUser?.assigned_booth_id) return null;
  return (
    booths.find((b) => b.id === staffUser.assigned_booth_id) ?? null
  );
};

/** クイズ正答率を計算 */
export const selectQuizAccuracy = (state: FestivalStore): number => {
  const { correctCount, totalAttempts } = state.quiz;
  if (totalAttempts === 0) return 0;
  return Math.round((correctCount / totalAttempts) * 100);
};
