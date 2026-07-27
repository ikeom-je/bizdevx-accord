import { expect, test } from "vitest";
import { parseTemplate, resolveActiveDependencies } from "./template";
import type { DepthProfile } from "./types";

type DependencyStage = {
  id: string;
  profiles: readonly DepthProfile[];
  dependsOn: readonly string[];
};

function stage(
  id: string,
  profiles: readonly DepthProfile[],
  dependsOn: readonly string[] = [],
): DependencyStage {
  return { id, profiles, dependsOn };
}

const minimalYaml = `
version: 1
name: bizdevx-standard
profiles: [poc, new-service, brownfield]
stages:
  - id: team_charter
    name: チーム憲章
    phase: phase0
    roles: [facilitator]
    participantRoles: [pm]
    execution: mob
    purpose: AIネイティブな働き方に合意する
    transformationLens:
      differs: 従来はキックオフで体制だけ決めていた
      unlearn: 個人の暗黙の働き方のまま始めること
    profiles: [poc, new-service, brownfield]
    contextChecklist: []
    checklist:
      - id: agree_ai_native
        text: 人間は成果物を書かず、意図の提示とレビューに集中することに合意した
        perMember: true
    prompts: []
    escalations: []
    dependsOn: []
gates:
  - id: G1
    afterStage: team_charter
    kind: approval
    approverRoles: [business_owner]
    regressionChecks:
      - 人間が成果物を直接書き始めていないか
`;

test("有効なYAMLをパースできる", () => {
  const t = parseTemplate(minimalYaml);
  expect(t.stages[0].transformationLens.unlearn).toContain("暗黙");
  expect(t.gates[0].regressionChecks).toHaveLength(1);
});

test("不正なYAML(kind不正)は明示エラー", () => {
  expect(() =>
    parseTemplate(minimalYaml.replace("kind: approval", "kind: bogus")),
  ).toThrow(/gates/);
});

test("dependsOn が存在しないステージIDを指すとエラー", () => {
  expect(() =>
    parseTemplate(minimalYaml.replace("dependsOn: []", "dependsOn: [nope]")),
  ).toThrow(/nope/);
});

test("execution が mob かつ participantRoles が空ならエラー", () => {
  const yaml = minimalYaml.replace(
    "participantRoles: [pm]",
    "participantRoles: []",
  );

  expect(() => parseTemplate(yaml)).toThrow(/participantRoles/);
});

test("resolveActiveDependencies: 上流がアクティブならそのまま返す", () => {
  const stages = [
    stage("a", ["poc", "new-service"]),
    stage("b", ["poc", "new-service"], ["a"]),
  ];

  expect(resolveActiveDependencies(stages, "new-service", "b")).toEqual([
    "a",
  ]);
});

test("resolveActiveDependencies: 上流が非アクティブなら祖先を遡る", () => {
  const stages = [
    stage("a", ["poc", "new-service"]),
    stage("b", ["new-service"], ["a"]), // poc では非アクティブ
    stage("c", ["poc", "new-service"], ["b"]),
  ];

  expect(resolveActiveDependencies(stages, "poc", "c")).toEqual(["a"]);
});

test("resolveActiveDependencies: 複数dependsOnはそれぞれ独立に遡り重複除去する", () => {
  const stages = [
    stage("a", ["poc", "new-service"]),
    stage("b", ["new-service"], ["a"]), // poc では非アクティブ
    stage("c", ["new-service"], ["a"]), // poc では非アクティブ
    stage("d", ["poc", "new-service"], ["b", "c"]),
  ];

  expect(resolveActiveDependencies(stages, "poc", "d")).toEqual(["a"]);
});

test("resolveActiveDependencies: 循環参照があっても無限ループしない", () => {
  const stages = [
    stage("a", ["new-service"], ["b"]), // poc では非アクティブ
    stage("b", ["new-service"], ["a"]), // poc では非アクティブ
    stage("c", ["poc", "new-service"], ["a"]),
  ];

  expect(resolveActiveDependencies(stages, "poc", "c")).toEqual([]);
});
