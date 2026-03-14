'use client';

import React, { useState, useCallback, useEffect, memo } from 'react';
import { HelpCircle, CheckCircle, XCircle, RefreshCw, Star, Trophy } from 'lucide-react';
import { useFestivalStore, selectQuizAccuracy } from '@/store/festivalStore';
import type { QuizQuestion, QuizCategory } from '@/types';

// ──────────────────────────────────────────────
// クイズデータ（大谷翔平 + K-POP）
// ──────────────────────────────────────────────

const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ──── 大谷翔平クイズ（5問）────
  {
    id: 'ohtani-1',
    category: 'ohtani',
    question: '大谷翔平が2023年に記録したホームラン数は？',
    answer: '44本',
  },
  {
    id: 'ohtani-2',
    category: 'ohtani',
    question: '大谷翔平が所属するチームは？（2024年〜）',
    answer: 'ロサンゼルス・ドジャース',
  },
  {
    id: 'ohtani-3',
    category: 'ohtani',
    question: '大谷が初めてMVPを受賞した年は？',
    answer: '2021年',
  },
  {
    id: 'ohtani-4',
    category: 'ohtani',
    question: '大谷翔平の投手としての最速球速は？',
    answer: '165km/h',
  },
  {
    id: 'ohtani-5',
    category: 'ohtani',
    question: '大谷翔平の背番号は？（ドジャース）',
    answer: '17番',
  },

  // ──── K-POPトレンド（5問）────
  {
    id: 'kpop-1',
    category: 'kpop',
    question: 'BTSのリーダーは誰？',
    answer: 'RM',
  },
  {
    id: 'kpop-2',
    category: 'kpop',
    question: 'BLACKPINKのメンバーは何人？',
    answer: '4人',
  },
  {
    id: 'kpop-3',
    category: 'kpop',
    question: 'NewJeansのデビュー年は？',
    answer: '2022年',
  },
  {
    id: 'kpop-4',
    category: 'kpop',
    question: 'TWICEの公式カラーは？',
    answer: 'サーモンピンク',
  },
  {
    id: 'kpop-5',
    category: 'kpop',
    question: 'aespaのAIキャラクターの名称は？',
    answer: 'æ（エイ）',
  },
];

const CATEGORY_CONFIG: Record<QuizCategory, { label: string; emoji: string; colorClass: string }> = {
  ohtani: {
    label: '大谷翔平クイズ',
    emoji: '⚾',
    colorClass: 'bg-blue-600',
  },
  kpop: {
    label: 'K-POPトレンド',
    emoji: '🎵',
    colorClass: 'bg-pink-500',
  },
};

// ──────────────────────────────────────────────
// ランダム問題選択ロジック
// ──────────────────────────────────────────────

const getRandomQuestion = (excludeIds: string[] = []): QuizQuestion => {
  const available = QUIZ_QUESTIONS.filter((q) => !excludeIds.includes(q.id));
  const pool = available.length > 0 ? available : QUIZ_QUESTIONS; // 全問回答済みならリセット
  return pool[Math.floor(Math.random() * pool.length)];
};

// ──────────────────────────────────────────────
// エンターテイメントパネル本体
// ──────────────────────────────────────────────

interface EntertainmentPanelProps {
  currentWaitMinutes: number; // 最長待ち時間（10分以上で表示）
}

export default memo(function EntertainmentPanel({
  currentWaitMinutes,
}: EntertainmentPanelProps) {
  const { quiz, setCurrentQuestion, showAnswer, recordAnswer, nextQuestion } =
    useFestivalStore();
  const accuracy = useFestivalStore(selectQuizAccuracy);

  const [userAnswer, setUserAnswer] = useState<string>('');
  const [answerAutoTimer, setAnswerAutoTimer] = useState<number | null>(null);

  // 10分以上の場合のみ表示（条件付きレンダリング）
  const shouldShow = currentWaitMinutes >= 10;

  // 初回マウント時にランダム問題を設定
  useEffect(() => {
    if (shouldShow && !quiz.currentQuestion) {
      setCurrentQuestion(getRandomQuestion());
    }
  }, [shouldShow, quiz.currentQuestion, setCurrentQuestion]);

  // 答えを表示した後、3秒後に自動的に次の問題へ
  useEffect(() => {
    if (quiz.isAnswerVisible) {
      const timer = window.setTimeout(() => {
        // タイマーはあくまで表示用。実際の次の問題移動はボタン操作を基本とする
        setAnswerAutoTimer(null);
      }, 3000);
      setAnswerAutoTimer(timer as unknown as number);
      return () => clearTimeout(timer);
    }
  }, [quiz.isAnswerVisible]);

  const handleShowAnswer = useCallback(() => {
    showAnswer();
  }, [showAnswer]);

  const handleCheckAnswer = useCallback(() => {
    if (!quiz.currentQuestion || !userAnswer.trim()) return;
    const isCorrect =
      userAnswer.trim() === quiz.currentQuestion.answer ||
      quiz.currentQuestion.answer.includes(userAnswer.trim());
    recordAnswer(isCorrect);
    showAnswer();
    setUserAnswer('');
  }, [quiz.currentQuestion, userAnswer, recordAnswer, showAnswer]);

  const handleNextQuestion = useCallback(() => {
    if (answerAutoTimer) clearTimeout(answerAutoTimer);
    const next = getRandomQuestion(quiz.answeredQuestionIds);
    nextQuestion(next);
    setUserAnswer('');
  }, [answerAutoTimer, quiz.answeredQuestionIds, nextQuestion]);

  if (!shouldShow) return null;
  if (!quiz.currentQuestion) return null;

  const catConfig = CATEGORY_CONFIG[quiz.currentQuestion.category];

  return (
    <section
      className="card border border-purple-100 bg-gradient-to-br from-white to-purple-50/30 animate-bounce-in"
      aria-label="待ち時間エンターテイメント — クイズ"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <HelpCircle size={18} className="text-purple-600" aria-hidden />
          </div>
          <div>
            <h2 className="font-bold text-sm text-[#0f172a]">
              待ち時間クイズ
            </h2>
            <p className="text-xs text-gray-500">退屈しのぎにどうぞ！</p>
          </div>
        </div>

        {/* スコア表示 */}
        {quiz.totalAttempts > 0 && (
          <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5">
            <Trophy size={14} className="text-yellow-500" aria-hidden />
            <span className="text-xs font-bold text-yellow-700 font-inter">
              {quiz.correctCount}/{quiz.totalAttempts}問正解
            </span>
            <span className="text-xs text-yellow-600">({accuracy}%)</span>
          </div>
        )}
      </div>

      {/* カテゴリバッジ */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white ${catConfig.colorClass}`}
        >
          <span>{catConfig.emoji}</span>
          <span>{catConfig.label}</span>
        </span>
      </div>

      {/* 問題文 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 shadow-sm">
        <p className="text-base font-medium text-[#0f172a] leading-relaxed">
          {quiz.currentQuestion.question}
        </p>
      </div>

      {/* 回答エリア */}
      {!quiz.isAnswerVisible ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && userAnswer.trim()) {
                  handleCheckAnswer();
                }
              }}
              placeholder="答えを入力してください..."
              className="input-field flex-1"
              aria-label="クイズの回答"
            />
            {userAnswer.trim() && (
              <button
                onClick={handleCheckAnswer}
                className="btn-primary shrink-0"
                aria-label="回答を確認する"
              >
                <CheckCircle size={16} aria-hidden />
                確認
              </button>
            )}
          </div>
          <button
            onClick={handleShowAnswer}
            className="btn-ghost w-full text-gray-500 border border-gray-200"
            aria-label="答えを表示する"
          >
            答えを見る
          </button>
        </div>
      ) : (
        /* 解答表示エリア */
        <div className="space-y-3 animate-fade-in">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} className="text-green-600" aria-hidden />
              <span className="text-sm font-bold text-green-700">正解</span>
            </div>
            <p className="text-lg font-bold text-green-800 font-inter">
              {quiz.currentQuestion.answer}
            </p>
          </div>

          <button
            onClick={handleNextQuestion}
            className="btn-primary w-full gap-2"
            aria-label="次の問題へ進む"
          >
            <RefreshCw size={16} aria-hidden />
            次の問題へ
          </button>
        </div>
      )}
    </section>
  );
});
