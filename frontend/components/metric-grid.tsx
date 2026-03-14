import type { AggregateMetrics } from "../lib/types";
import styles from "./metric-grid.module.css";

type MetricGridProps = {
  aggregate: AggregateMetrics;
};

type MetricMeta = {
  key: keyof AggregateMetrics;
  label: string;
  accent: string;
  suffix: string;
  cost?: boolean;
};

const metricMeta: MetricMeta[] = [
  { key: "emissions", label: "Pollution Health", accent: "var(--chartreuse)", suffix: "" },
  { key: "congestion", label: "Congestion Health", accent: "var(--rose)", suffix: "" },
  { key: "peakDemand", label: "Energy Health", accent: "var(--amber)", suffix: "" },
  { key: "equityScore", label: "Social Equity", accent: "var(--teal)", suffix: "" },
  { key: "cost", label: "Financial Stability", accent: "var(--cyan)", suffix: "", cost: false },
];

export function MetricGrid({ aggregate }: MetricGridProps) {
  return (
    <section className={styles.grid}>
      {metricMeta.map((metric) => {
        const value = aggregate[metric.key];
        const displayValue = metric.cost ? `${metric.suffix}${value.toLocaleString()}` : `${metric.suffix}${value}`;

        return (
          <article className={styles.card} key={metric.key}>
            <span className={styles.label}>{metric.label}</span>
            <strong className={styles.value} style={{ color: metric.accent }}>
              {displayValue}
            </strong>
            <div className={styles.bar}>
              <div
                className={styles.fill}
                style={{
                  width: `${value}%`,
                  background: metric.accent,
                }}
              />
            </div>
          </article>
        );
      })}
    </section>
  );
}
