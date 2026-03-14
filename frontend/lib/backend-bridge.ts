import type {
  ActivePolicyRecord,
  AggregateMetrics,
  BackendAgentDomain,
  ScenarioState,
  ThoughtTrace,
  ZoneState,
} from "./types";

export type BackendAgentResult = {
  agent_name: string;
  domain: BackendAgentDomain;
  metric_key: string;
  delta: number;
  confidence: number;
  reasoning: string;
};

export type BackendPolicyRecord = {
  policy_id: string;
  policy_text: string;
  agent_results: BackendAgentResult[];
  timestamp: string;
};

export type BackendCityState = {
  metrics: {
    emissions: number;
    congestion: number;
    equity: number;
    energy_demand: number;
    fiscal: number;
  };
  confidence_score: number;
  active_policies: number;
  timestamp: string;
};

export type BackendEvent =
  | { type: "agent_result"; data: BackendAgentResult }
  | { type: "policy_added"; data: { policy_id: string; policy_text: string; agent_results: BackendAgentResult[] } }
  | { type: "policy_removed"; data: { policy_id: string } }
  | { type: "policy_list"; data: { policies: BackendPolicyRecord[]; city_state: BackendCityState } }
  | { type: "city_state"; data: BackendCityState }
  | { type: "uncertain_prediction"; data: { confidence_score: number; message: string } }
  | { type: "error"; data: { message: string; traceback?: string } };

// ---------------------------------------------------------------------------
// Static zone positions — layout is fixed, values are driven by backend
// ---------------------------------------------------------------------------

const STATIC_ZONES: Omit<ZoneState, "trafficLevel" | "transitLevel" | "peakEnergy" | "carbonLevel" | "heatRisk" | "vulnerableCoverage" | "foodWaste" | "coolingCenters">[] = [
  { id: "financial-core",   label: "Financial Core",   districtType: "financial",   position: [-4.4,  1.8] },
  { id: "mixed-residential",label: "Mixed Residential", districtType: "residential", position: [-0.6,  2.5] },
  { id: "retail-strip",     label: "Retail Strip",      districtType: "retail",      position: [ 3.4,  2.3] },
  { id: "transit-corridor", label: "Transit Corridor",  districtType: "transit",     position: [-3.5, -1.2] },
  { id: "high-heat-plaza",  label: "High-Heat Plaza",   districtType: "plaza",       position: [ 0.2, -1.1] },
  { id: "charger-cluster",  label: "Charger Cluster",   districtType: "charging",    position: [ 4.2, -0.9] },
  { id: "food-quarter",     label: "Food Quarter",       districtType: "food",        position: [ 1.6, -4.0] },
];

function buildZones(aggregate: AggregateMetrics): ZoneState[] {
  const traffic   = aggregate.congestion  / 100;
  const energy    = aggregate.peakDemand  / 100;
  const carbon    = aggregate.emissions   / 100;
  const equity    = aggregate.equityScore / 100;

  return STATIC_ZONES.map((z) => ({
    ...z,
    trafficLevel:      traffic,
    transitLevel:      1 - traffic,
    peakEnergy:        energy,
    carbonLevel:       carbon,
    heatRisk:          carbon,
    vulnerableCoverage: equity,
    foodWaste:         carbon * 0.7,
    coolingCenters:    equity > 0.55 ? 1 : 0,
  }));
}

function aggregateFromBackend(state: BackendCityState): AggregateMetrics {
  return {
    emissions:   Math.round(state.metrics.emissions    * 100),
    congestion:  Math.round(state.metrics.congestion   * 100),
    peakDemand:  Math.round(state.metrics.energy_demand * 100),
    equityScore: Math.round(state.metrics.equity       * 100),
    cost:        Math.round(state.metrics.fiscal       * 100),
  };
}

export function buildScenarioFromBackend(state: BackendCityState): ScenarioState {
  const aggregate = aggregateFromBackend(state);
  return { zones: buildZones(aggregate), aggregate };
}

export const baselineScenario: ScenarioState = buildScenarioFromBackend({
  metrics: { emissions: 0.5, congestion: 0.5, equity: 0.5, energy_demand: 0.5, fiscal: 0.5 },
  confidence_score: 0.5,
  active_policies: 0,
  timestamp: "",
});

export function normalisePolicyRecord(record: BackendPolicyRecord): ActivePolicyRecord {
  const traces: ThoughtTrace[] = record.agent_results.map((result, index) => ({
    id: `${record.policy_id}-${index}`,
    policyId:   record.policy_id,
    policyText: record.policy_text,
    agentName:  result.agent_name,
    domain:     result.domain,
    metricKey:  result.metric_key,
    delta:      result.delta,
    confidence: result.confidence,
    reasoning:  result.reasoning ?? "",
  }));

  // Use the first few words of the policy text as the label (max 6 words)
  const words = record.policy_text.trim().split(/\s+/);
  const label = words.length > 6 ? words.slice(0, 6).join(" ") + "…" : record.policy_text;

  return {
    policyId:  record.policy_id,
    policyText: record.policy_text,
    label,
    createdAt: record.timestamp,
    traces,
  };
}

export function getWebSocketUrl() {
  if (typeof window === "undefined") {
    return "";
  }
  const explicit = process.env.NEXT_PUBLIC_SIM_WS_URL;
  if (explicit) {
    return explicit;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8000/ws/simulation`;
}
