import { db } from "@/db/client";
import { findProjectWithMembers, listProjects } from "@/services/project";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { EnterProjectForm } from "@/components/EnterProjectForm";

// プロジェクト作成のたびに一覧が変わるため静的プリレンダーを禁止する。
export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = listProjects(db);
  const projectsWithMembers = projects.map(
    (project) => findProjectWithMembers(db, project.id)!,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">BizDevX Accord</h1>
        <p className="mt-1 text-sm text-zinc-500">
          プロジェクトを選んで入室するか、新しいプロジェクトを作成してください。
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-zinc-800">プロジェクト一覧</h2>
        {projectsWithMembers.length === 0 && (
          <p className="text-sm text-zinc-500">まだプロジェクトがありません。</p>
        )}
        <ul className="flex flex-col gap-4">
          {projectsWithMembers.map(({ project, members }) => (
            <li
              key={project.id}
              className="flex flex-col gap-3 rounded border border-zinc-200 p-4"
            >
              <div>
                <p className="font-medium text-zinc-900">{project.name}</p>
                <p className="text-xs text-zinc-500">
                  深さプロファイル: {project.depthProfile}
                </p>
              </div>
              <EnterProjectForm projectId={project.id} members={members} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-zinc-800">新規プロジェクト作成</h2>
        <CreateProjectForm />
      </section>
    </div>
  );
}
