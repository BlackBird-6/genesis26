import { baselineScenario } from "./scenario-data";
import { parsePolicyPrompt, simulateScenario } from "./scenario-engine";
import type {
  ActivePolicies,
  ActivePolicyRecord,
  AggregateMetrics,
  BackendAgentDomain,
  PolicyPlan,
  ScenarioState,
  ThoughtTrace,
} from "./types";

export type BackendAgentResult = {
  agent_name: string;
  domain: BackendAgentDomain;
  metric_key: string;
  delta: number;
  confidence: number;
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

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function mergePolicyChanges(records: ActivePolicyRecord[]): Partial<ActivePolicies> {
  return records.reduce<ActivePolicies>(
    (acc, record) => ({
      evOffPeakShift: clamp(acc.evOffPeakShift + (record.changes.evOffPeakShift ?? 0)),
      transitSubsidy: clamp(acc.transitSubsidy + (record.changes.transitSubsidy ?? 0)),
      addedCoolingCenters: acc.addedCoolingCenters + (record.changes.addedCoolingCenters ?? 0),
      foodWasteReduction: clamp(acc.foodWasteReduction + (record.changes.foodWasteReduction ?? 0)),
    }),
    {
      evOffPeakShift: 0,
      transitSubsidy: 0,
      addedCoolingCenters: 0,
      foodWasteReduction: 0,
    },
  );
}

export function normalisePolicyRecord(record: BackendPolicyRecord): ActivePolicyRecord {
  const plan: PolicyPlan = parsePolicyPrompt(record.policy_text);
  const traces: ThoughtTrace[] = record.agent_results.map((result, index) => ({
    id: `${record.policy_id}-${index}`,
    policyId: record.policy_id,
    policyText: record.policy_text,
    agentName: result.agent_name,
    domain: result.domain,
    metricKey: result.metric_key,
    delta: result.delta,
    confidence: result.confidence,
  }));

  return {
    policyId: record.policy_id,
    policyText: record.policy_text,
    label: plan.label,
    summary: plan.summary,
    createdAt: record.timestamp,
    changes: plan.changes,
    traces,
  };
}

function aggregateFromBackend(state: BackendCityState, records: ActivePolicyRecord[]): AggregateMetrics {
  const policyChanges = mergePolicyChanges(records);
  const estimatedCost =
    120000 +
    (policyChanges.evOffPeakShift ?? 0) * 180000 +
    (policyChanges.transitSubsidy ?? 0) * 260000 +
    (policyChanges.addedCoolingCenters ?? 0) * 65000 +
    (policyChanges.foodWasteReduction ?? 0) * 90000 +
    (1 - state.metrics.fiscal) * 90000;

  return {
    emissions: Math.round(state.metrics.emissions * 100),
    congestion: Math.round(state.metrics.congestion * 100),
    peakDemand: Math.round(state.metrics.energy_demand * 100),
    equityScore: Math.round(state.metrics.equity * 100),
    cost: Math.round(estimatedCost),
  };
}

export function buildScenarioFromBackend(state: BackendCityState, records: ActivePolicyRecord[]): ScenarioState {
  const changes = mergePolicyChanges(records);
  const simulated = simulateScenario(structuredClone(baselineScenario), changes);

  return {
    ...simulated,
    aggregate: aggregateFromBackend(state, records),
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
