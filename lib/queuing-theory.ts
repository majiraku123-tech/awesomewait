/**
 * FestivalFlow AI — 待ち行列理論ライブラリ
 *
 * 実装アルゴリズム:
 * 1. Little's Law: W = L / λ
 * 2. M/M/1 待ち行列モデル: Wq = λ / (μ(μ - λ))
 *
 * 参考文献:
 * - Little, J.D.C. (1961). "A Proof for the Queuing Formula: L = λW"
 * - Kleinrock, L. (1975). "Queuing Systems, Volume 1: Theory"
 */

import type { MM1Result, WaitTimePredictionResult } from '@/types';

// ──────────────────────────────────────────────
// Little's Law: W = L / λ
// ──────────────────────────────────────────────

/**
 * Little's Law による待ち時間計算
 *
 * @param queueLength  L: 現在の行列人数
 * @param serviceRate  λ: 処理能力（人/分）
 * @returns            W: 推定待ち時間（分）
 *
 * 安定条件: serviceRate > 0
 * queueLength = 0 の場合は 0 を返す
 */
export const calculateWaitTimeLittlesLaw = (
  queueLength: number,
  serviceRate: number
): number => {
  if (serviceRate <= 0) return Infinity;
  if (queueLength <= 0) return 0;
  return queueLength / serviceRate;
};

// ──────────────────────────────────────────────
// M/M/1 待ち行列モデル: Wq = λ / (μ(μ - λ))
// ──────────────────────────────────────────────

/**
 * M/M/1 待ち行列モデルによる高精度予測
 *
 * 前提:
 * - 到着過程: ポアソン過程（指数分布の到着間隔）
 * - サービス時間: 指数分布
 * - サーバー数: 1
 * - 待合スペース: 無限大（FCFS規律）
 *
 * @param arrivalRate  λ: 到着率（人/分）
 * @param serviceRate  μ: サービス率（人/分）
 * @returns            { waitTime, utilization, isStable }
 *
 * 安定条件: ρ = λ/μ < 1（利用率が100%未満）
 */
export const calculateWaitTimeMM1 = (
  arrivalRate: number,
  serviceRate: number
): MM1Result => {
  if (serviceRate <= 0) {
    return { waitTime: Infinity, utilization: Infinity, isStable: false };
  }
  if (arrivalRate <= 0) {
    return { waitTime: 0, utilization: 0, isStable: true };
  }

  const rho = arrivalRate / serviceRate; // 利用率 ρ

  if (rho >= 1) {
    // 不安定状態: 到着率がサービス率を超えており、行列は無限に増大する
    return { waitTime: Infinity, utilization: rho, isStable: false };
  }

  // M/M/1 の行列内待ち時間（系内時間ではなく行列待ち時間）
  // Wq = λ / (μ(μ - λ))
  const waitTime = arrivalRate / (serviceRate * (serviceRate - arrivalRate));

  return {
    waitTime,
    utilization: rho,
    isStable: true,
  };
};

// ──────────────────────────────────────────────
// 複合予測: Little's Law + M/M/1 の加重平均
// ──────────────────────────────────────────────

/**
 * Little's Law と M/M/1 を組み合わせた統合予測
 *
 * データ信頼度に基づき加重平均を計算:
 * - 到着率データが利用可能 → M/M/1 に70%の重みを付与
 * - データ不足 → Little's Law のみ使用
 *
 * @param queueLength  現在の行列人数
 * @param serviceRate  μ: サービス率（人/分）
 * @param arrivalRate  λ: 到着率（人/分）。undefined の場合は Little's Law のみ使用
 * @returns            統合予測結果
 */
export const calculateCombinedWaitTime = (
  queueLength: number,
  serviceRate: number,
  arrivalRate?: number
): WaitTimePredictionResult => {
  const littlesLawResult = calculateWaitTimeLittlesLaw(queueLength, serviceRate);

  if (arrivalRate === undefined || arrivalRate <= 0) {
    return {
      littlesLaw: littlesLawResult,
      mm1: { waitTime: littlesLawResult, utilization: 0, isStable: true },
      recommended: littlesLawResult,
    };
  }

  const mm1Result = calculateWaitTimeMM1(arrivalRate, serviceRate);

  let recommended: number;

  if (!mm1Result.isStable) {
    // M/M/1 が不安定な場合は Little's Law の2倍（保守的見積もり）
    recommended = Math.min(littlesLawResult * 2, 120);
  } else {
    // 加重平均: M/M/1 に70%、Little's Law に30%の重みを付与
    recommended = mm1Result.waitTime * 0.7 + littlesLawResult * 0.3;
  }

  return {
    littlesLaw: littlesLawResult,
    mm1: mm1Result,
    recommended: Math.max(0, recommended),
  };
};

// ──────────────────────────────────────────────
// ユーティリティ関数
// ──────────────────────────────────────────────

/**
 * 待ち時間を分単位の文字列にフォーマット
 *
 * @param minutes  待ち時間（分）
 * @returns        表示用文字列（例: "約15分", "1時間以上", "待ちなし"）
 */
export const formatWaitTime = (minutes: number): string => {
  if (!isFinite(minutes) || minutes > 120) return '1時間以上';
  if (minutes <= 0) return '待ちなし';
  if (minutes < 1) return '約1分';
  return `約${Math.ceil(minutes)}分`;
};

/**
 * 到着率（λ）を推定
 *
 * 直近2回のスナップショットの差分から到着率を計算:
 * λ = ΔL / Δt（但し Δt は分単位）
 *
 * @param prevQueueLength  前回の行列人数
 * @param currQueueLength  今回の行列人数
 * @param intervalMinutes  計測間隔（分）
 * @param serviceRate      μ: サービス率（人/分）
 * @returns                推定到着率（人/分）
 */
export const estimateArrivalRate = (
  prevQueueLength: number,
  currQueueLength: number,
  intervalMinutes: number,
  serviceRate: number
): number => {
  if (intervalMinutes <= 0) return serviceRate * 0.8; // デフォルト: 利用率80%と仮定

  // 行列長の変化 = 到着数 - サービス完了数
  // ΔL = λΔt - μΔt → λ = (ΔL/Δt) + μ
  const queueDelta = currQueueLength - prevQueueLength;
  const estimatedArrivalRate = queueDelta / intervalMinutes + serviceRate;

  // 物理的に不正な値（負の到着率）をクランプ
  return Math.max(0.1, estimatedArrivalRate);
};

/**
 * システム利用率 ρ の計算
 *
 * @param arrivalRate  λ: 到着率（人/分）
 * @param serviceRate  μ: サービス率（人/分）
 * @returns            利用率 ρ（0〜1の範囲にクランプ）
 */
export const calculateUtilization = (
  arrivalRate: number,
  serviceRate: number
): number => {
  if (serviceRate <= 0) return 1;
  return Math.min(1, arrivalRate / serviceRate);
};

/**
 * 平均行列長 Lq の計算（M/M/1）
 *
 * Lq = ρ² / (1 - ρ)
 *
 * @param utilization  ρ: 利用率
 * @returns            平均行列長
 */
export const calculateAverageQueueLength = (utilization: number): number => {
  if (utilization >= 1) return Infinity;
  if (utilization <= 0) return 0;
  return (utilization * utilization) / (1 - utilization);
};
