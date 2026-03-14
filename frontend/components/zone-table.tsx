import type { ThoughtTrace } from "../lib/types";
import styles from "./zone-table.module.css";

type ZoneTableProps = {
  traces: ThoughtTrace[];
};

export function ZoneTable({ traces }: ZoneTableProps) {
  return (
    <section className={styles.panel}>
      <p className={styles.eyebrow}>Thought Traces</p>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Latest agent outputs</h2>
        <span className={styles.caption}>Direct backend traces</span>
      </div>
      <div className={styles.table}>
        {traces.length === 0 ? (
          <div className={styles.empty}>Agent traces will appear here after a policy is submitted.</div>
        ) : (
          traces.map((trace) => (
            <div className={styles.row} key={trace.id}>
              <div>
                <strong>{trace.agentName}</strong>
                <p>{trace.domain}</p>
              </div>
              <span>{trace.metricKey}</span>
              <span>{trace.delta >= 0 ? `+${trace.delta.toFixed(2)}` : trace.delta.toFixed(2)}</span>
              <span>{Math.round(trace.confidence * 100)}%</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
