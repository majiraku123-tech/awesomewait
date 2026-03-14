'use client';

import React, { useEffect, useRef, useCallback, memo } from 'react';
import { Map } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useFestivalStore } from '@/store/festivalStore';
import type { HeatMapCell, QueueSnapshot } from '@/types';
import { HEATMAP_COLOR_THRESHOLDS } from '@/types';

// ──────────────────────────────────────────────
// 定数
// ──────────────────────────────────────────────

const GRID_COLS = 10;
const GRID_ROWS = 8;
const CELL_WIDTH = 48;
const CELL_HEIGHT = 40;
const UPDATE_INTERVAL_MS = 5000; // 5秒ごとに自動更新

// ──────────────────────────────────────────────
// ヒートマップカラー取得
// ──────────────────────────────────────────────

const getHeatMapColor = (percent: number): string => {
  for (const threshold of HEATMAP_COLOR_THRESHOLDS) {
    if (percent <= threshold.maxPercent) return threshold.color;
  }
  return HEATMAP_COLOR_THRESHOLDS[HEATMAP_COLOR_THRESHOLDS.length - 1].color;
};

// ──────────────────────────────────────────────
// グリッドセルデータの生成
// ──────────────────────────────────────────────

const buildHeatMapGrid = (
  booths: ReturnType<typeof useFestivalStore.getState>['booths']
): HeatMapCell[][] => {
  // 空のグリッドを初期化
  const grid: HeatMapCell[][] = Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => ({
      x,
      y,
      congestionPercent: 0,
      boothId: null,
      boothName: null,
    }))
  );

  // ブースデータをグリッドに配置
  booths.forEach((booth) => {
    const { location_x: x, location_y: y } = booth;
    if (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS) {
      // 混雑度パーセント = (待ち時間 / 最大60分) × 100
      const congestionPercent = Math.min(
        100,
        (booth.currentWaitMinutes / 60) * 100
      );
      grid[y][x] = {
        x,
        y,
        congestionPercent,
        boothId: booth.id,
        boothName: booth.name,
      };
    }
  });

  return grid;
};

// ──────────────────────────────────────────────
// SVG セルコンポーネント（メモ化）
// ──────────────────────────────────────────────

interface HeatMapCellSvgProps {
  cell: HeatMapCell;
  cellWidth: number;
  cellHeight: number;
}

const HeatMapCellSvg = memo(function HeatMapCellSvg({
  cell,
  cellWidth,
  cellHeight,
}: HeatMapCellSvgProps) {
  const { x, y, congestionPercent, boothName } = cell;
  const fillColor = getHeatMapColor(congestionPercent);
  const hasData = boothName !== null;

  const cx = x * cellWidth + cellWidth / 2;
  const cy = y * cellHeight + cellHeight / 2;

  return (
    <g key={`cell-${x}-${y}`} role="img" aria-label={boothName ? `${boothName}: 混雑度${Math.round(congestionPercent)}%` : `エリア (${x},${y})`}>
      {/* セル背景 */}
      <rect
        x={x * cellWidth + 1}
        y={y * cellHeight + 1}
        width={cellWidth - 2}
        height={cellHeight - 2}
        fill={fillColor}
        rx={4}
        ry={4}
        stroke={hasData ? 'rgba(0,86,179,0.2)' : 'rgba(0,0,0,0.05)'}
        strokeWidth={hasData ? 1.5 : 0.5}
        style={{ transition: 'fill 0.5s ease' }}
      />

      {/* ブース名（テキスト） */}
      {hasData && boothName && (
        <text
          x={cx}
          y={cy - 3}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.min(9, cellWidth / 5.5)}
          fontFamily="'Noto Sans JP', sans-serif"
          fontWeight="600"
          fill="rgba(15,23,42,0.9)"
          clipPath={`url(#clip-${x}-${y})`}
          pointerEvents="none"
        >
          {boothName.length > 7 ? boothName.slice(0, 6) + '…' : boothName}
        </text>
      )}

      {/* 混雑度パーセント */}
      {hasData && (
        <text
          x={cx}
          y={cy + 9}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fontFamily="'Inter', sans-serif"
          fontWeight="700"
          fill={congestionPercent > 60 ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.7)'}
          pointerEvents="none"
        >
          {Math.round(congestionPercent)}%
        </text>
      )}

      {/* アクセシビリティ用 title タグ */}
      <title>
        {boothName
          ? `${boothName} — 混雑度: ${Math.round(congestionPercent)}%`
          : `エリア (${x}, ${y})`}
      </title>

      {/* クリップパス定義 */}
      <clipPath id={`clip-${x}-${y}`}>
        <rect
          x={x * cellWidth + 2}
          y={y * cellHeight + 2}
          width={cellWidth - 4}
          height={cellHeight - 4}
        />
      </clipPath>
    </g>
  );
});

// ──────────────────────────────────────────────
// ヒートマップ本体
// ──────────────────────────────────────────────

export default function HeatMap() {
  const supabase = createClient();
  const booths = useFestivalStore((s) => s.booths);
  const updateBoothStatus = useFestivalStore((s) => s.updateBoothStatus);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const grid = buildHeatMapGrid(booths);

  const svgWidth = GRID_COLS * CELL_WIDTH;
  const svgHeight = GRID_ROWS * CELL_HEIGHT;

  // Supabase Realtime 購読 + 5秒ごと自動更新
  const subscribeAndPoll = useCallback(() => {
    // Realtime 購読
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    channelRef.current = supabase
      .channel('heatmap-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'queue_snapshots',
        },
        (payload) => {
          updateBoothStatus(payload.new as QueueSnapshot);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [supabase, updateBoothStatus]);

  useEffect(() => {
    const cleanup = subscribeAndPoll();
    return cleanup;
  }, [subscribeAndPoll]);

  return (
    <section className="card" aria-label="校内混雑リアルタイムヒートマップ">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Map size={18} className="text-[#0056b3]" aria-hidden />
          </div>
          <div>
            <h2 className="font-bold text-base text-[#0f172a]">
              校内混雑ヒートマップ
            </h2>
            <p className="text-xs text-gray-500">
              リアルタイム更新 — SVGグリッド {GRID_COLS}×{GRID_ROWS}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden />
          <span className="text-xs text-gray-500">ライブ</span>
        </div>
      </div>

      {/* SVGヒートマップ */}
      <div className="overflow-x-auto" role="img" aria-label="校内ヒートマップ — 色が濃いほど混雑">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="block mx-auto"
          style={{ maxWidth: '100%', height: 'auto' }}
          aria-label="文化祭会場ヒートマップ"
        >
          {/* グリッド背景 */}
          <rect
            width={svgWidth}
            height={svgHeight}
            fill="#f8fafc"
            rx={8}
            ry={8}
          />

          {/* セルのレンダリング */}
          {grid.flatMap((row) =>
            row.map((cell) => (
              <HeatMapCellSvg
                key={`${cell.x}-${cell.y}`}
                cell={cell}
                cellWidth={CELL_WIDTH}
                cellHeight={CELL_HEIGHT}
              />
            ))
          )}

          {/* グリッドライン（補助線） */}
          {Array.from({ length: GRID_COLS + 1 }, (_, i) => (
            <line
              key={`vline-${i}`}
              x1={i * CELL_WIDTH}
              y1={0}
              x2={i * CELL_WIDTH}
              y2={svgHeight}
              stroke="rgba(0,0,0,0.05)"
              strokeWidth={0.5}
            />
          ))}
          {Array.from({ length: GRID_ROWS + 1 }, (_, i) => (
            <line
              key={`hline-${i}`}
              x1={0}
              y1={i * CELL_HEIGHT}
              x2={svgWidth}
              y2={i * CELL_HEIGHT}
              stroke="rgba(0,0,0,0.05)"
              strokeWidth={0.5}
            />
          ))}
        </svg>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500 font-medium">混雑度:</span>
        {[
          { color: '#dbeafe', label: '0〜20%（空き）' },
          { color: '#fef08a', label: '21〜50%（普通）' },
          { color: '#fb923c', label: '51〜80%（混雑）' },
          { color: '#ef4444', label: '81〜100%（過密）' },
        ].map(({ color, label }) => (
          <span key={color} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-4 h-3 rounded shrink-0"
              style={{ backgroundColor: color, border: '1px solid rgba(0,0,0,0.1)' }}
              aria-hidden
            />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
