"use client";

import { useEffect } from "react";
import { ChatSidebar } from "./chat-sidebar";
import { HeroHeader } from "./hero-header";
import { MetricGrid } from "./metric-grid";
import { PolicyChips } from "./policy-chips";
import { ScenePanel } from "./scene-panel";
import { ZoneTable } from "./zone-table";
import { useScenarioStore } from "../store/scenario-store";
import styles from "./dashboard-shell.module.css";

export function DashboardShell() {
  const scenario = useScenarioStore((state) => state.scenario);
  const policies = useScenarioStore((state) => state.policies);
  const traces = useScenarioStore((state) => state.traces);
  const connectionStatus = useScenarioStore((state) => state.connectionStatus);
  const confidenceScore = useScenarioStore((state) => state.confidenceScore);
  const init = useScenarioStore((state) => state.init);
  const removePolicy = useScenarioStore((state) => state.removePolicy);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <main className={styles.page}>
      <div className={styles.chrome} />
      <section className={styles.mainColumn}>
        <HeroHeader
          aggregate={scenario.aggregate}
          lastPlanLabel={policies[0]?.label ?? "Backend-Driven Baseline"}
          connectionStatus={connectionStatus}
          confidenceScore={confidenceScore}
        />
        <div className={styles.sceneWrap}>
          <ScenePanel scenario={scenario} />
        </div>
        <MetricGrid aggregate={scenario.aggregate} />
        <div className={styles.lowerGrid}>
          <PolicyChips policies={policies} connectionStatus={connectionStatus} onRemove={removePolicy} />
          <ZoneTable traces={traces} />
        </div>
      </section>
      <aside className={styles.sidebar}>
        <ChatSidebar />
      </aside>
    </main>
  );
}
