"use client";

import { useActionState, useTransition } from "react";

import {
  registerArtifactAction,
  updateArtifactStatusAction,
  type FormState,
} from "@/app/projects/[id]/stages/[sid]/actions";

type ArtifactLinkRow = {
  id: string;
  kind: string;
  name: string;
  url: string;
  status: string;
};

const initialState: FormState = {};

export function ArtifactSection({
  stageInstanceId,
  artifacts,
}: {
  stageInstanceId: string;
  artifacts: ArtifactLinkRow[];
}) {
  const [state, formAction, pending] = useActionState(registerArtifactAction, initialState);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-zinc-900">成果物リンク</h2>

      <ul className="flex flex-col gap-2">
        {artifacts.length === 0 && (
          <li className="text-sm text-zinc-400">まだ登録されていません</li>
        )}
        {artifacts.map((artifact) => (
          <ArtifactRow key={artifact.id} stageInstanceId={stageInstanceId} artifact={artifact} />
        ))}
      </ul>

      <form action={formAction} className="flex flex-col gap-2 rounded border border-zinc-200 p-3">
        {state.error && (
          <p className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700">
            {state.error}
          </p>
        )}
        <input type="hidden" name="stageInstanceId" value={stageInstanceId} />
        <div className="flex flex-wrap gap-2">
          <select name="kind" defaultValue="artifact" className="rounded border border-zinc-300 px-2 py-1 text-sm">
            <option value="artifact">成果物</option>
            <option value="question">質問ファイル</option>
          </select>
          <input
            name="name"
            placeholder="名称"
            required
            className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </div>
        <input
          name="url"
          placeholder="https://..."
          required
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <select name="status" defaultValue="draft" className="rounded border border-zinc-300 px-2 py-1 text-sm">
          <option value="draft">draft</option>
          <option value="done">done</option>
          <option value="awaiting_answer">回答待ち</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "登録中..." : "リンクを登録"}
        </button>
      </form>
    </section>
  );
}

function ArtifactRow({
  stageInstanceId,
  artifact,
}: {
  stageInstanceId: string;
  artifact: ArtifactLinkRow;
}) {
  const [pending, startTransition] = useTransition();

  function toggleAnswered() {
    startTransition(async () => {
      await updateArtifactStatusAction({
        artifactLinkId: artifact.id,
        stageInstanceId,
        status: artifact.status === "answered" ? "awaiting_answer" : "answered",
      });
    });
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-3 py-2 text-sm">
      <div className="flex flex-col">
        <a href={artifact.url} target="_blank" rel="noreferrer" className="font-medium text-zinc-900 underline">
          {artifact.name}
        </a>
        <span className="text-xs text-zinc-500">
          {artifact.kind === "question" ? "質問ファイル" : "成果物"} / {artifact.status}
        </span>
      </div>
      {artifact.kind === "question" && (
        <button
          type="button"
          onClick={toggleAnswered}
          disabled={pending}
          className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {artifact.status === "answered" ? "回答待ちに戻す" : "回答済みにする"}
        </button>
      )}
    </li>
  );
}
