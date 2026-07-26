"use client";

import { useActionState } from "react";

import { enterProjectAction, type FormState } from "@/app/actions";

type Member = { id: string; name: string; roles: string[] };

const initialState: FormState = {};

export function EnterProjectForm({
  projectId,
  members,
}: {
  projectId: string;
  members: Member[];
}) {
  const [state, formAction, pending] = useActionState(
    enterProjectAction,
    initialState,
  );

  if (members.length === 0) {
    return <p className="text-sm text-zinc-500">メンバー未登録のため入室できません</p>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <select
        name="memberId"
        className="rounded border border-zinc-300 px-2 py-1 text-sm"
        defaultValue=""
      >
        <option value="" disabled>
          メンバーを選択
        </option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}({member.roles.join(", ")})
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-zinc-400 px-3 py-1 text-sm font-medium disabled:opacity-50"
      >
        入室
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
