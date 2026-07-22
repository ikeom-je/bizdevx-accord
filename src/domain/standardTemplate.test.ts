import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseTemplate } from "./template";

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
    // poc プロファイルは context_map/difficulty_assessment を含まないため、
    // このステージ間依存は poc では宙に浮く(profile非依存のdependsOnモデルの既知の制約。
    // フォローアップissue参照)。
    expect(contract?.dependsOn).toEqual(["difficulty_assessment"]);
  });
});
