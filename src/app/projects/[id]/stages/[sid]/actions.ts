"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db/client";
import { getSession } from "@/lib/session";
import {
  checkItem,
  recordMobSession,
  registerArtifact,
  transitionStage,
  updateArtifactStatus,
} from "@/services/stage";

export type FormState = { error?: string };

const StageStatusSchema = z.enum(["not_started", "in_progress", "done", "needs_update"]);

async function requireActor() {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session;
}

const CheckItemSchema = z.object({
  stageInstanceId: z.string().min(1),
  itemId: z.string().min(1),
  checked: z.boolean(),
});

// checkItem はチェックボックスの即時トグル操作から呼ぶため、フォーム submit ではなく
// クライアントから直接 await するプレーンな Server Action として公開する。
export async function checkItemAction(input: {
  stageInstanceId: string;
  itemId: string;
  checked: boolean;
}) {
  const session = await requireActor();
  const parsed = CheckItemSchema.parse(input);

  checkItem(db, {
    stageInstanceId: parsed.stageInstanceId,
    actor: session.memberId,
    itemId: parsed.itemId,
    checked: parsed.checked,
  });

  revalidatePath(`/projects/${session.projectId}/stages/${parsed.stageInstanceId}`);
}

const RegisterArtifactSchema = z.object({
  stageInstanceId: z.string().min(1),
  kind: z.enum(["artifact", "question"]),
  name: z.string().min(1, "名称を入力してください"),
  url: z.string().url("URL形式で入力してください"),
  status: z.string().min(1),
});

export async function registerArtifactAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireActor();
  const parsed = RegisterArtifactSchema.safeParse({
    stageInstanceId: formData.get("stageInstanceId"),
    kind: formData.get("kind"),
    name: formData.get("name"),
    url: formData.get("url"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  registerArtifact(db, {
    stageInstanceId: parsed.data.stageInstanceId,
    actor: session.memberId,
    kind: parsed.data.kind,
    name: parsed.data.name,
    url: parsed.data.url,
    status: parsed.data.status,
  });

  revalidatePath(`/projects/${session.projectId}/stages/${parsed.data.stageInstanceId}`);
  return {};
}

const UpdateArtifactStatusSchema = z.object({
  artifactLinkId: z.string().min(1),
  stageInstanceId: z.string().min(1),
  status: z.string().min(1),
});

export async function updateArtifactStatusAction(input: {
  artifactLinkId: string;
  stageInstanceId: string;
  status: string;
}) {
  const session = await requireActor();
  const parsed = UpdateArtifactStatusSchema.parse(input);

  updateArtifactStatus(db, {
    artifactLinkId: parsed.artifactLinkId,
    actor: session.memberId,
    status: parsed.status,
  });

  revalidatePath(`/projects/${session.projectId}/stages/${parsed.stageInstanceId}`);
}

const TransitionStageSchema = z.object({
  stageInstanceId: z.string().min(1),
  to: StageStatusSchema,
  confirmedBackpropagation: z.boolean().optional(),
});

export type TransitionFormState = {
  error?: string;
  needsConfirmation?: boolean;
  upstreamDone?: string[];
};

export async function transitionStageAction(
  input: {
    stageInstanceId: string;
    to: "not_started" | "in_progress" | "done" | "needs_update";
    confirmedBackpropagation?: boolean;
  },
): Promise<TransitionFormState> {
  const session = await requireActor();
  const parsed = TransitionStageSchema.parse(input);

  try {
    transitionStage(db, {
      stageInstanceId: parsed.stageInstanceId,
      actor: session.memberId,
      to: parsed.to,
      confirmedBackpropagation: parsed.confirmedBackpropagation,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Backpropagation confirmation required") {
      return { needsConfirmation: true };
    }
    return { error: error instanceof Error ? error.message : "遷移に失敗しました" };
  }

  revalidatePath(`/projects/${session.projectId}/stages/${parsed.stageInstanceId}`);
  return {};
}

const RecordMobSessionSchema = z.object({
  stageInstanceId: z.string().min(1),
  participantMemberIds: z.array(z.string().min(1)).min(1, "参加メンバーを選択してください"),
  heldAt: z.string().min(1, "日時を入力してください"),
  note: z.string().optional(),
});

export async function recordMobSessionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireActor();
  const parsed = RecordMobSessionSchema.safeParse({
    stageInstanceId: formData.get("stageInstanceId"),
    participantMemberIds: formData.getAll("participantMemberIds"),
    heldAt: formData.get("heldAt"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  recordMobSession(db, {
    stageInstanceId: parsed.data.stageInstanceId,
    actor: session.memberId,
    participantMemberIds: parsed.data.participantMemberIds,
    heldAt: parsed.data.heldAt,
    note: parsed.data.note,
  });

  revalidatePath(`/projects/${session.projectId}/stages/${parsed.data.stageInstanceId}`);
  return {};
}
