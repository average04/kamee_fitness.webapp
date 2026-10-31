"use client";
import { useEffect, useState } from "react";
import { COACHING_CONVERSATIONS_ENABLED } from "@/lib/coaching/conversation/flags";
import { captureBrowserConversationApi, createBrowserConversationRuntime } from "@/lib/coaching/conversation/runtime";
import { createSessionConversationJournal } from "@/lib/coaching/conversation/journal";
import { createConversationController, type ConversationController } from "@/lib/coaching/conversation/generated/conversationController";
import { createConversationLifecycle } from "@/lib/coaching/conversation/lifecycle";
import { ConversationView } from "./ConversationView";

type CoachConversationProps = { accountId: string; attemptId: string };

export function CoachConversation(props: CoachConversationProps) {
  // The identity key owns the stateful container, before any private view can render.
  return <CoachConversationSession key={`${props.accountId}:${props.attemptId}`} {...props} />;
}

function CoachConversationSession({ accountId, attemptId }: CoachConversationProps) {
  const [resource, setResource] = useState<{ controller: ConversationController; retry(): Promise<void> } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!COACHING_CONVERSATIONS_ENABLED) return;
    let disposed = false; let cleanup: (() => void) | undefined;
    void Promise.resolve().then(() => {
      if (disposed) return;
      const runtime = createBrowserConversationRuntime(accountId);
      cleanup = () => runtime.dispose();
      const manager = createSessionConversationJournal();
      const conversation = createConversationController({ actor: runtime.actor, attemptId, expectedViewerRole: "coach",
        api: () => captureBrowserConversationApi(runtime), journal: manager.bind(runtime.actor), newRequestId: () => crypto.randomUUID(),
        subscribeBoundary: listener => { const auth = runtime.subscribeBoundary(listener); const storage = manager.subscribeFence(accountId, listener); return () => { auth(); storage(); }; } });
      const stopVerification = runtime.subscribeVerification(verified => conversation.setAuthorityPaused(!verified));
      const lifecycle = createConversationLifecycle({ verify: runtime.verify, refresh: () => conversation.getSnapshot().journalReady ? conversation.refresh() : conversation.initialize(),
        setAvailable: runtime.setActive,
        setActive: conversation.setActive, schedule: (tick, ms) => { const timer = window.setInterval(tick, ms); return () => window.clearInterval(timer); } });
      const retry = () => lifecycle.update({ focused: document.hasFocus(), visible: document.visibilityState === "visible", online: navigator.onLine });
      const signal = () => { void retry(); };
      window.addEventListener("focus", signal); window.addEventListener("blur", signal); window.addEventListener("online", signal); window.addEventListener("offline", signal); document.addEventListener("visibilitychange", signal);
      setResource({ controller: conversation, retry }); signal();
      cleanup = () => { window.removeEventListener("focus", signal); window.removeEventListener("blur", signal); window.removeEventListener("online", signal); window.removeEventListener("offline", signal); document.removeEventListener("visibilitychange", signal); stopVerification(); lifecycle.dispose(); conversation.dispose(); runtime.dispose(); };
    }).catch(() => { cleanup?.(); if (!disposed) setFailed(true); });
    return () => { disposed = true; cleanup?.(); };
  }, [accountId, attemptId]);
  if (!COACHING_CONVERSATIONS_ENABLED) return <p>Conversations are not available yet.</p>;
  if (!resource) return <p role="status">{failed ? "Conversation recovery storage is unavailable. Enable this site's storage and reload to retry." : "Checking your account…"}</p>;
  return <ConversationView key={`${accountId}:${attemptId}`} controller={resource.controller} onRetry={resource.retry} />;
}
