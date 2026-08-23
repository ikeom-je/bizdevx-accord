"use client";

import { useActionState } from "react";

import { recordMobSessionAction, type FormState } from "@/app/projects/[id]/stages/[sid]/actions";
import type { Role } from "@/domain/types";

type MemberRow = {
  id: string;
  name: string;
  roles: string[];
};

type MobSessionRow = {
  id: string;
  participantMemberIds: string[];
  heldAt: string;
  note: string | null;
};

const initialState: FormState = {};

export function MobSessionSection({
  stageInstanceId,
  participantRoles,
  members,
  sessions,
}: {
  stageInstanceId: string;
  participantRoles: Role[];
  members: MemberRow[];
  sessions: MobSessionRow[];
}) {
  const [state, formAction, pending] = useActionState(recordMobSessionAction, initialState);
  const memberName = (memberId: string) => members.find((m) => m.id === memberId)?.name ?? memberId;

  return (
    <section className="flex flex-col gap-3 rounded border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">モブで実施</p>

      <ul className="flex flex-col gap-2">
        {sessions.length === 0 && (
          <li className="text-sm text-amber-700">まだモブセッションの記録がありません</li>
        )}
        {sessions.map((session) => {
          const participantRolesInSession = new Set(
            session.participantMemberIds.flatMap(
              (memberId) => members.find((m) => m.id === memberId)?.roles ?? [],
            ),
          );
          const missingRoles = participantRoles.filter(
            (role) => !participantRolesInSession.has(role),
          );

          return (
            <li key={session.id} className="rounded border border-amber-200 bg-white p-2 text-sm">
              <p className="text-zinc-800">
                {new Date(session.heldAt).toLocaleString("ja-JP")} —{" "}
                {session.participantMemberIds.map(memberName).join(", ")}
              </p>
              {session.note && <p className="text-xs text-zinc-500">{session.note}</p>}
              {missingRoles.length > 0 && (
                <p className="mt-1 text-xs font-medium text-red-700">
                  必須参加ロールが不足しています: {missingRoles.join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <form action={formAction} className="flex flex-col gap-2 rounded border border-amber-200 bg-white p-3">
        {state.error && (
          <p className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700">
            {state.error}
          </p>
        )}
        <input type="hidden" name="stageInstanceId" value={stageInstanceId} />
        <fieldset className="flex flex-wrap gap-3 text-sm text-zinc-700">
          <legend className="text-xs font-medium text-zinc-600">参加メンバー</legend>
          {members.map((member) => (
            <label key={member.id} className="flex items-center gap-1">
              <input type="checkbox" name="participantMemberIds" value={member.id} />
              {member.name}
            </label>
          ))}
        </fieldset>
        <input
          type="datetime-local"
          name="heldAt"
          required
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <textarea
          name="note"
          placeholder="決定メモ"
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "記録中..." : "モブセッションを記録"}
        </button>
      </form>
    </section>
  );
}
