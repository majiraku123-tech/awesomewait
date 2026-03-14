'use client';

import React, { useEffect, useMemo } from 'react';
import { RefreshCw, Wifi, AlertCircle } from 'lucide-react';
import { useFestivalStore } from '@/store/festivalStore';
import WaitTimeCard from '@/components/visitor/WaitTimeCard';
import EntertainmentPanel from '@/components/visitor/EntertainmentPanel';
import SmartRecommendation from '@/components/visitor/SmartRecommendation';
import type { BoothWithStatus } from '@/types';

interface VisitorDashboardClientProps {
  initialBooths: BoothWithStatus[];
}

export default function VisitorDashboardClient({
  initialBooths,
}: VisitorDashboardClientProps) {
  const { setBooths, setLoadingBooths, booths } = useFestivalStore();

  // 初期データをZustandストアに注入
  useEffect(() => {
    setBooths(initialBooths);
    setLoadingBooths(false);
  }, [initialBooths, setBooths, setLoadingBooths]);

  // 最長待ち時間（エンターテイメントパネル表示判定用）
  const maxWaitMinutes = useMemo(
    () =>
      booths.length > 0
        ? Math.max(...booths.map((b) => b.currentWaitMinutes))
        : 0,
    [booths]
  );

  // 混雑サマリー
  const congestionSummary = useMemo(() => {
    const active = booths.filter((b) => b.is_active);
    const low = active.filter((b) => b.congestionLevel === 'low').length;
    const mid = active.filter((b) => b.congestionLevel === 'mid').length;
    const high = active.filter((b) => b.congestionLevel === 'high').length;
    return { low, mid, high, total: active.length };
  }, [booths]);

  return (
    <div className="page-container">
      {/* ページヘッダー */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#0f172a] leading-tight">
              来場者ダッシュボード
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              各ブースの待ち時間をリアルタイムで確認できます
            </p>
          </div>
          {/* リアルタイムインジケーター */}
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden />
            <Wifi size={12} className="text-green-600" aria-hidden />
            <span className="text-xs font-medium text-green-700">ライブ</span>
          </div>
        </div>

        {/* 混雑サマリーバー */}
        {congestionSummary.total > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">ブース状況:</span>
            <span className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden />
              空き {congestionSummary.low}件
            </span>
            <span className="flex items-center gap-1.5 text-xs bg-yellow-50 text-yellow-700 px-2.5 py-1 rounded-full border border-yellow-200">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" aria-hidden />
              普通 {congestionSummary.mid}件
            </span>
            <span className="flex items-center gap-1.5 text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden />
              混雑 {congestionSummary.high}件
            </span>
          </div>
        )}
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左カラム: 待ち時間カード + エンターテイメント */}
        <div className="lg:col-span-2 space-y-6">
          {/* 待ち時間カード（Realtime対応） */}
          <WaitTimeCard />

          {/* エンターテイメントパネル（10分以上の場合のみ表示） */}
          <EntertainmentPanel currentWaitMinutes={maxWaitMinutes} />
        </div>

        {/* 右カラム: スマートレコメンデーション */}
        <div className="lg:col-span-1 space-y-6">
          <SmartRecommendation />

          {/* 使い方ガイド */}
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200">
            <h3 className="font-bold text-sm text-blue-800 mb-2 flex items-center gap-1.5">
              <RefreshCw size={14} aria-hidden />
              リアルタイム更新について
            </h3>
            <ul className="text-xs text-blue-700 space-y-1.5 leading-relaxed">
              <li>• 各ブースの待ち時間はスタッフが定期的に更新します</li>
              <li>• 画面の情報は自動的にリアルタイムで反映されます</li>
              <li>• 「おすすめ穴場」はAIが最適なブースを提案します</li>
              <li>• 待ち時間10分以上でクイズが表示されます</li>
            </ul>
          </div>

          {/* 注意事項 */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertCircle
              size={15}
              className="text-amber-500 mt-0.5 shrink-0"
              aria-hidden
            />
            <p className="text-xs text-amber-700 leading-relaxed">
              表示される待ち時間はスタッフによる手動入力に基づく予測値です。
              実際の待ち時間と異なる場合があります。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
