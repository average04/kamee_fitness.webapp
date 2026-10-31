"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { PageIntro } from "../PageIntro";
import { CoachLink } from "../CoachLink";
import { COACHING_CONVERSATIONS_ENABLED } from "@/lib/coaching/conversation/flags";
import { captureBrowserConversationApi, createBrowserConversationRuntime } from "@/lib/coaching/conversation/runtime";
import { createCoachClientsController } from "@/lib/coaching/conversation/clients";
import { conversationReasonLabel } from "@/lib/coaching/conversation/generated/conversationPresentation";
import { createConversationLifecycle } from "@/lib/coaching/conversation/lifecycle";

type CoachClientsProps = { accountId: string };

export function CoachClients(props: CoachClientsProps) {
  return <CoachClientsSession key={props.accountId} {...props} />;
}

function CoachClientsSession({ accountId }: CoachClientsProps) {
  const [resource, setResource] = useState<{ controller: ReturnType<typeof createCoachClientsController>; retry(): Promise<void> } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!COACHING_CONVERSATIONS_ENABLED) return;
    let disposed = false; let cleanup: (() => void) | undefined;
    void Promise.resolve().then(() => {
      if (disposed) return;
      const runtime = createBrowserConversationRuntime(accountId);
      cleanup = () => runtime.dispose();
      const clients = createCoachClientsController({ actor: runtime.actor, api: () => captureBrowserConversationApi(runtime), subscribeBoundary: runtime.subscribeBoundary });
      const stopVerification = runtime.subscribeVerification(verified => clients.setAuthorityPaused(!verified));
      const lifecycle = createConversationLifecycle({ verify: runtime.verify, refresh: () => clients.initialize(), setActive: clients.setActive,
        setAvailable: runtime.setActive,
        schedule: (tick, ms) => { const timer = window.setInterval(tick, ms); return () => window.clearInterval(timer); } });
      const retry = () => lifecycle.update({ focused: document.hasFocus(), visible: document.visibilityState === "visible", online: navigator.onLine });
      const signal = () => { void retry(); };
      window.addEventListener("focus", signal); window.addEventListener("blur", signal); window.addEventListener("online", signal); window.addEventListener("offline", signal); document.addEventListener("visibilitychange", signal);
      setResource({ controller: clients, retry }); signal();
      cleanup = () => { window.removeEventListener("focus", signal); window.removeEventListener("blur", signal); window.removeEventListener("online", signal); window.removeEventListener("offline", signal); document.removeEventListener("visibilitychange", signal); stopVerification(); lifecycle.dispose(); clients.dispose(); runtime.dispose(); };
    }).catch(() => { cleanup?.(); if (!disposed) setFailed(true); });
    return () => { disposed = true; cleanup?.(); };
  }, [accountId]);
  if (!COACHING_CONVERSATIONS_ENABLED) return <p>Conversations are not available yet.</p>;
  if (!resource) return <p role="status">{failed ? "Conversations could not be loaded. Reload to retry." : "Checking your account…"}</p>;
  return <CoachClientsView controller={resource.controller} onRetry={resource.retry} />;
}

export function CoachClientsView({ controller, onRetry = () => controller.initialize() }: { controller: ReturnType<typeof createCoachClientsController>; onRetry?: () => Promise<void> }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  if (state.retired) return <p role="status">Your account session changed. Reload to continue.</p>;
  if (state.authorityPaused) return <p role="status">Your sign-in could not be verified. Conversations are paused. <button onClick={() => void onRetry()}>Retry</button></p>;
  if (!state.ready && !state.policy && !state.error) return <p role="status">Checking your account…</p>;
  return <section className="coach-conversation">
    <PageIntro title="Clients" description="Human coaching conversations for each enrollment." />
    {state.error && <p role="alert">{state.error} <button onClick={() => void onRetry()}>Retry</button></p>}
    <section className="conversation-panel" aria-labelledby="service-policy-title">
      <h2 id="service-policy-title">Conversation service</h2>
      {state.policy ? <>
        <details><summary>Review service policy</summary><p className="conversation-text">{state.policy.body}</p></details>
        <button disabled={state.busy} onClick={() => void controller.acceptPolicy()}>Accept service policy</button>
        {state.accepted && <p role="status">Service policy accepted.</p>}
      </> : <p>Service policy is unavailable.</p>}
      <p>Service availability and sharing in each conversation are separate choices.</p>
      <div className="conversation-actions"><button disabled={state.busy} onClick={() => void controller.setService(true)}>Make available</button><button disabled={state.busy} onClick={() => void controller.setService(false)}>Pause availability</button></div>
      {state.serviceFeedback && <p role="status">{state.serviceFeedback}</p>}
    </section>
    <section className="conversation-panel" aria-labelledby="conversation-list-title">
      <h2 id="conversation-list-title">Conversations</h2>
      {state.loading && state.items.length === 0 ? <p role="status">Loading conversations…</p> : state.ready && !state.error && state.items.length === 0 ? <p>No coach conversations on this page.</p> : null}
      <ul className="conversation-roster">{state.items.map(item => <li key={item.conversationId}>
        <CoachLink href={`/coaching/clients/${item.enrollmentAttemptId}`}><strong>Conversation</strong><span>{conversationReasonLabel(item.availability.reason)}</span><span>{item.unreadCount} unread</span></CoachLink>
      </li>)}</ul>
      <div className="conversation-actions"><button disabled={state.loading && state.items.length === 0} onClick={() => void controller.page()}>First page</button>{state.nextAfterId && <button disabled={state.loading && state.items.length === 0} onClick={() => void controller.page(state.nextAfterId)}>Next conversations</button>}</div>
    </section>
  </section>;
}
