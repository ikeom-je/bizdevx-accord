"use client";

import { useState, useTransition } from "react";

import { transitionStageAction } from "@/app/projects/[id]/stages/[sid]/actions";
import { canTransition } from "@/domain/stage";
import type { StageStatus } from "@/domain/types";

const STATUS_LABEL: Record<StageStatus, string> = {
  not_started: "未着手",
  in_progress: "進行中",
  done: "完了",
  needs_update: "要更新",
};

const ALL_STATUSES: StageStatus[] = ["not_started", "in_progress", "done", "needs_update"];

export function StageTransitionControls({
  stageInstanceId,
  status,
  reopenWarning,
  upstreamDone,
}: {
  stageInstanceId: string;
  status: StageStatus;
  reopenWarning: boolean;
  upstreamDone: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<StageStatus | null>(null);
  const [backpropConfirmed, setBackpropConfirmed] = useState(false);

  const nextStatuses = ALL_STATUSES.filter((to) => canTransition(status, to));

  function requestTransition(to: StageStatus) {
    setError(null);
    if (to === "in_progress" && status === "needs_update" && reopenWarning) {
      setConfirming(to);
      setBackpropConfirmed(false);
      return;
    }
    submit(to, false);
  }

  function submit(to: StageStatus, confirmedBackpropagation: boolean) {
    startTransition(async () => {
      const result = await transitionStageAction({
        stageInstanceId,
        to,
        confirmedBackpropagation,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.needsConfirmation) {
        setConfirming(to);
        return;
      }
      setConfirming(null);
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-zinc-900">ステージステータス</h2>
      <p className="text-sm text-zinc-700">現在: {STATUS_LABEL[status]}</p>
      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => requestTransition(to)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {STATUS_LABEL[to]}へ
          </button>
        ))}
      </div>

      {confirming !== null && (
        <div className="flex flex-col gap-2 rounded border border-orange-300 bg-orange-50 p-3 text-sm">
          <p className="font-medium text-orange-900">
            逆方向伝播チェック(Vibe Code 警告)
          </p>
          <p className="text-orange-800">
            上流ステージ({upstreamDone.join(", ") || "不明"})が「要更新」に戻されないまま、
            完了済みの下流ステージを再オープンしようとしています。
          </p>
          <label className="flex items-center gap-2 text-orange-900">
            <input
              type="checkbox"
              checked={backpropConfirmed}
              onChange={(e) => setBackpropConfirmed(e.target.checked)}
            />
            この変更は要件・ユーザーストーリーに影響するかを確認した
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!backpropConfirmed || pending}
              onClick={() => submit(confirming, true)}
              className="rounded bg-orange-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              確認のうえ再オープンする
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
