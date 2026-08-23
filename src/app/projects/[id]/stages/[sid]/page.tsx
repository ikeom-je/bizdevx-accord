import { notFound, redirect } from "next/navigation";

import { ArtifactSection } from "@/components/ArtifactSection";
import { ChecklistSection } from "@/components/ChecklistSection";
import { MobSessionSection } from "@/components/MobSessionSection";
import { PromptCard } from "@/components/PromptCard";
import { StageTransitionControls } from "@/components/StageTransitionControls";
import { db } from "@/db/client";
import type { Role, StageStatus } from "@/domain/types";
import { getSession } from "@/lib/session";
import { getStageNavigatorData } from "@/services/stage";

const ROLE_LABEL: Record<Role, string> = {
  business_owner: "ビジネスオーナー",
  pm: "PM",
  facilitator: "ファシリテータ",
  architect: "アーキテクト",
  unit_dev: "Unit開発者",
};

export default async function StageNavigatorPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { id, sid } = await params;
  const session = await getSession();

  if (!session || session.projectId !== id) {
    redirect("/");
  }

  let data: ReturnType<typeof getStageNavigatorData>;
  try {
    data = getStageNavigatorData(db, sid);
  } catch {
    notFound();
  }

  if (data.stage.projectId !== id) {
    notFound();
  }

  const { stage, stageDef, members, checklistResults, artifactLinks, mobSessions, upstreamNeedsUpdate } =
    data;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium text-zinc-400">{stageDef.phase}</p>
        <h1 className="text-2xl font-semibold text-zinc-900">{stageDef.name}</h1>
        <p className="text-sm text-zinc-700">{stageDef.purpose}</p>

        <div className="rounded border-l-4 border-indigo-400 bg-indigo-50 p-3 text-sm text-indigo-900">
          <p>
            <span className="font-semibold">従来との違い: </span>
            {stageDef.transformationLens.differs}
          </p>
          <p className="mt-1">
            <span className="font-semibold">捨てるべき旧習慣: </span>
            {stageDef.transformationLens.unlearn}
          </p>
        </div>

        <p className="text-sm text-zinc-600">
          主導ロール: {stageDef.roles.map((r) => ROLE_LABEL[r]).join(", ")}
          {stageDef.participantRoles.length > 0 && (
            <>
              {" / "}必須参加ロール: {stageDef.participantRoles.map((r) => ROLE_LABEL[r]).join(", ")}
            </>
          )}
        </p>

        {stageDef.execution === "mob" && (
          <p className="w-fit rounded bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">
            モブで実施
          </p>
        )}

        {upstreamNeedsUpdate.length > 0 && (
          <p className="w-fit rounded bg-red-200 px-3 py-1 text-xs font-semibold text-red-900">
            上流変更あり: {upstreamNeedsUpdate.join(", ")}
          </p>
        )}
      </header>

      {stageDef.execution === "mob" && (
        <MobSessionSection
          stageInstanceId={stage.id}
          participantRoles={stageDef.participantRoles}
          members={members}
          sessions={mobSessions}
        />
      )}

      {stageDef.contextChecklist.length > 0 && (
        <section className="rounded border-l-4 border-yellow-400 bg-yellow-50 p-4">
          <h2 className="text-sm font-semibold text-yellow-900">
            コンテキスト準備チェック(着手前に確認してください)
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-yellow-900">
            {stageDef.contextChecklist.map((item) => (
              <li key={item}>・{item}</li>
            ))}
          </ul>
        </section>
      )}

      {stageDef.prompts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900">プロンプト集</h2>
          {stageDef.prompts.map((prompt) => (
            <PromptCard
              key={prompt.title}
              title={prompt.title}
              purpose={prompt.purpose}
              editHints={prompt.editHints}
              body={prompt.body}
            />
          ))}
        </section>
      )}

      <ChecklistSection
        stageInstanceId={stage.id}
        items={stageDef.checklist}
        results={checklistResults}
        members={members}
        sessionMemberId={session.memberId}
      />

      <ArtifactSection stageInstanceId={stage.id} artifacts={artifactLinks} />

      <StageTransitionControls
        stageInstanceId={stage.id}
        status={stage.status as StageStatus}
        reopenWarning={data.reopenCheck.warn}
        upstreamDone={data.reopenCheck.upstreamDone}
      />

      {stageDef.escalations.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900">困ったら</h2>
          {stageDef.escalations.map((escalation) => {
            const candidates = members.filter((m) =>
              m.roles.includes(escalation.askRole),
            );
            return (
              <div
                key={escalation.symptom}
                className="rounded border border-zinc-200 p-3 text-sm text-zinc-700"
              >
                <p className="font-medium text-zinc-900">{escalation.symptom}</p>
                <p className="mt-1">
                  相談先: {ROLE_LABEL[escalation.askRole]}
                  {candidates.length > 0 && (
                    <> ({candidates.map((m) => m.name).join(", ")})</>
                  )}
                </p>
                <p className="mt-1 text-zinc-600">{escalation.howToAsk}</p>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
