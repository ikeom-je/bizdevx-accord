"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db/client";
import { setSession } from "@/lib/session";
import { createProject } from "@/services/project";

const MAX_MEMBER_ROWS = 6;

const RoleSchema = z.enum([
  "business_owner",
  "pm",
  "facilitator",
  "architect",
  "unit_dev",
]);

const DepthProfileSchema = z.enum(["poc", "new-service", "brownfield"]);

const CreateProjectSchema = z.object({
  name: z.string().min(1, "プロジェクト名を入力してください"),
  depthProfile: DepthProfileSchema,
  members: z.array(
    z.object({
      name: z.string().min(1),
      roles: z.array(RoleSchema).min(1, "少なくとも1つのロールを選択してください"),
    }),
  ),
});

export type FormState = { error?: string };

// メンバー行はフォームに固定数だけ描画し(MAX_MEMBER_ROWS)、名前未入力の行は
// 登録対象から除外する。動的な行追加のためだけにクライアントコンポーネント化する
// のを避け、サーバーコンポーネントのままフォームを完結させるための割り切り。
export async function createProjectAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const members = [];
  for (let i = 0; i < MAX_MEMBER_ROWS; i++) {
    const name = formData.get(`member-name-${i}`);
    if (typeof name === "string" && name.trim().length > 0) {
      members.push({
        name: name.trim(),
        roles: formData.getAll(`member-roles-${i}`),
      });
    }
  }

  const parsed = CreateProjectSchema.safeParse({
    name: formData.get("name"),
    depthProfile: formData.get("depthProfile"),
    members,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  createProject(db, {
    name: parsed.data.name,
    depthProfile: parsed.data.depthProfile,
    actor: "system",
    members: parsed.data.members.map((member) => ({
      id: randomUUID(),
      name: member.name,
      roles: member.roles,
    })),
  });

  redirect("/");
}

const EnterProjectSchema = z.object({
  projectId: z.string().min(1),
  memberId: z.string().min(1, "メンバーを選択してください"),
});

export async function enterProjectAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = EnterProjectSchema.safeParse({
    projectId: formData.get("projectId"),
    memberId: formData.get("memberId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "メンバーを選択してください" };
  }

  await setSession({
    projectId: parsed.data.projectId,
    memberId: parsed.data.memberId,
  });

  redirect(`/projects/${parsed.data.projectId}/dashboard`);
}
