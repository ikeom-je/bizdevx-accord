import { expect, test } from "vitest";
import {
  carriedRisks,
  regressionSummary,
  roleBiasSignals,
  WarningGatePassEvent,
  ChecklistResult,
  GateApproval,
  GateDef,
  StageInstance,
  StageDef,
  MobSession,
  Member,
} from "./signals";

test("carriedRisks のテスト: 通過後に checked になった項目は除外される", () => {
  const events: WarningGatePassEvent[] = [
    {
      gateId: "G2",
      stageInstanceId: "si-1",
      uncheckedItemIds: ["item-A", "item-B"],
    },
  ];

  const results: ChecklistResult[] = [
    { stageInstanceId: "si-1", itemId: "item-A", checked: true },
    { stageInstanceId: "si-1", itemId: "item-B", checked: false },
  ];

  const risks = carriedRisks(events, results);
  expect(risks).toEqual([
    { gateId: "G2", stageInstanceId: "si-1", itemId: "item-B" },
  ]);
});

test("regressionSummary のテスト: regressed=true の項目をゲート別に集計", () => {
  const approvals: GateApproval[] = [
    {
      gateId: "G1",
      regressionCheck: [
        { item: "item-1", regressed: true },
        { item: "item-2", regressed: false },
      ],
    },
    {
      gateId: "G1",
      regressionCheck: [{ item: "item-1", regressed: true }],
    },
    {
      gateId: "G2",
      regressionCheck: [
        { item: "item-3", regressed: true },
        { item: "item-1", regressed: true },
      ],
    },
  ];

  const summary = regressionSummary(approvals);
  expect(summary).toEqual({
    G1: {
      "item-1": 2,
    },
    G2: {
      "item-3": 1,
      "item-1": 1,
    },
  });
});

test("roleBiasSignals のテストa: 必須参加ロール欠落doneで検出", () => {
  const stageInstances: StageInstance[] = [
    { id: "si-mob-1", stageDefId: "stage-mob", status: "done" },
  ];
  const stageDefs: StageDef[] = [
    {
      id: "stage-mob",
      execution: "mob",
      participantRoles: ["business_owner", "pm"],
      phase: "phase0",
    },
  ];
  const members: Member[] = [
    { id: "m1", roles: ["pm"] },
    { id: "m2", roles: ["architect"] },
  ];
  const mobSessions: MobSession[] = [
    { stageInstanceId: "si-mob-1", participantMemberIds: ["m1", "m2"] }, // pm, architect
  ];

  const signals = roleBiasSignals(
    stageInstances,
    stageDefs,
    mobSessions,
    [],
    members
  );

  const missingMobSignal = signals.find((s) => s.type === "missing_mob_role");
  expect(missingMobSignal).toBeDefined();
  expect(missingMobSignal?.stageDefId).toBe("stage-mob");
});

test("roleBiasSignals のテストa: 全ロール揃いで非検出", () => {
  const stageInstances: StageInstance[] = [
    { id: "si-mob-2", stageDefId: "stage-mob", status: "done" },
  ];
  const stageDefs: StageDef[] = [
    {
      id: "stage-mob",
      execution: "mob",
      participantRoles: ["business_owner", "pm"],
      phase: "phase0",
    },
  ];
  const members: Member[] = [
    { id: "m1", roles: ["pm"] },
    { id: "m2", roles: ["business_owner"] },
  ];
  const mobSessions: MobSession[] = [
    { stageInstanceId: "si-mob-2", participantMemberIds: ["m1", "m2"] }, // pm, business_owner
  ];

  const signals = roleBiasSignals(
    stageInstances,
    stageDefs,
    mobSessions,
    [],
    members
  );

  const missingMobSignal = signals.find((s) => s.type === "missing_mob_role");
  expect(missingMobSignal).toBeUndefined();
});

test("roleBiasSignals のテストb: 単一ロール完結で検出", () => {
  const stageInstances: StageInstance[] = [
    { id: "si-solo-1", stageDefId: "stage-solo", status: "done" },
  ];
  const stageDefs: StageDef[] = [
    {
      id: "stage-solo",
      execution: "solo",
      participantRoles: [],
      phase: "phase1",
    },
  ];
  const members: Member[] = [
    { id: "m1", roles: ["pm"] },
    { id: "m2", roles: ["pm"] },
  ];
  const checklistResults: ChecklistResult[] = [
    { stageInstanceId: "si-solo-1", itemId: "item-1", checked: true, by: "m1" },
    { stageInstanceId: "si-solo-1", itemId: "item-2", checked: true, by: "m2" },
  ];

  const signals = roleBiasSignals(
    stageInstances,
    stageDefs,
    [],
    checklistResults,
    members
  );

  const singleRoleSignal = signals.find((s) => s.type === "single_role_bias");
  expect(singleRoleSignal).toBeDefined();
  expect(singleRoleSignal?.phase).toBe("phase1");
});

test("roleBiasSignals のテストb: 承認者ロールを加味すると単一ロール偏りが解消される", () => {
  const stageInstances: StageInstance[] = [
    { id: "si-solo-1", stageDefId: "stage-solo", status: "done" },
  ];
  const stageDefs: StageDef[] = [
    {
      id: "stage-solo",
      execution: "solo",
      participantRoles: [],
      phase: "phase1",
    },
  ];
  const members: Member[] = [
    { id: "m1", roles: ["pm"] },
    { id: "m2", roles: ["architect"] },
  ];
  const checklistResults: ChecklistResult[] = [
    { stageInstanceId: "si-solo-1", itemId: "item-1", checked: true, by: "m1" },
  ];
  const gates: GateDef[] = [{ id: "G2", afterStage: "stage-solo" }];
  const gateApprovals: GateApproval[] = [
    { gateId: "G2", regressionCheck: [], approverId: "m2" },
  ];

  const signals = roleBiasSignals(
    stageInstances,
    stageDefs,
    [],
    checklistResults,
    members,
    gateApprovals,
    gates
  );

  const singleRoleSignal = signals.find(
    (s) => s.type === "single_role_bias" && s.phase === "phase1"
  );
  expect(singleRoleSignal).toBeUndefined();
});
