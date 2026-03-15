"use client";

import { create } from "zustand";
import {
  baselineScenario,
  buildScenarioFromBackend,
  getApiUrl,
  normalisePolicyRecord,
  type AddPolicyResponse,
  type BackendCityState,
  type BackendPolicyRecord,
  type ListPoliciesResponse,
  type StateResponse,
} from "../lib/backend-bridge";
import type { ActivePolicyRecord, ChatMessage, ConnectionStatus, ScenarioState, ThoughtTrace } from "../lib/types";

type ScenarioStore = {
  scenario: ScenarioState;
  messages: ChatMessage[];
  policies: ActivePolicyRecord[];
  traces: ThoughtTrace[];
  connectionStatus: ConnectionStatus;
  confidenceScore: number;
  isApplying: boolean;
  init: () => Promise<void>;
  applyPrompt: (prompt: string) => Promise<void>;
  removePolicy: (policyId: string) => Promise<void>;
};

const initialMessages: ChatMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content: "Connected to the Toronto policy engine. Add, inspect, or remove policies and the skyline will reflect the aggregate city state.",
  },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function systemMessage(content: string): ChatMessage {
  return { id: makeId(), role: "system", content };
}

function assistantMessage(content: string): ChatMessage {
  return { id: makeId(), role: "assistant", content };
}

function syncFromPolicyList(policies: BackendPolicyRecord[], cityState: BackendCityState) {
  const records = policies.map(normalisePolicyRecord);
  const traces = records.flatMap((record) => record.traces).slice().reverse();

  return {
    policies: records,
    traces,
    scenario: buildScenarioFromBackend(cityState),
    confidenceScore: cityState.confidence_score,
    isApplying: false,
  };
}

export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  scenario: baselineScenario,
  messages: initialMessages,
  policies: [],
  traces: [],
  connectionStatus: "connecting",
  confidenceScore: 0.5,
  isApplying: false,

  async init() {
    if (typeof window === "undefined") return;

    if (get().connectionStatus === "connected") {
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/state`);
      if (!res.ok) throw new Error("Failed to load initial state");

      const data: ListPoliciesResponse = await res.json();
      
      set((state) => ({
        connectionStatus: "connected",
        ...syncFromPolicyList(data.policies, data.city_state),
        messages:
          state.messages.length === initialMessages.length
            ? [
                ...state.messages,
                systemMessage("Backend connected. Loading active policies and aggregate state."),
                assistantMessage(`Loaded ${data.policies.length} active policies from the backend.`),
              ]
            : state.messages,
      }));
    } catch (err) {
      console.error("Failed to connect to backend", err);
      set((state) => ({
        connectionStatus: "error",
        messages: [...state.messages, assistantMessage("Backend connection is unavailable. Start the FastAPI service.")],
      }));
    }
  },

  async applyPrompt(prompt) {
    const text = prompt.trim();
    if (!text) return;

    set((state) => ({
      isApplying: true,
      messages: [
        ...state.messages,
        { id: makeId(), role: "user", content: text },
        systemMessage("Sending to backend agents…"),
      ],
    }));

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy: text }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data: AddPolicyResponse = await res.json();
      
      const record = normalisePolicyRecord({
        policy_id: data.policy_id,
        policy_text: data.policy_text,
        agent_results: data.agent_results,
        timestamp: new Date().toISOString(),
      });

      set((state) => ({
        policies: [record, ...state.policies],
        traces: [...record.traces, ...state.traces].slice(0, 24),
        scenario: buildScenarioFromBackend(data.city_state),
        confidenceScore: data.city_state.confidence_score,
        isApplying: false,
        messages: [
          ...state.messages,
          ...record.traces.map(ar => systemMessage(`Agent Result | ${ar.agentName} (${ar.domain}): delta ${ar.delta}`)),
          assistantMessage(`Policy added: "${record.label}" is now active.`),
          ...(data.city_state.confidence_score < 0.4 ? [assistantMessage("Uncertain prediction: low aggregate agent confidence.")] : []),
        ],
      }));
    } catch (err) {
      console.error(err);
      set((state) => ({
        isApplying: false,
        connectionStatus: "error",
        messages: [...state.messages, assistantMessage(`Backend error: Could not apply policy.`)],
      }));
    }
  },

  async removePolicy(policyId) {
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/policy/${policyId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data: StateResponse = await res.json();

      set((state) => ({
        policies: state.policies.filter((policy) => policy.policyId !== policyId),
        scenario: buildScenarioFromBackend(data.city_state),
        confidenceScore: data.city_state.confidence_score,
        messages: [...state.messages, assistantMessage(`Policy removed. Aggregate city state updated.`)],
      }));
    } catch (err) {
      console.error(err);
      set((state) => ({
        messages: [...state.messages, assistantMessage("Cannot remove policy while the backend connection is unavailable.")],
      }));
    }
  },
}));
