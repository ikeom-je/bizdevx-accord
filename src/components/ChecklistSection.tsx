"use client";

import { useState, useTransition } from "react";

import { checkItemAction } from "@/app/projects/[id]/stages/[sid]/actions";

type ChecklistItemDef = {
  id: string;
  text: string;
  good?: string;
  bad?: string;
  perMember?: boolean;
};

type ChecklistResultRow = {
  id: string;
  itemId: string;
  checked: boolean;
  by: string;
};

type MemberRow = {
  id: string;
  name: string;
};

export function ChecklistSection({
  stageInstanceId,
  items,
  results,
  members,
  sessionMemberId,
}: {
  stageInstanceId: string;
  items: ChecklistItemDef[];
  results: ChecklistResultRow[];
  members: MemberRow[];
  sessionMemberId: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-zinc-900">完了チェックリスト</h2>
      {items.map((item) => (
        <ChecklistRow
          key={item.id}
          stageInstanceId={stageInstanceId}
          item={item}
          results={results.filter((r) => r.itemId === item.id)}
          members={members}
          sessionMemberId={sessionMemberId}
        />
      ))}
    </section>
  );
}

function ChecklistRow({
  stageInstanceId,
  item,
  results,
  members,
  sessionMemberId,
}: {
  stageInstanceId: string;
  item: ChecklistItemDef;
  results: ChecklistResultRow[];
  members: MemberRow[];
  sessionMemberId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [showExamples, setShowExamples] = useState(false);

  const memberName = (memberId: string) =>
    members.find((m) => m.id === memberId)?.name ?? memberId;

  function toggle(checked: boolean) {
    startTransition(async () => {
      await checkItemAction({ stageInstanceId, itemId: item.id, checked });
    });
  }

  if (item.perMember) {
    const own = results.find((r) => r.by === sessionMemberId);
    const others = results.filter((r) => r.by !== sessionMemberId);

    return (
      <div
        data-testid={`checklist-item-${item.id}`}
        className="flex flex-col gap-1 rounded border border-zinc-200 p-3"
      >
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={own?.checked ?? false}
            disabled={pending}
            onChange={(e) => toggle(e.target.checked)}
          />
          {item.text}
          <span className="text-xs text-zinc-400">(メンバーごとに合意)</span>
        </label>
        {others.length > 0 && (
          <ul className="flex flex-col gap-0.5 pl-6 text-xs text-zinc-500">
            {others.map((r) => (
              <li key={r.id}>
                {r.checked ? "✅" : "⬜"} {memberName(r.by)}
              </li>
            ))}
          </ul>
        )}
        <Examples item={item} show={showExamples} onToggle={() => setShowExamples((v) => !v)} />
      </div>
    );
  }

  const existing = results[0];

  return (
    <div
      data-testid={`checklist-item-${item.id}`}
      className="flex flex-col gap-1 rounded border border-zinc-200 p-3"
    >
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          checked={existing?.checked ?? false}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
        />
        {item.text}
        {existing && (
          <span className="text-xs text-zinc-400">(最終更新: {memberName(existing.by)})</span>
        )}
      </label>
      <Examples item={item} show={showExamples} onToggle={() => setShowExamples((v) => !v)} />
    </div>
  );
}

function Examples({
  item,
  show,
  onToggle,
}: {
  item: ChecklistItemDef;
  show: boolean;
  onToggle: () => void;
}) {
  if (!item.good && !item.bad) {
    return null;
  }

  return (
    <details open={show} onToggle={onToggle} className="pl-6 text-xs text-zinc-500">
      <summary className="cursor-pointer select-none">良/悪例を見る</summary>
      <div className="mt-1 flex flex-col gap-1">
        {item.good && (
          <p>
            <span className="font-medium text-emerald-700">良い例: </span>
            {item.good}
          </p>
        )}
        {item.bad && (
          <p>
            <span className="font-medium text-red-700">悪い例: </span>
            {item.bad}
          </p>
        )}
      </div>
    </details>
  );
}
