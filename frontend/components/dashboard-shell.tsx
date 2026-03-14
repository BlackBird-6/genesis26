"use client";

import { useEffect } from "react";
import { ChatSidebar } from "./chat-sidebar";
import { HeroHeader } from "./hero-header";
import { MetricGrid } from "./metric-grid";
import { PolicyChips } from "./policy-chips";
import { ScenePanel } from "./scene-panel";
import { useScenarioStore } from "../store/scenario-store";
import styles from "./dashboard-shell.module.css";

export function DashboardShell() {
  const scenario = useScenarioStore((state) => state.scenario);
  const policies = useScenarioStore((state) => state.policies);
  const connectionStatus = useScenarioStore((state) => state.connectionStatus);
  const init = useScenarioStore((state) => state.init);
  const removePolicy = useScenarioStore((state) => state.removePolicy);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <main className={styles.page}>
      <div className={styles.chrome} />
      <section className={styles.mainColumn}>
        <HeroHeader />
        <div className={styles.sceneWrap}>
          <ScenePanel scenario={scenario} />
        </div>
        <MetricGrid aggregate={scenario.aggregate} />
        <div className={styles.lowerGrid}>
          <PolicyChips policies={policies} connectionStatus={connectionStatus} onRemove={removePolicy} />
        </div>
      </section>
      <aside className={styles.sidebar}>
        <ChatSidebar />
      </aside>
    </main>
  );
}
