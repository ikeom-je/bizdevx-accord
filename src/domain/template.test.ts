import { expect, test } from "vitest";
import { parseTemplate } from "./template";

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
