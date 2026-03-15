"use client";

import { create } from "zustand";
import {
  baselineScenario,
  buildScenarioFromBackend,
  getWebSocketUrl,
  normalisePolicyRecord,
  type BackendCityState,
  type BackendEvent,
  type BackendPolicyRecord,
} from "../lib/backend-bridge";
import type { ActivePolicyRecord, ChatMessage, ConnectionStatus, ScenarioState, ThoughtTrace } from "../lib/types";

type ScenarioStore = {
  scenario: ScenarioState;
  messages: ChatMessage[];
  policies: ActivePolicyRecord[];
  traces: ThoughtTrace[];
  connectionStatus: ConnectionStatus;
  confidenceScore: number;
  socket: WebSocket | null;
  isApplying: boolean;
  init: () => void;
  applyPrompt: (prompt: string) => Promise<void>;
  removePolicy: (policyId: string) => void;
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
  socket: null,
  isApplying: false,

  init() {
    if (typeof window === "undefined") return;

    const existing = get().socket;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const ws = new WebSocket(getWebSocketUrl());
    set({ socket: ws, connectionStatus: "connecting" });

    ws.onopen = () => {
      set((state) => ({
        connectionStatus: "connected",
        messages:
          state.messages.length === initialMessages.length
            ? [...state.messages, systemMessage("Backend connected. Loading active policies and aggregate state.")]
            : state.messages,
      }));
      ws.send(JSON.stringify({ action: "list_policies" }));
    };

    ws.onclose = () => {
      set({ connectionStatus: "disconnected", socket: null, isApplying: false });
      window.setTimeout(() => get().init(), 2000);
    };

    ws.onerror = () => {
      set({ connectionStatus: "error" });
    };

    ws.onmessage = (event) => {
      const payload: BackendEvent = JSON.parse(event.data);

      if (payload.type === "policy_list") {
        set((state) => ({
          ...syncFromPolicyList(payload.data.policies, payload.data.city_state),
          messages:
            state.messages.length > initialMessages.length
              ? state.messages
              : [...state.messages, assistantMessage(`Loaded ${payload.data.policies.length} active policies from the backend.`)],
        }));
        return;
      }

      if (payload.type === "agent_result") {
        const latestPolicy = get().policies[0];
        const trace: ThoughtTrace = {
          id: makeId(),
          policyId: latestPolicy?.policyId ?? "pending",
          policyText: latestPolicy?.policyText ?? "",
          agentName: payload.data.agent_name,
          domain: payload.data.domain,
          metricKey: payload.data.metric_key,
          delta: payload.data.delta,
          confidence: payload.data.confidence,
          reasoning: payload.data.reasoning ?? "",
        };
        set((state) => ({
          traces: [trace, ...state.traces].slice(0, 24),
        }));
        return;
      }

      if (payload.type === "policy_added") {
        const record = normalisePolicyRecord({
          policy_id: payload.data.policy_id,
          policy_text: payload.data.policy_text,
          agent_results: payload.data.agent_results,
          timestamp: new Date().toISOString(),
        });
        set((state) => ({
          policies: [record, ...state.policies],
          traces: [...record.traces, ...state.traces].slice(0, 24),
          isApplying: false,
          messages: [
            ...state.messages,
            assistantMessage(`Policy added: "${record.label}" is now active.`),
          ],
        }));
        return;
      }

      if (payload.type === "policy_removed") {
        set((state) => ({
          policies: state.policies.filter((policy) => policy.policyId !== payload.data.policy_id),
          messages: [...state.messages, assistantMessage(`Policy removed. Aggregate city state updated.`)],
        }));
        return;
      }

      if (payload.type === "city_state") {
        set({
          scenario: buildScenarioFromBackend(payload.data),
          confidenceScore: payload.data.confidence_score,
          isApplying: false,
        });
        return;
      }

      if (payload.type === "uncertain_prediction") {
        set((state) => ({
          messages: [...state.messages, assistantMessage(payload.data.message)],
        }));
        return;
      }

      if (payload.type === "error") {
        set((state) => ({
          isApplying: false,
          messages: [...state.messages, assistantMessage(`Backend error: ${payload.data.message}`)],
        }));
      }
    };
  },

  async applyPrompt(prompt) {
    const text = prompt.trim();
    if (!text) return;

    const ws = get().socket;

    set((state) => ({
      isApplying: true,
      messages: [
        ...state.messages,
        { id: makeId(), role: "user", content: text },
        systemMessage("Sending to backend agents…"),
      ],
    }));

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      set((state) => ({
        isApplying: false,
        connectionStatus: "error",
        messages: [...state.messages, assistantMessage("Backend connection is unavailable. Start the FastAPI service and reconnect.")],
      }));
      return;
    }

    ws.send(JSON.stringify({ action: "add_policy", policy: text }));
  },

  removePolicy(policyId) {
    const ws = get().socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      set((state) => ({
        messages: [...state.messages, assistantMessage("Cannot remove policy while the backend connection is unavailable.")],
      }));
      return;
    }
    ws.send(JSON.stringify({ action: "remove_policy", policy_id: policyId }));
  },
}));
