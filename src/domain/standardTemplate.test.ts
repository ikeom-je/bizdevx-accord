import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseTemplate, resolveActiveDependencies } from "./template";

const standardTemplatePath = join(
  process.cwd(),
  "templates",
  "bizdevx-standard.yaml",
);

const newServiceStageIds = [
  "team_charter",
  "persona",
  "problem_selection",
  "prfaq",
  "user_stories",
  "mock",
  "unit_of_work",
  "context_map",
  "difficulty_assessment",
  "contract",
  "domain_modeling",
  "code",
  "test",
  "architecture",
  "qa",
  "user_review",
];

function loadStandardTemplate() {
  return parseTemplate(readFileSync(standardTemplatePath, "utf8"));
}

describe("bizdevx 標準テンプレート", () => {
  test("templates/bizdevx-standard.yaml が parseTemplate を通る", () => {
    const template = loadStandardTemplate();

    expect(template.name).toBe("bizdevx-standard");
    expect(template.profiles).toEqual(["poc", "new-service", "brownfield"]);
  });

  test("G1〜G4 が定義されている", () => {
    const template = loadStandardTemplate();

    expect(template.gates.map((gate) => gate.id)).toEqual([
      "G1",
      "G2",
      "G3",
      "G4",
    ]);
  });

  test("new-service プロファイルに spec 4.2 の全ステージが含まれる", () => {
    const template = loadStandardTemplate();
    const stageIds = template.stages
      .filter((stage) => stage.profiles.includes("new-service"))
      .map((stage) => stage.id);

    expect(stageIds).toEqual(newServiceStageIds);
  });

  test("poc プロファイルでは mock/difficulty_assessment などが省かれる", () => {
    const template = loadStandardTemplate();
    const pocStageIds = template.stages
      .filter((stage) => stage.profiles.includes("poc"))
      .map((stage) => stage.id);

    expect(pocStageIds).not.toContain("mock");
    expect(pocStageIds).not.toContain("difficulty_assessment");
    expect(pocStageIds).not.toContain("context_map");
  });

  test("contract は spec 4.2 の順序どおり difficulty_assessment に依存する", () => {
    const template = loadStandardTemplate();
    const contract = template.stages.find((stage) => stage.id === "contract");

    // spec 4.2: unit_of_work → context_map → difficulty_assessment → contract。
    // dependsOn 自体はプロファイル非依存の理想チェーンとして書かれ、
    // プロファイルごとの非アクティブ祖先の読み飛ばしは resolveActiveDependencies が行う(spec 4.1)。
    expect(contract?.dependsOn).toEqual(["difficulty_assessment"]);
  });

  test("poc プロファイルでは contract の実効依存が unit_of_work まで遡る", () => {
    const template = loadStandardTemplate();

    // poc では context_map・difficulty_assessment が非アクティブなため、
    // アクティブな最初の祖先である unit_of_work まで遡って解決される(spec 4.1)。
    expect(
      resolveActiveDependencies(template.stages, "poc", "contract"),
    ).toEqual(["unit_of_work"]);
  });

  test("new-service プロファイルでは contract の実効依存が difficulty_assessment のまま", () => {
    const template = loadStandardTemplate();

    // new-service では difficulty_assessment 自体がアクティブなので、
    // 通常の直接依存がそのまま実効依存になる。
    expect(
      resolveActiveDependencies(template.stages, "new-service", "contract"),
    ).toEqual(["difficulty_assessment"]);
  });

  // 以下は issue #39: G1〜G4 の requires/approverRoles、Phase0/1 の
  // execution: mob + participantRoles を固定回帰テストとして明示する。
  // (従来は G1〜G4 の ID 一致のみ検証しており、テンプレート内容の変更が
  // 意図せず起きても検出できなかった)
  test("G1〜G4 の requires・approverRoles・kind が spec 4.2/4.3 のとおり固定されている", () => {
    const template = loadStandardTemplate();
    const gatesById = Object.fromEntries(
      template.gates.map((gate) => [gate.id, gate]),
    );

    expect(gatesById.G1.afterStage).toBe("prfaq");
    expect(gatesById.G1.kind).toBe("approval");
    expect(gatesById.G1.approverRoles).toEqual(["business_owner"]);
    expect(gatesById.G1.requires).toEqual(["scope_ledger"]);

    expect(gatesById.G2.afterStage).toBe("unit_of_work");
    expect(gatesById.G2.kind).toBe("warning");
    expect(gatesById.G2.approverRoles).toEqual(["architect"]);

    expect(gatesById.G3.afterStage).toBe("contract");
    expect(gatesById.G3.kind).toBe("approval");
    expect(gatesById.G3.approverRoles).toEqual(["architect", "unit_reps"]);

    expect(gatesById.G4.afterStage).toBe("user_review");
    expect(gatesById.G4.kind).toBe("approval");
    expect(gatesById.G4.approverRoles).toEqual(["pm"]);
  });

  test("Phase0の全ステージがexecution: mobで全5ロールが必須参加する(spec 4.2)", () => {
    const template = loadStandardTemplate();
    const phase0StageIds = ["team_charter", "persona", "problem_selection", "prfaq"];
    const allRoles = ["business_owner", "pm", "facilitator", "architect", "unit_dev"];

    for (const id of phase0StageIds) {
      const stage = template.stages.find((s) => s.id === id);
      expect(stage?.execution, `${id} の execution`).toBe("mob");
      expect(stage?.participantRoles.sort(), `${id} の participantRoles`).toEqual(
        [...allRoles].sort(),
      );
    }
  });

  test("Phase1の主要ステージがarchitect主導のexecution: mobでPM・ビジネスオーナーが必須参加する(spec 4.2)", () => {
    const template = loadStandardTemplate();
    const phase1StageIds = [
      "user_stories",
      "mock",
      "unit_of_work",
      "context_map",
      "difficulty_assessment",
      "contract",
    ];

    for (const id of phase1StageIds) {
      const stage = template.stages.find((s) => s.id === id);
      expect(stage?.roles, `${id} の roles`).toEqual(["architect"]);
      expect(stage?.execution, `${id} の execution`).toBe("mob");
      expect(stage?.participantRoles.sort(), `${id} の participantRoles`).toEqual(
        ["pm", "business_owner"].sort(),
      );
    }
  });
});
