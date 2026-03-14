import type { ActivePolicyRecord, ConnectionStatus } from "../lib/types";
import styles from "./policy-chips.module.css";

type PolicyChipsProps = {
  policies: ActivePolicyRecord[];
  connectionStatus: ConnectionStatus;
  onRemove: (policyId: string) => void;
};

export function PolicyChips({ policies, connectionStatus, onRemove }: PolicyChipsProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Active Policies</p>
          <h2 className={styles.title}>Backend policy registry</h2>
        </div>
        <span className={styles.status}>Socket {connectionStatus}</span>
      </div>
      <div className={styles.chips}>
        {policies.length === 0 ? (
          <div className={styles.empty}>No active policies. Submit a scenario to create one.</div>
        ) : (
          policies.map((policy) => (
            <div className={styles.policyRow} key={policy.policyId}>
              <div className={styles.policyMeta}>
                <strong>{policy.label}</strong>
                <p>{policy.policyText}</p>
              </div>
              <button className={styles.remove} onClick={() => onRemove(policy.policyId)} type="button">
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
