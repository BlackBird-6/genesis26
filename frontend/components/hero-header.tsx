import styles from "./hero-header.module.css";

export function HeroHeader() {
  return (
    <header className={styles.bar}>
      <span className={styles.brand}>WhatIf Toronto</span>
      <span className={styles.divider} />
      <span className={styles.subtitle}>Urban policy sandbox for downtown Toronto.</span>
    </header>
  );
}
