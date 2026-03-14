'use client';

import React, { memo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import type { ThroughputDataPoint } from '@/types';

// ──────────────────────────────────────────────
// デモデータ生成（実際の環境では Supabase のビューから取得）
// ──────────────────────────────────────────────

const generateDemoData = (): ThroughputDataPoint[] => {
  const slots: ThroughputDataPoint[] = [];
  const startHour = 9;
  const slotCount = 16; // 9:00〜17:00（30分刻み）

  const baseVisitors = [
    20, 45, 80, 120, 160, 200, 240, 210,
    185, 165, 190, 220, 200, 170, 130, 80,
  ];
  const baseWait = [
    3, 6, 10, 14, 18, 22, 25, 20,
    17, 15, 18, 21, 19, 15, 12, 8,
  ];

  for (let i = 0; i < slotCount; i++) {
    const totalMinutes = (startHour * 60) + i * 30;
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');

    const visitors = baseVisitors[i] + Math.floor(Math.random() * 20 - 10);
    const avgWait = Math.max(0, baseWait[i] + (Math.random() * 4 - 2));

    slots.push({
      time: `${hh}:${mm}`,
      visitors: Math.max(0, visitors),
      avgWait: Math.round(avgWait * 10) / 10,
      throughput: Math.round(visitors * 0.85),
    });
  }

  return slots;
};

// ──────────────────────────────────────────────
// カスタムTooltip（日本語）
// ──────────────────────────────────────────────

interface CustomTooltipProps extends TooltipProps<number, string> {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

const CustomTooltip = memo(function CustomTooltip({
  active,
  payload,
  label,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const labelMap: Record<string, string> = {
    visitors: '来場者数',
    avgWait: '平均待ち時間',
    throughput: '処理済み人数',
  };

  const unitMap: Record<string, string> = {
    visitors: '人',
    avgWait: '分',
    throughput: '人',
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[160px]"
      role="tooltip"
    >
      <p className="text-xs font-bold text-gray-600 mb-2 pb-1.5 border-b border-gray-100 font-inter">
        🕐 {label}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center justify-between gap-3 py-0.5"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="text-xs text-gray-600">
              {labelMap[entry.dataKey] ?? entry.name}
            </span>
          </div>
          <span className="text-xs font-bold text-gray-800 font-inter">
            {typeof entry.value === 'number'
              ? entry.value.toLocaleString()
              : entry.value}
            {unitMap[entry.dataKey] ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
});

// ──────────────────────────────────────────────
// スループットグラフ本体
// ──────────────────────────────────────────────

interface ThroughputChartProps {
  data?: ThroughputDataPoint[];
}

export default memo(function ThroughputChart({ data }: ThroughputChartProps) {
  const chartData = data ?? generateDemoData();

  return (
    <section className="card" aria-label="来場者スループット時系列グラフ">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <BarChart2 size={18} className="text-[#ff8c00]" aria-hidden />
          </div>
          <div>
            <h2 className="font-bold text-base text-[#0f172a]">
              来場者スループット分析
            </h2>
            <p className="text-xs text-gray-500">
              30分刻み時系列データ — Recharts ComposedChart
            </p>
          </div>
        </div>

        {/* 凡例インジケーター */}
        <div className="hidden sm:flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm bg-[#0056b3]" aria-hidden />
            来場者数
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-0.5 bg-[#ff8c00]" aria-hidden />
            待ち時間
          </span>
        </div>
      </div>

      {/* Recharts ComposedChart */}
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 48, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />

          {/* X軸: 30分刻み時間帯 */}
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval={1}
          />

          {/* Y軸左: 来場者数 */}
          <YAxis
            yAxisId="left"
            orientation="left"
            tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}人`}
          />

          {/* Y軸右: 待ち時間（分） */}
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}分`}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{
              fontSize: '12px',
              fontFamily: 'Noto Sans JP, sans-serif',
              paddingTop: '12px',
            }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                visitors: '来場者数',
                avgWait: '平均待ち時間（分）',
                throughput: '処理済み人数',
              };
              return labels[value] ?? value;
            }}
          />

          {/* Bar: 来場者数（Primary Blue） */}
          <Bar
            yAxisId="left"
            dataKey="visitors"
            fill="#0056b3"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
            opacity={0.85}
          />

          {/* Bar: 処理済み人数（薄い青） */}
          <Bar
            yAxisId="left"
            dataKey="throughput"
            fill="#93c5fd"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
            opacity={0.7}
          />

          {/* Line: 平均待ち時間（Accent Orange） */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgWait"
            stroke="#ff8c00"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#ff8c00', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#ff8c00', strokeWidth: 2, stroke: '#fff' }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* サマリー統計 */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-gray-100">
        {[
          {
            label: '総来場者数',
            value: `${chartData.reduce((sum, d) => sum + d.visitors, 0).toLocaleString()}人`,
          },
          {
            label: '平均待ち時間',
            value: `${(chartData.reduce((sum, d) => sum + d.avgWait, 0) / chartData.length).toFixed(1)}分`,
          },
          {
            label: '総処理人数',
            value: `${chartData.reduce((sum, d) => sum + d.throughput, 0).toLocaleString()}人`,
          },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className="text-base font-bold font-inter text-[#0f172a]">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
});
