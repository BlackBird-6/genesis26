export type ZoneState = {
  id: string;
  label: string;
  districtType: "financial" | "residential" | "retail" | "transit" | "plaza" | "charging" | "food";
  position: [number, number];
  trafficLevel: number;
  transitLevel: number;
  peakEnergy: number;
  carbonLevel: number;
  heatRisk: number;
  vulnerableCoverage: number;
  foodWaste: number;
  coolingCenters: number;
};

export type AggregateMetrics = {
  emissions: number;
  congestion: number;
  cost: number;
  peakDemand: number;
  equityScore: number;
};

export type ActivePolicies = {
  evOffPeakShift: number;
  transitSubsidy: number;
  addedCoolingCenters: number;
  foodWasteReduction: number;
};

export type ScenarioState = {
  zones: ZoneState[];
  aggregate: AggregateMetrics;
  activePolicies: ActivePolicies;
};

export type PolicyIntent =
  | "ev_shift"
  | "cooling_centers"
  | "traffic_reduction"
  | "food_waste"
  | "optimize_bundle";

export type PolicyPlan = {
  intent: PolicyIntent;
  label: string;
  summary: string;
  changes: Partial<ActivePolicies>;
};

export type ChatRole = "assistant" | "user" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export type BackendAgentDomain = "transit" | "environment" | "equity" | "grid" | "fiscal";

export type ThoughtTrace = {
  id: string;
  policyId: string;
  policyText: string;
  agentName: string;
  domain: BackendAgentDomain;
  metricKey: string;
  delta: number;
  confidence: number;
};

export type ActivePolicyRecord = {
  policyId: string;
  policyText: string;
  label: string;
  summary: string;
  createdAt: string;
  changes: Partial<ActivePolicies>;
  traces: ThoughtTrace[];
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
