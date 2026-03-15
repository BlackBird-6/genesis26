"use client";

import { FormEvent, useState, useTransition, useEffect, useRef } from "react";
import { useScenarioStore } from "../store/scenario-store";
import styles from "./chat-sidebar.module.css";

const quickPrompts = [
  "What if we shift 35% of EV charging to off-peak?",
  "Add 3 cooling centers in the highest-risk areas.",
  "Subsidize transit and reduce car traffic by 20%.",
  "Reduce food waste in restaurants by 20%.",
  "What's the best package to reduce emissions without worsening equity?",
];

export function ChatSidebar() {
  const messages = useScenarioStore((state) => state.messages);
  const isApplying = useScenarioStore((state) => state.isApplying);
  const applyPrompt = useScenarioStore((state) => state.applyPrompt);
  const connectionStatus = useScenarioStore((state) => state.connectionStatus);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const hasUserPrompt = messages.some((message) => message.role === "user");

  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isApplying, isPending]);

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    if (event) {
      event.preventDefault();
    }
    const prompt = draft.trim();
    if (!prompt) {
      return;
    }

    setDraft("");
    startTransition(() => {
      void applyPrompt(prompt);
    });
  }

  function handleQuickPrompt(prompt: string) {
    setDraft(prompt);
    startTransition(() => {
      void applyPrompt(prompt);
    });
  }

  return (
    <section className={styles.panel}>
      <div className={styles.top}>
        <p className={styles.eyebrow}>Policy Chat</p>
        <h2 className={styles.title}>Scenario input</h2>

        <p className={styles.connection}>Connection: {connectionStatus}</p>
      </div>

      <div className={styles.thread} ref={threadRef}>
        {messages.map((message) => (
          <article className={`${styles.message} ${styles[message.role]}`} key={message.id}>
            <span className={styles.role}>{message.role}</span>
            <p>{message.content}</p>
          </article>
        ))}
        {(isApplying || isPending) && <div className={styles.typing}>Running backend agents and updating district state...</div>}
      </div>

      {!hasUserPrompt ? (
        <div className={styles.quickPrompts}>
          {quickPrompts.map((prompt) => (
            <button className={styles.quickPrompt} key={prompt} onClick={() => handleQuickPrompt(prompt)} type="button">
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          className={styles.input}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Enter a scenario request for charging, transit, cooling, or waste..."
          rows={4}
          value={draft}
        />
        <button className={styles.submit} disabled={isApplying || isPending} type="submit">
          Run scenario
        </button>
      </form>
    </section>
  );
}
