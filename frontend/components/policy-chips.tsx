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
  energy_demand: "GRID",
  fiscal: "FISC",
};

const METRIC_ORDER = ["emissions", "congestion", "energy_demand", "equity", "fiscal"];

function DeltaChip({ trace }: { trace: ThoughtTrace }) {
  const [hovering, setHovering] = useState(false);
  const label = METRIC_LABELS[trace.metricKey] ?? trace.metricKey;
  const sign = trace.delta >= 0 ? "+" : "";
  const colorClass = trace.delta > 0 ? styles.positive : trace.delta < 0 ? styles.negative : styles.neutral;

  return (
    <span
      className={`${styles.deltaChip} ${colorClass}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {label}&nbsp;{sign}{trace.delta.toFixed(2)}
      {hovering && (
        <span className={styles.tooltip}>
          {trace.reasoning && (
            <p className={styles.tooltipReasoning}>{trace.reasoning}</p>
          )}
          <span className={styles.tooltipConfidence}>
            Confidence: {Math.round(trace.confidence * 100)}%
          </span>
        </span>
      )}
    </span>
  );
}

export function PolicyChips({ policies, connectionStatus, onRemove }: PolicyChipsProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Active Policies</p>
          <h2 className={styles.title}>Policy registry</h2>
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
