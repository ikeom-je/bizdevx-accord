import { notFound, redirect } from "next/navigation";

import { db } from "@/db/client";
import { getSession } from "@/lib/session";
import { findProjectWithMembers } from "@/services/project";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  if (!session || session.projectId !== id) {
    redirect("/");
  }

  const found = findProjectWithMembers(db, id);
  if (!found) {
    notFound();
  }

  const member = found.members.find((m) => m.id === session.memberId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900">{found.project.name}</h1>
      <p className="text-sm text-zinc-600">
        ようこそ、{member?.name ?? "不明なメンバー"}さん
        {member && `(${member.roles.join(", ")})`}
      </p>
      {/* ロール別ダッシュボードの本実装は plan Task 13 で行う */}
      <p className="text-sm text-zinc-400">
        ダッシュボードは準備中です(plan Task 13 で実装予定)。
      </p>
    </div>
  );
}
