export type StageStatus =
  | "not_started"
  | "in_progress"
  | "done"
  | "needs_update";

export type GateKind = "approval" | "warning";

export type Role =
  | "business_owner"
  | "pm"
  | "facilitator"
  | "architect"
  | "unit_dev";

export type ApproverRole = Role | "unit_reps";

export type DepthProfile = "poc" | "new-service" | "brownfield";

export type StageExecution = "mob" | "solo";
