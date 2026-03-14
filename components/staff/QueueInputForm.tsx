'use client';

import React, { useState, useCallback, useTransition, memo } from 'react';
import {
  Send, Loader2, CheckCircle, AlertCircle,
  Users, Hash, TrendingUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useFestivalStore } from '@/store/festivalStore';
import { canManageBooth } from '@/lib/rbac';
import {
  calculateCombinedWaitTime,
  estimateArrivalRate,
} from '@/lib/queuing-theory';
import type { EventBooth, UserProfile, QueueFormValues } from '@/types';

// ──────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────

interface QueueInputFormProps {
  staffProfile: UserProfile;
  booths: EventBooth[];
}

type SubmitStatus = 'idle' | 'success' | 'error';

// ──────────────────────────────────────────────
// 行列入力フォーム
// ──────────────────────────────────────────────

export default memo(function QueueInputForm({
  staffProfile,
  booths,
}: QueueInputFormProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [formValues, setFormValues] = useState<QueueFormValues>({
    boothId:
      staffProfile.assigned_booth_id ??
      (booths.length > 0 ? booths[0].id : ''),
    queueLength: 0,
    arrivalRate: 0,
  });

  const [lastQueueLength, setLastQueueLength] = useState<number>(0);
  const [lastRecordedAt, setLastRecordedAt] = useState<Date | null>(null);

  // 選択中のブース
  const selectedBooth = booths.find((b) => b.id === formValues.boothId);

  // スタッフがこのブースを操作できるか確認
  const canManage = selectedBooth
    ? canManageBooth(staffProfile, selectedBooth.id)
    : false;

  // 待ち時間予測の即座計算
  const prediction = selectedBooth
    ? (() => {
        const intervalMinutes =
          lastRecordedAt
            ? (Date.now() - lastRecordedAt.getTime()) / 60000
            : 5; // デフォルト5分間隔

        const estimatedArrival =
          formValues.arrivalRate > 0
            ? formValues.arrivalRate
            : estimateArrivalRate(
                lastQueueLength,
                formValues.queueLength,
                intervalMinutes,
                selectedBooth.service_rate
              );

        return calculateCombinedWaitTime(
          formValues.queueLength,
          selectedBooth.service_rate,
          estimatedArrival
        );
      })()
    : null;

  const handleFieldChange = useCallback(
    <K extends keyof QueueFormValues>(field: K, value: QueueFormValues[K]) => {
      setFormValues((prev) => ({ ...prev, [field]: value }));
      setSubmitStatus('idle');
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!selectedBooth) {
        setErrorMessage('ブースを選択してください');
        setSubmitStatus('error');
        return;
      }

      if (!canManage) {
        setErrorMessage('このブースの更新権限がありません');
        setSubmitStatus('error');
        return;
      }

      if (formValues.queueLength < 0) {
        setErrorMessage('行列人数は0以上を入力してください');
        setSubmitStatus('error');
        return;
      }

      startTransition(async () => {
        setSubmitStatus('idle');
        setErrorMessage('');

        const intervalMinutes =
          lastRecordedAt
            ? (Date.now() - lastRecordedAt.getTime()) / 60000
            : 5;

        const estimatedArrival =
          formValues.arrivalRate > 0
            ? formValues.arrivalRate
            : estimateArrivalRate(
                lastQueueLength,
                formValues.queueLength,
                intervalMinutes,
                selectedBooth.service_rate
              );

        const combined = calculateCombinedWaitTime(
          formValues.queueLength,
          selectedBooth.service_rate,
          estimatedArrival
        );

        const predictedWait = Math.max(0, combined.recommended);

        const { error } = await supabase.from('queue_snapshots').insert({
          booth_id: formValues.boothId,
          staff_id: staffProfile.id,
          current_queue_length: formValues.queueLength,
          predicted_wait_minutes: predictedWait,
          arrival_rate: estimatedArrival > 0 ? estimatedArrival : null,
        });

        if (error) {
          console.error('[QueueInputForm] 送信エラー:', error);
          setErrorMessage(
            error.message.includes('violates row-level security')
              ? 'このブースの更新権限がありません'
              : `送信に失敗しました: ${error.message}`
          );
          setSubmitStatus('error');
          return;
        }

        // 成功処理
        setLastQueueLength(formValues.queueLength);
        setLastRecordedAt(new Date());
        setSubmitStatus('success');

        // 3秒後にステータスをリセット
        setTimeout(() => setSubmitStatus('idle'), 3000);
      });
    },
    [
      selectedBooth,
      canManage,
      formValues,
      lastQueueLength,
      lastRecordedAt,
      staffProfile.id,
      supabase,
    ]
  );

  return (
    <section
      className="card"
      aria-label="行列人数入力フォーム"
    >
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <Users size={18} className="text-[#0056b3]" aria-hidden />
        </div>
        <div>
          <h2 className="font-bold text-base text-[#0f172a]">行列人数を入力</h2>
          <p className="text-xs text-gray-500">
            現在の行列状況をリアルタイムで更新します
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4">
          {/* ブース選択 */}
          <div>
            <label
              htmlFor="booth-select"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              担当ブース
            </label>
            <select
              id="booth-select"
              value={formValues.boothId}
              onChange={(e) => handleFieldChange('boothId', e.target.value)}
              className="input-field"
              disabled={
                staffProfile.role === 'staff' &&
                staffProfile.assigned_booth_id !== null
              }
              aria-describedby="booth-select-hint"
            >
              {booths.map((booth) => (
                <option key={booth.id} value={booth.id}>
                  {booth.name}
                  {staffProfile.assigned_booth_id === booth.id ? ' ★担当' : ''}
                </option>
              ))}
            </select>
            {staffProfile.role === 'staff' && staffProfile.assigned_booth_id && (
              <p
                id="booth-select-hint"
                className="text-xs text-gray-500 mt-1"
              >
                担当ブース固定（管理者に変更を依頼してください）
              </p>
            )}
          </div>

          {/* 行列人数入力 */}
          <div>
            <label
              htmlFor="queue-length"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              現在の行列人数
              <span className="text-red-500 ml-1" aria-label="必須">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Hash size={16} className="text-gray-400" aria-hidden />
              </div>
              <input
                id="queue-length"
                type="number"
                min="0"
                max="999"
                step="1"
                value={formValues.queueLength === 0 ? '' : formValues.queueLength}
                onChange={(e) =>
                  handleFieldChange(
                    'queueLength',
                    Math.max(0, parseInt(e.target.value, 10) || 0)
                  )
                }
                placeholder="0"
                className="input-field pl-9 font-inter"
                required
                aria-label="行列に並んでいる人数"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                人
              </span>
            </div>
          </div>

          {/* 到着率（任意入力） */}
          <div>
            <label
              htmlFor="arrival-rate"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              到着率（λ）
              <span className="text-xs text-gray-400 ml-1.5 font-normal">
                任意 — 空欄で自動推定
              </span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <TrendingUp size={16} className="text-gray-400" aria-hidden />
              </div>
              <input
                id="arrival-rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formValues.arrivalRate === 0 ? '' : formValues.arrivalRate}
                onChange={(e) =>
                  handleFieldChange(
                    'arrivalRate',
                    parseFloat(e.target.value) || 0
                  )
                }
                placeholder="自動計算"
                className="input-field pl-9 font-inter"
                aria-label="1分あたりの来場者到着率"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                人/分
              </span>
            </div>
          </div>

          {/* 権限警告 */}
          {!canManage && selectedBooth && (
            <div
              className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3"
              role="alert"
            >
              <AlertCircle
                size={16}
                className="text-red-500 mt-0.5 shrink-0"
                aria-hidden
              />
              <p className="text-sm text-red-700">
                このブースの更新権限がありません。担当ブースのみ操作できます。
              </p>
            </div>
          )}

          {/* エラーメッセージ */}
          {submitStatus === 'error' && (
            <div
              className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3"
              role="alert"
            >
              <AlertCircle
                size={16}
                className="text-red-500 mt-0.5 shrink-0"
                aria-hidden
              />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          {/* 成功メッセージ */}
          {submitStatus === 'success' && (
            <div
              className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 animate-fade-in"
              role="status"
              aria-live="polite"
            >
              <CheckCircle size={16} className="text-green-600 shrink-0" aria-hidden />
              <p className="text-sm text-green-700 font-medium">
                行列情報を更新しました ✓
              </p>
            </div>
          )}

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={isPending || !canManage || !selectedBooth}
            className="btn-primary w-full"
            aria-label="行列情報を送信する"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                送信中...
              </>
            ) : (
              <>
                <Send size={16} aria-hidden />
                行列情報を更新する
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
});
