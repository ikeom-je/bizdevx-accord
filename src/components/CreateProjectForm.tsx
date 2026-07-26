"use client";

import { useActionState } from "react";

import { createProjectAction, type FormState } from "@/app/actions";
import type { DepthProfile, Role } from "@/domain/types";

const DEPTH_PROFILES: { value: DepthProfile; label: string }[] = [
  { value: "poc", label: "PoC" },
  { value: "new-service", label: "新規サービス" },
  { value: "brownfield", label: "既存改修" },
];

const ROLES: { value: Role; label: string }[] = [
  { value: "business_owner", label: "ビジネスオーナー" },
  { value: "pm", label: "PM" },
  { value: "facilitator", label: "ファシリテータ" },
  { value: "architect", label: "アーキテクト" },
  { value: "unit_dev", label: "Unit開発者" },
];

const MEMBER_ROWS = 6;

const initialState: FormState = {};

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700">
          プロジェクト名
        </label>
        <input
          id="name"
          name="name"
          required
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="depthProfile" className="text-sm font-medium text-zinc-700">
          深さプロファイル
        </label>
        <select
          id="depthProfile"
          name="depthProfile"
          defaultValue="new-service"
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
        >
          {DEPTH_PROFILES.map((profile) => (
            <option key={profile.value} value={profile.value}>
              {profile.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-zinc-700">メンバー登録</legend>
        {Array.from({ length: MEMBER_ROWS }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded border border-zinc-200 p-3">
            <input
              name={`member-name-${i}`}
              placeholder="メンバー名"
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-3 text-sm text-zinc-600">
              {ROLES.map((role) => (
                <label key={role.value} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    name={`member-roles-${i}`}
                    value={role.value}
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "作成中..." : "プロジェクトを作成"}
      </button>
    </form>
  );
}
