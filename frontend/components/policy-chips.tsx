"use client";

import { useState } from "react";
import type { ActivePolicyRecord, ConnectionStatus, ThoughtTrace } from "../lib/types";
import styles from "./policy-chips.module.css";

type PolicyChipsProps = {
  policies: ActivePolicyRecord[];
  connectionStatus: ConnectionStatus;
  onRemove: (policyId: string) => void;
};

const METRIC_LABELS: Record<string, string> = {
  congestion: "CONG",
  emissions: "EMIS",
  equity: "EQTY",
  energy_demand: "ENRG",
  fiscal: "FINC",
};

const METRIC_ORDER = ["emissions", "congestion", "energy_demand", "equity", "fiscal"];

import { createPortal } from "react-dom";

function TooltipPortal({ trace, rect }: { trace: ThoughtTrace; rect: DOMRect }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <span
      className={styles.tooltip}
      style={{
        position: "fixed",
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)",
      }}
    >
      {trace.reasoning && (
        <p className={styles.tooltipReasoning}>
          <strong>{trace.agentName}:</strong> {trace.reasoning}
        </p>
      )}
      <span className={styles.tooltipConfidence}>Confidence: {Math.round(trace.confidence * 100)}%</span>
    </span>,
    document.body,
  );
}

function DeltaChip({ trace }: { trace: ThoughtTrace }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const label = METRIC_LABELS[trace.metricKey] ?? trace.metricKey;
  const sign = trace.delta >= 0 ? "+" : "";
  const colorClass = trace.delta > 0 ? styles.positive : trace.delta < 0 ? styles.negative : styles.neutral;

  return (
    <span
      className={`${styles.deltaChip} ${colorClass}`}
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      {label}&nbsp;{sign}{trace.delta.toFixed(2)}
      {rect && <TooltipPortal trace={trace} rect={rect} />}
    </span>
  );
}

export function PolicyChips({ policies, connectionStatus, onRemove }: PolicyChipsProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Active Policies</p>
        </div>
        <span className={styles.status}>Socket {connectionStatus}</span>
      </div>
      <div className={styles.chips}>
        {policies.length === 0 ? (
          <div className={styles.empty}>No active policies. Submit a scenario to create one.</div>
        ) : (
          policies.map((policy) => {
            const tracesByMetric = new Map<string, ThoughtTrace>();
            for (const trace of policy.traces) {
              tracesByMetric.set(trace.metricKey, trace);
            }

            return (
              <div className={styles.policyRow} key={policy.policyId}>
                <strong className={styles.policyLabel}>{policy.label}</strong>
                <div className={styles.deltaChips}>
                  {METRIC_ORDER.map((metricKey) => {
                    const trace = tracesByMetric.get(metricKey);
                    if (!trace) return null;
                    return <DeltaChip key={metricKey} trace={trace} />;
                  })}
                </div>
                <button className={styles.remove} onClick={() => onRemove(policy.policyId)} type="button">
                  ✕ Remove
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
