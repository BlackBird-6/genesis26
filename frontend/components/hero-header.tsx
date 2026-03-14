import type { AggregateMetrics, ConnectionStatus } from "../lib/types";
import styles from "./hero-header.module.css";

type HeroHeaderProps = {
  aggregate: AggregateMetrics;
  lastPlanLabel: string;
  connectionStatus: ConnectionStatus;
  confidenceScore: number;
};

export function HeroHeader({ aggregate, lastPlanLabel, connectionStatus, confidenceScore }: HeroHeaderProps) {
  return (
    <header className={styles.panel}>
      <div>
        <p className={styles.eyebrow}>WhatIf Toronto</p>
        <h1 className={styles.title}>Urban policy sandbox for downtown Toronto.</h1>
        <p className={styles.copy}>
          Real backend agent analysis drives the city metrics, active policy list, and trace log. The skyline is a visual twin mapped from that aggregate state.
        </p>
      </div>
      <div className={styles.summaryCard}>
        <span className={styles.summaryLabel}>Live Scenario</span>
        <strong className={styles.summaryValue}>{lastPlanLabel}</strong>
        <span className={styles.summaryMeta}>
          Status {connectionStatus} / Confidence {(confidenceScore * 100).toFixed(0)}% / Equity {aggregate.equityScore}
        </span>
      </div>
    </header>
  );
}
