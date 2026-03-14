'use client';

import React, { useMemo, memo } from 'react';
import { Brain, Clock, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  calculateCombinedWaitTime,
  formatWaitTime,
  calculateAverageQueueLength,
} from '@/lib/queuing-theory';
import type { EventBooth } from '@/types';

// ──────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────

interface WaitTimePredictionProps {
  queueLength: number;
  arrivalRate: number;
  booth: EventBooth | null;
}

// ──────────────────────────────────────────────
// 利用率メーター
// ──────────────────────────────────────────────

interface UtilizationMeterProps {
  utilization: number;
  isStable: boolean;
}

const UtilizationMeter = memo(function UtilizationMeter({
  utilization,
  isStable,
}: UtilizationMeterProps) {
  const percent = Math.min(100, Math.round(utilization * 100));

  const colorClass =
    percent < 50
      ? 'bg-blue-500'
      : percent < 80
      ? 'bg-yellow-400'
      : 'bg-red-500';

  const bgClass =
    percent < 50
      ? 'bg-blue-50'
      : percent < 80
      ? 'bg-yellow-50'
      : 'bg-red-50';

  return (
    <div className={`rounded-xl p-3 ${bgClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity size={14} className="text-gray-500" aria-hidden />
          <span className="text-xs font-medium text-gray-600">
            システム利用率 (ρ)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isStable ? (
            <CheckCircle size={14} className="text-green-500" aria-hidden />
          ) : (
            <AlertTriangle size={14} className="text-red-500" aria-hidden />
          )}
          <span
            className={`text-xs font-bold font-inter ${
              isStable ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {isStable ? '安定' : '不安定'}
          </span>
        </div>
      </div>

      <div className="progress-bar-track mb-1.5">
        <div
          className={`progress-bar-fill ${colorClass}`}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`利用率 ${percent}%`}
        />
      </div>

      <div className="flex justify-between">
        <span className="text-xs text-gray-500 font-inter">0%</span>
        <span className={`text-sm font-bold font-inter ${colorClass.replace('bg-', 'text-')}`}>
          {percent}%
        </span>
        <span className="text-xs text-gray-500 font-inter">100%</span>
      </div>

      {!isStable && (
        <p className="text-xs text-red-700 mt-2 flex items-start gap-1">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden />
          到着率がサービス率を超えています。行列は増大し続けます。
        </p>
      )}
    </div>
  );
});

// ──────────────────────────────────────────────
// 指標カード
// ──────────────────────────────────────────────

interface MetricItemProps {
  label: string;
  value: string;
  subtext?: string;
  accent?: boolean;
}

const MetricItem = memo(function MetricItem({
  label,
  value,
  subtext,
  accent = false,
}: MetricItemProps) {
  return (
    <div
      className={`rounded-xl p-3 border ${
        accent
          ? 'bg-blue-50 border-blue-200'
          : 'bg-gray-50 border-gray-100'
      }`}
    >
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p
        className={`text-lg font-bold font-inter leading-tight ${
          accent ? 'text-[#0056b3]' : 'text-[#0f172a]'
        }`}
      >
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>
      )}
    </div>
  );
});

// ──────────────────────────────────────────────
// 待ち時間予測パネル本体
// ──────────────────────────────────────────────

export default memo(function WaitTimePrediction({
  queueLength,
  arrivalRate,
  booth,
}: WaitTimePredictionProps) {
  const prediction = useMemo(() => {
    if (!booth) return null;
    return calculateCombinedWaitTime(
      queueLength,
      booth.service_rate,
      arrivalRate > 0 ? arrivalRate : undefined
    );
  }, [queueLength, arrivalRate, booth]);

  const avgQueueLength = useMemo(() => {
    if (!prediction) return 0;
    return calculateAverageQueueLength(prediction.mm1.utilization);
  }, [prediction]);

  if (!booth || !prediction) {
    return (
      <div className="card flex items-center justify-center py-8">
        <p className="text-sm text-gray-400">
          ブースを選択すると予測が表示されます
        </p>
      </div>
    );
  }

  const { littlesLaw, mm1, recommended } = prediction;

  return (
    <section
      className="card"
      aria-label="待ち時間予測パネル"
    >
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <Brain size={18} className="text-purple-600" aria-hidden />
        </div>
        <div>
          <h2 className="font-bold text-base text-[#0f172a]">AI 予測待ち時間</h2>
          <p className="text-xs text-gray-500">
            Little&apos;s Law + M/M/1 モデルによる算出
          </p>
        </div>
      </div>

      {/* メイン予測値 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 mb-4 text-white shadow-md">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={16} aria-hidden />
          <span className="text-sm font-medium opacity-90">予測待ち時間</span>
        </div>
        <div className="text-4xl font-bold font-inter leading-none">
          {formatWaitTime(recommended)}
        </div>
        <p className="text-xs opacity-75 mt-1">
          来場者数 {queueLength}人 / 処理能力 {booth.service_rate}人/分
        </p>
      </div>

      {/* 詳細指標グリッド */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricItem
          label="Little's Law 予測"
          value={formatWaitTime(littlesLaw)}
          subtext="W = L / λ"
          accent
        />
        <MetricItem
          label="M/M/1 モデル予測"
          value={mm1.isStable ? formatWaitTime(mm1.waitTime) : '不安定'}
          subtext="Wq = λ / (μ(μ-λ))"
        />
        <MetricItem
          label="期待行列長 (Lq)"
          value={
            isFinite(avgQueueLength)
              ? `${avgQueueLength.toFixed(1)}人`
              : '∞'
          }
          subtext="M/M/1: ρ²/(1-ρ)"
        />
        <MetricItem
          label="サービス率 (μ)"
          value={`${booth.service_rate}人/分`}
          subtext="ブース処理能力"
        />
      </div>

      {/* 利用率メーター */}
      <UtilizationMeter
        utilization={mm1.utilization}
        isStable={mm1.isStable}
      />

      {/* アルゴリズム注記 */}
      <p className="text-xs text-gray-400 text-center mt-3">
        最終予測 = M/M/1 × 70% + Little&apos;s Law × 30%
      </p>
    </section>
  );
});
