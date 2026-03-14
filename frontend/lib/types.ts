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

export type ScenarioState = {
  zones: ZoneState[];
  aggregate: AggregateMetrics;
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
  reasoning: string;
};

export type ActivePolicyRecord = {
  policyId: string;
  policyText: string;
  label: string;
  createdAt: string;
  traces: ThoughtTrace[];
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
