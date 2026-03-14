'use client';

import React, { useMemo, memo, useCallback } from 'react';
import { Sparkles, Clock, Star, TrendingDown, ArrowRight } from 'lucide-react';
import { useFestivalStore } from '@/store/festivalStore';
import type { BoothWithStatus, HiddenGemRecommendation } from '@/types';

// ──────────────────────────────────────────────
// ロードバランシングアルゴリズム
// ──────────────────────────────────────────────

/**
 * 穴場スコア計算
 *
 * スコア = 満足度ボーナス - 待ち時間ペナルティ - 人気係数
 *
 * 高いスコア = 短い待ち時間 × 高い満足度 × 適度な来場者数
 */
const calculateHiddenGemScore = (booth: BoothWithStatus): number => {
  const waitPenalty = booth.currentWaitMinutes * 2.5;
  const satisfactionBonus = booth.satisfaction_rating * 15;
  const popularityFactor = Math.log(booth.totalVisitorsToday + 1) * 3;
  return satisfactionBonus - waitPenalty - popularityFactor;
};

/**
 * スコアに基づく推奨理由テキスト生成
 */
const generateReasonText = (booth: BoothWithStatus, score: number): string => {
  const wait = Math.ceil(booth.currentWaitMinutes);
  const rating = booth.satisfaction_rating.toFixed(1);

  if (booth.currentWaitMinutes <= 0) {
    return `今すぐ入れます！満足度評価 ${rating}★ の人気ブース`;
  }
  if (booth.currentWaitMinutes < 5) {
    return `待ち時間わずか ${wait}分。高評価 ${rating}★ でコスパ最高`;
  }
  if (booth.satisfaction_rating >= 4.7) {
    return `評価 ${rating}★ の超人気ブース。今なら ${wait}分で体験可能`;
  }
  if (score > 30) {
    return `${wait}分待ちで評価 ${rating}★。今が狙い目のタイミング`;
  }
  return `評価 ${rating}★。${wait}分待ちで体験できる穴場スポット`;
};

// ──────────────────────────────────────────────
// 推奨カード（メモ化）
// ──────────────────────────────────────────────

interface RecommendationCardProps {
  recommendation: HiddenGemRecommendation;
  rank: number;
}

const RecommendationCard = memo(function RecommendationCard({
  recommendation,
  rank,
}: RecommendationCardProps) {
  const { booth, reason } = recommendation;

  const rankColors = [
    { bg: 'bg-yellow-50', border: 'border-yellow-300', badge: 'bg-yellow-400 text-white', icon: '🥇' },
    { bg: 'bg-gray-50',   border: 'border-gray-200',   badge: 'bg-gray-400 text-white',   icon: '🥈' },
    { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-400 text-white',  icon: '🥉' },
  ];

  const rankStyle = rankColors[rank - 1] ?? rankColors[2];

  return (
    <article
      className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${rankStyle.bg} ${rankStyle.border}`}
      aria-label={`おすすめ第${rank}位: ${booth.name}`}
    >
      {/* ランクバッジ + ブース名 */}
      <div className="flex items-start gap-3 mb-2">
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ${rankStyle.badge}`}
          aria-label={`第${rank}位`}
        >
          {rankStyle.icon}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-[#0f172a] truncate">
            {booth.name}
          </h3>
        </div>
      </div>

      {/* 指標グリッド */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Clock size={12} className="text-blue-500 shrink-0" aria-hidden />
          <span className="font-medium font-inter">
            {booth.currentWaitMinutes <= 0
              ? '待ちなし'
              : `${Math.ceil(booth.currentWaitMinutes)}分待ち`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Star size={12} className="text-yellow-500 shrink-0" aria-hidden />
          <span className="font-medium font-inter">
            {booth.satisfaction_rating.toFixed(1)}★
          </span>
        </div>
      </div>

      {/* 推奨理由 */}
      <div className="flex items-start gap-1.5 bg-white/70 rounded-lg p-2.5">
        <TrendingDown size={12} className="text-green-600 mt-0.5 shrink-0" aria-hidden />
        <p className="text-xs text-gray-700 leading-relaxed">{reason}</p>
      </div>
    </article>
  );
});

// ──────────────────────────────────────────────
// スマートレコメンデーション本体
// ──────────────────────────────────────────────

export default memo(function SmartRecommendation() {
  const booths = useFestivalStore((s) => s.booths);

  const recommendations = useMemo<HiddenGemRecommendation[]>(() => {
    const activeBooths = booths.filter((b) => b.is_active);

    if (activeBooths.length === 0) return [];

    return activeBooths
      .map((booth) => ({
        booth,
        score: calculateHiddenGemScore(booth),
        reason: '',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => ({
        ...item,
        reason: generateReasonText(item.booth, item.score),
      }));
  }, [booths]);

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <section
      className="card animate-fade-in"
      aria-label="AIによるおすすめ穴場ブース"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-sm">
            <Sparkles size={16} className="text-white" aria-hidden />
          </div>
          <div>
            <h2 className="font-bold text-base text-[#0f172a]">
              AI おすすめ穴場
            </h2>
            <p className="text-xs text-gray-500">
              待ち時間・満足度・人気度からスコア算出
            </p>
          </div>
        </div>
        <span className="badge badge-blue text-xs">リアルタイム</span>
      </div>

      {/* アルゴリズム説明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-bold">スコア計算式:</span>{' '}
          満足度 × 15 − 待ち時間 × 2.5 − log(累計来場者数) × 3
        </p>
      </div>

      {/* 推奨カードリスト */}
      <div className="space-y-3">
        {recommendations.map((rec, idx) => (
          <RecommendationCard
            key={rec.booth.id}
            recommendation={rec}
            rank={idx + 1}
          />
        ))}
      </div>

      {/* フッター */}
      <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-gray-400">
        <Sparkles size={11} aria-hidden />
        <span>スコアはリアルタイムデータに基づき自動更新</span>
      </div>
    </section>
  );
});
