"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ConversationController, ConversationSnapshot } from "@/lib/coaching/conversation/generated/conversationController";
import type { ConversationReportCategory } from "@/lib/coaching/conversation/generated/conversationBackendTypes";
import { conversationReasonLabel, conversationMessageLabel } from "@/lib/coaching/conversation/generated/conversationPresentation";
import { parseSendConversationInput } from "@/lib/coaching/conversation/generated/conversationTypes";


const categories: { value: ConversationReportCategory; label: string }[] = [
  { value: "harassment", label: "Harassment" }, { value: "unsafe_advice", label: "Unsafe advice" }, { value: "privacy", label: "Privacy" }, { value: "other", label: "Other" },
];
const deliveryText = { idle: "", sending: "Sending…", sent: "Sent.", not_sent: "Not sent. Review the text before sending again.", checking: "Checking delivery. Retry checks the exact original message; it does not send your edited draft.", unknown: "Delivery is unknown. The message may already have been delivered. Sending it again could create a duplicate." };
const reportText = { idle: "", sending: "Submitting report…", sent: "Report submitted.", not_sent: "Report was not submitted. Review your selection and try again.", checking: "Checking report submission.", unconfirmed: "Report submission could not be confirmed. Retry uses the original selection and category." };
const blockText = { idle: "", sending: "Updating block…", blocked: "This person is blocked.", unblocked: "Your block was removed. Sharing and follows have not been restored.", unconfirmed: "The block change could not be confirmed. Review and choose Block or Unblock again." };

type ViewProps = { controller: ConversationController; onRetry?: () => Promise<void>; planUpdates?: ReactNode };
type Surface = "Messages" | "Plan updates" | "Sharing" | "Safety";
const wideQuery = "(min-width: 1100px)";
const dayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
function subscribeWidth(notify: () => void) {
  const media = window.matchMedia?.(wideQuery);
  media?.addEventListener("change", notify);
  return () => media?.removeEventListener("change", notify);
}
function privateScope(state: ConversationSnapshot) {
  const a = state.availability;
  return !state.authorityPaused && !state.retired && a
    ? [a.accountId, a.enrollmentAttemptId, a.conversationId, a.controlRevision, a.viewerRole].join("/")
    : "";
}
export function ConversationView(props: ViewProps) {
  const { controller } = props;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const scope = privateScope(state);
  // Availability can advance before the refreshed transcript and disclosure arrive.
  const [seen, setSeen] = useState({ scope, messages: state.messages, policy: state.policy, staleMessages: false, stalePolicy: false });
  if (scope !== seen.scope || seen.messages !== state.messages || seen.policy !== state.policy) {
    setSeen({ scope, messages: state.messages, policy: state.policy,
      staleMessages: state.messages === seen.messages && (scope !== seen.scope || seen.staleMessages),
      stalePolicy: state.policy === seen.policy && (scope !== seen.scope || seen.stalePolicy) });
  }
  if (state.retired) return <p role="status">Your account session changed. Reload to continue.</p>;
  return <ConversationWorkspace key={scope} {...props} state={state} hideHistory={seen.staleMessages} hidePolicy={seen.stalePolicy} />;
}
function ConversationWorkspace({ controller, state, hideHistory, hidePolicy, onRetry = () => controller.refresh(), planUpdates }: ViewProps & {
  state: ConversationSnapshot; hideHistory: boolean; hidePolicy: boolean;
}) {
  const [surface, setSurface] = useState<Surface>("Messages");
  const wide = useSyncExternalStore(subscribeWidth, () => window.matchMedia?.(wideQuery).matches ?? false, () => false);
  const currentSurface = wide && surface === "Plan updates" ? "Messages" : surface;
  const threadVisible = currentSurface === "Messages";
  const nav = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const idFor = (name: Surface) => panelId + "-" + name.replace(" ", "-");
  const selectSurface = (name: Surface) => {
    setSurface(name);
    nav.current?.querySelector<HTMLButtonElement>(`[data-surface="${name}"]`)?.focus();
  };
  const composerId = useId(), categoryId = useId();
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const blockButton = useRef<HTMLButtonElement>(null), unblockButton = useRef<HTMLButtonElement>(null), blockHeading = useRef<HTMLHeadingElement>(null);
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const following = useRef(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [reportMode, setReportMode] = useState(false);
  const [category, setCategory] = useState<ConversationReportCategory>("harassment");
  const [blockCommand, setBlockCommand] = useState<boolean | null>(null);
  const [stopConfirmationFor, setStopConfirmationFor] = useState<string | null>(null);
  const [dismissCopy, setDismissCopy] = useState<"failed" | "unknown" | null>(null);
  const availability = state.authorityPaused ? null : state.availability;
  const sourceMessages = state.messages;
  const readScope = privateScope(state);
  const canReadHistory = availability?.capabilities.canReadHistory === true;
  const messages = !hideHistory && canReadHistory ? sourceMessages : [];
  const policy = !state.authorityPaused && !hidePolicy ? state.policy : null;
  const context = availability?.capabilities.canSend && state.context?.controlRevision === availability.controlRevision
    ? state.context?.context : null;
  const surfaces: Surface[] = ["Messages"];
  if (planUpdates && !wide) surfaces.push("Plan updates");
  surfaces.push("Sharing", "Safety");
  const canSend = availability?.capabilities.canSend === true && !state.retired;
  const knownConversation = availability?.conversationId != null;
  const pendingRequestId = state.pendingSend?.input.requestId ?? null;
  const stopConfirmation = stopConfirmationFor !== null && stopConfirmationFor === pendingRequestId;
  const checkingAccount = !state.journalReady && !state.ready && !state.authorityPaused && !state.error;
  const failedCopyBlocksSend = state.failedSendBody !== null && state.failedSendBody !== state.draft;
  let validMessage = false;
  try { parseSendConversationInput({ enrollmentAttemptId: "11111111-1111-4111-8111-111111111111", requestId: "11111111-1111-4111-8111-111111111111", expectedControlRevision: "0", body: state.draft }); validMessage = true; } catch {}
  const completeReport = (work: Promise<void>) => { void work.then(() => { if (controller.getSnapshot().reportFeedback === "sent") { setSelected([]); setReportMode(false); } }); };
  const rememberAnchor = () => {
    const root = transcript.current; if (!root) return;
    const top = root.getBoundingClientRect().top;
    const item = [...root.querySelectorAll<HTMLElement>("[data-message-id]")].find(node => node.getBoundingClientRect().bottom > top + 1);
    anchor.current = item ? { id: item.dataset.messageId!, offset: item.getBoundingClientRect().top - top } : null;
  };
  useLayoutEffect(() => {
    const root = transcript.current; if (!root || !threadVisible) return;
    if (following.current && !state.window.pinned) { root.scrollTop = root.scrollHeight; return; }
    const previous = anchor.current;
    if (previous) {
      const node = [...root.querySelectorAll<HTMLElement>("[data-message-id]")].find(item => item.dataset.messageId === previous.id);
      if (node) root.scrollTop += node.getBoundingClientRect().top - root.getBoundingClientRect().top - previous.offset;
    }
  }, [state.messages, state.window.pinned, state.authorityPaused, threadVisible]);
  useEffect(() => {
    const root = transcript.current;
    if (!root || !threadVisible || hideHistory || !canReadHistory || typeof IntersectionObserver === "undefined") return;
    let observing = true;
    const observer = new IntersectionObserver(entries => {
      const current = controller.getSnapshot();
      if (!observing || !root.isConnected || root.closest("[hidden]") || !document.hasFocus() || document.visibilityState !== "visible" ||
        privateScope(current) !== readScope || !current.availability?.capabilities.canReadHistory || current.messages !== sourceMessages) return;
      let highest: string | null = null;
      for (const entry of entries) {
        const sequence = (entry.target as HTMLElement).dataset.sequence;
        if (root.contains(entry.target) && entry.isIntersecting && entry.intersectionRect.height > 0 && sequence && (highest === null || BigInt(sequence) > BigInt(highest))) highest = sequence;
      }
      if (highest !== null) void controller.markVisible(highest);
    }, { root: null, threshold: [0, 0.01, 0.5, 1] });
    const observe = () => {
      observer.disconnect();
      if (document.hasFocus() && document.visibilityState === "visible") root.querySelectorAll("[data-sequence]").forEach(node => observer.observe(node));
    };
    observe(); window.addEventListener("focus", observe); document.addEventListener("visibilitychange", observe);
    return () => { observing = false; observer.disconnect(); window.removeEventListener("focus", observe); document.removeEventListener("visibilitychange", observe); };
  }, [controller, sourceMessages, readScope, canReadHistory, threadVisible, hideHistory]);
  const reportIds = selected.filter(id => messages.some(message => message.id === id));
  const statusLabel = checkingAccount ? "Checking your account…" : availability ? conversationReasonLabel(availability.reason) : state.loading ? "Loading conversation…" : "Conversation unavailable.";
  return <section className="coach-conversation">
    <header className="conversation-heading coach-page-intro">
      <div><h1>{context ? (availability?.viewerRole === "coach" ? context.buyerName : context.coachName) : "Conversation"}</h1>
        {context && <p className="conversation-plan-name">{context.planTitle}</p>}
      </div>
      {!state.authorityPaused && <p role="status" className="conversation-state" data-open={availability?.reason === "active" || undefined}>
        {availability?.reason === "active" ? <><span aria-hidden="true">Open</span><span className="sr-only">{statusLabel}</span></> : statusLabel}
      </p>}
    </header>
    <div className="conversation-navigation" role="tablist" aria-label="Conversation workspace" ref={nav}>
      {surfaces.map((name, i) => <button key={name} role="tab" type="button" id={idFor(name) + "-tab"}
        data-surface={name} aria-controls={idFor(name)} aria-selected={currentSurface === name}
        tabIndex={currentSurface === name ? 0 : -1} onClick={() => setSurface(name)} onKeyDown={event => {
          let next: Surface;
          if (event.key === "ArrowRight") next = surfaces[(i + 1) % surfaces.length];
          else if (event.key === "ArrowLeft") next = surfaces[(i + surfaces.length - 1) % surfaces.length];
          else if (event.key === "Home") next = surfaces[0];
          else if (event.key === "End") next = surfaces[surfaces.length - 1];
          else return;
          event.preventDefault(); selectSurface(next);
        }}>{name}</button>)}
    </div>
    {state.authorityPaused ? <p role="status">Your sign-in could not be verified. Conversations are paused. {state.journalReady ? "Your draft and delivery recovery are kept here." : "Draft recovery has not loaded yet. Editing is disabled until your account and recovery are checked."} <button onClick={() => void onRetry()}>Retry</button></p> : state.error && <p role="alert">{state.error} <button disabled={state.loading} onClick={() => void onRetry()}>Retry</button></p>}
    <div className={planUpdates && wide ? "conversation-layout conversation-layout-wide" : "conversation-layout"}>
      <div className="conversation-primary">
        <section className="conversation-thread" role="tabpanel" id={idFor("Messages")} aria-labelledby={idFor("Messages") + "-tab"} hidden={!threadVisible}>
          {(availability?.reason === "consent_required" || availability?.reason === "suspended") && policy &&
            <div className="conversation-notice"><button type="button" onClick={() => selectSurface("Sharing")}>Review sharing</button></div>}
          {reportMode && <div className="conversation-notice"><strong>Choose messages to report</strong>
            <p role="status">{reportIds.length} of 20 messages selected</p><div className="conversation-actions">
              <button type="button" disabled={!reportIds.length} onClick={() => { setReportMode(false); selectSurface("Safety"); }}>Review report</button>
              <button type="button" onClick={() => { setReportMode(false); setSelected([]); selectSurface("Safety"); }}>Cancel selection</button>
            </div></div>}
          <div className="conversation-actions">
            {state.window.nextBeforeSequence && <button disabled={state.loading} onClick={() => { following.current = false; rememberAnchor(); void controller.loadOlder(); }}>Load older messages</button>}
            {(state.window.pinned || state.newerAvailable) && <button disabled={state.loading} onClick={() => { following.current = true; anchor.current = null; void controller.returnToLatest(); }}>Return to latest{state.newerAvailable ? " · new messages" : ""}</button>}
          </div>
          <div className="conversation-transcript" ref={transcript} tabIndex={0} aria-label="Conversation messages" onScroll={() => {
            const root = transcript.current; if (!threadVisible || !root || root.closest("[hidden]")) return;
            const atBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 24;
            following.current = atBottom && !state.window.pinned;
            if (!atBottom) { rememberAnchor(); controller.pinHistory(); }
          }}>
            {!state.authorityPaused && !state.error && messages.length === 0 && <p className="conversation-empty">{checkingAccount || state.loading ? "Loading messages…" : canSend ? "Send a message to start the conversation." : "No messages to show."}</p>}
            <ol>{messages.map((message, index) => {
              const previous = messages[index - 1];
              const date = message.createdAt.slice(0, 10);
              const newDay = date !== previous?.createdAt.slice(0, 10);
              const sameAuthor = !newDay && message.kind === "text" && previous?.kind === "text" && previous.author === message.author;
              return <li key={message.id} data-message-id={message.id}>
                {newDay && <div className="conversation-day"><time dateTime={date}>{dayFormat.format(new Date(date))} UTC</time></div>}
                <article className={`conversation-message conversation-message-${message.kind}${message.kind === "text" && message.author === availability?.viewerRole ? " conversation-message-own" : ""}`}>
                  {message.kind === "text" ? <>
                    <div className="conversation-message-meta">
                      <span className={sameAuthor ? "sr-only" : undefined}>{message.author === "coach" ? "Coach" : "Client"}</span>
                      <time dateTime={message.createdAt}><span className="sr-only">{date} </span>{message.createdAt.slice(11, 16)}<span className="sr-only"> UTC</span></time>
                    </div>
                    <p className="conversation-text" data-sequence={message.sequence}>{message.body}</p>
                    {reportMode && <label className="conversation-selection"><input type="checkbox" checked={reportIds.includes(message.id)} disabled={state.pendingReport !== null || (!reportIds.includes(message.id) && reportIds.length >= 20)} onChange={event => setSelected(current => event.target.checked ? [...current, message.id] : current.filter(id => id !== message.id))} />Select {message.author === "coach" ? "coach" : "client"} message for report</label>}
                  </> : <p data-sequence={message.sequence}>{conversationMessageLabel(message)}</p>}
                </article>
              </li>;
            })}</ol>
          </div>
          {!canSend && availability && <p>New messages are unavailable for this enrollment.</p>}
          <form className="conversation-composer" onSubmit={event => { event.preventDefault(); if (!state.journalReady || !validMessage || !canSend || state.busy || state.pendingSend || failedCopyBlocksSend) return; void controller.sendDraft().then(() => composer.current?.focus()); }}>
            <label htmlFor={composerId}>Message</label>
            <textarea ref={composer} id={composerId} className="coach-input" rows={2} placeholder="Write a message…" value={state.draft} disabled={!state.journalReady} onChange={event => { if (state.journalReady) void controller.setDraft(event.target.value); }} aria-invalid={state.draft.length > 0 && !validMessage} aria-describedby={`${composerId}-help ${composerId}-validation`} />
            {!state.journalReady && !state.authorityPaused && <p role="status">Draft recovery has not loaded yet. Editing is disabled until your account and recovery are checked.</p>}
            <p className="conversation-counter">{[...state.draft].length}/2,000 characters</p>
            <p id={`${composerId}-validation`}>{state.draft.length > 0 && !validMessage ? "Use 1–2,000 nonblank characters and remove unsupported characters." : ""}</p>
            {!state.draftSaved && <p role="status">This draft has not been saved. Keep or copy the text before leaving.</p>}
            {failedCopyBlocksSend && <p>Keep or dismiss the earlier unsent copy before sending another message.</p>}
            <div className="conversation-compose-footer">
              <div className="conversation-actions"><button className="coach-primary" type="submit" disabled={!state.journalReady || !canSend || state.busy || state.pendingSend !== null || !validMessage || failedCopyBlocksSend}>Send message</button>
              {state.pendingSend && <><button type="button" disabled={state.busy || state.authorityPaused} onClick={() => void controller.retryDelivery()}>Retry delivery check</button><button type="button" disabled={state.busy} onClick={() => setStopConfirmationFor(pendingRequestId)}>Stop checking delivery</button></>}</div>
              <details className="conversation-draft-info"><summary>Draft and delivery recovery</summary><p id={`${composerId}-help`}>Plain text, up to 2,000 characters. Draft and delivery recovery survive refresh in this tab, but not closing the tab or clearing browser data.</p></details>
            </div>
            {stopConfirmation && state.pendingSend && <div role="group" aria-label="Confirm stop checking delivery"><p>Delivery remains unknown. This message may already have been delivered. Sending it again could create a duplicate. The original text will stay available to keep or copy.</p><button type="button" disabled={state.busy} onClick={() => { void controller.stopCheckingDelivery().then(() => { setStopConfirmationFor(null); composer.current?.focus(); }); }}>Confirm stop checking</button><button type="button" onClick={() => setStopConfirmationFor(null)}>Keep checking</button></div>}
            <p role="status" aria-live="polite">{deliveryText[state.delivery]}</p>
            {state.pendingSend && <details><summary>Original message awaiting confirmation</summary><p className="conversation-text">{state.pendingSend.input.body}</p></details>}
            {state.failedSendBody && <details open><summary>Unsent message to keep or copy</summary><p className="conversation-text">{state.failedSendBody}</p><button type="button" onClick={() => setDismissCopy("failed")}>Dismiss unsent copy</button></details>}
            {state.unknownSendBody && <details open><summary>Message with unknown delivery to keep or copy</summary><p>This message may already have been delivered. Sending it again could create a duplicate.</p><p className="conversation-text">{state.unknownSendBody}</p><button type="button" onClick={() => setDismissCopy("unknown")}>Dismiss unknown-delivery copy</button></details>}
            {dismissCopy && <div role="group" aria-label="Confirm dismiss saved copy"><p>{dismissCopy === "unknown" ? "Delivery remains unknown and this message may already have been delivered. Sending it again could create a duplicate. " : ""}Remove this saved copy? Keep or copy any text you need before continuing.</p><button type="button" disabled={state.busy} onClick={() => { void (dismissCopy === "unknown" ? controller.dismissUnknownSend() : controller.dismissFailedSend()).then(() => { setDismissCopy(null); composer.current?.focus(); }); }}>Confirm dismiss copy</button><button type="button" onClick={() => setDismissCopy(null)}>Keep copy</button></div>}
          </form>
        </section>
        <section className="conversation-panel" role="tabpanel" id={idFor("Sharing")} aria-labelledby={idFor("Sharing") + "-tab"} hidden={currentSurface !== "Sharing"}>
            <h2>Sharing</h2>
            {!policy && !context && <p>{state.loading || checkingAccount ? "Loading sharing details…" : "Sharing details are unavailable for this enrollment."}</p>}
          {policy && <section className="conversation-section"><h3>{availability?.viewerRole === "buyer" ? `Review sharing with ${policy.coachName}` : "Review sharing for this enrollment"}</h3>
            <p className="conversation-text">{policy.body}</p>
            <p>Messages are stored on Kamee&apos;s servers. Sharing includes the authorized plan and schedule summary below. Private Kamy chats stay separate. Shared Kamy is unavailable. Plan proposals require separate consent.</p>
            {knownConversation && (availability?.reason === "consent_required" || availability?.reason === "suspended") && <button className="coach-primary" disabled={state.busy} onClick={() => void controller.confirmConsent(policy)}>Review and confirm sharing</button>}
          </section>}
          {context && <section className="conversation-section" aria-labelledby="shared-context-title">
            <h2 id="shared-context-title">Shared context</h2><h3>{context.planTitle}</h3><p>{context.buyerName} · {context.coachName}</p>
            {state.context?.incomplete ? <p>The schedule summary is incomplete. Only authorized title and names are shown.</p> : <ul>{context.days.map(day => <li key={day.scheduleRowId}>{day.scheduledDate} · {day.dayLabel} · {day.state.replaceAll("_", " ")}</li>)}</ul>}
          </section>}
        </section>
        <section className="conversation-panel" role="tabpanel" id={idFor("Safety")} aria-labelledby={idFor("Safety") + "-tab"} hidden={currentSurface !== "Safety"}>
          <h2>Safety</h2>
          {!knownConversation && <p>Safety controls are available when this conversation can be verified.</p>}
          {knownConversation && <>
            <section className="conversation-section" aria-labelledby="report-title"><h3 id="report-title">Report messages</h3><p>Reporting is separate from blocking.</p>
              <button disabled={state.pendingReport !== null || !availability?.capabilities.canReadHistory} onClick={() => { setReportMode(true); selectSurface("Messages"); }}>Select messages to report</button>
              <p>{reportIds.length} of 20 messages selected</p><label htmlFor={categoryId}>Report category</label>
              <select id={categoryId} className="coach-input" value={category} disabled={state.pendingReport !== null} onChange={event => setCategory(event.target.value as ConversationReportCategory)}>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <div className="conversation-actions"><button className="coach-primary" disabled={state.busy || state.pendingReport !== null || reportIds.length === 0 || availability?.capabilities.canReadHistory !== true} onClick={() => completeReport(controller.report(reportIds, category))}>Submit report</button>
                {state.pendingReport && <button disabled={state.busy} onClick={() => completeReport(controller.retryReport())}>Retry report check</button>}</div><p role="status">{reportText[state.reportFeedback]}</p>
            </section>
            <section className="conversation-section" aria-labelledby="block-title"><h3 id="block-title" ref={blockHeading} tabIndex={-1}>Block controls</h3>
              <p>Blocking affects communication with this person across Kamee and removes follows in both directions. Unblocking restores neither follows nor sharing. The other person&apos;s block may still apply.</p>
              <div className="conversation-actions"><button className="conversation-quiet" ref={blockButton} disabled={state.busy} onClick={() => setBlockCommand(true)}>Block this person</button><button className="conversation-quiet" ref={unblockButton} disabled={state.busy} onClick={() => setBlockCommand(false)}>Unblock this person</button></div>
              {blockCommand !== null && <div role="group" aria-label="Confirm global block change"><p>{blockCommand ? "Confirm blocking this person across Kamee?" : "Confirm removing your block across Kamee?"}</p><div className="conversation-actions"><button disabled={state.busy} onClick={() => { const blocked = blockCommand; setBlockCommand(null); blockHeading.current?.focus(); void controller.block(blocked).then(() => window.requestAnimationFrame(() => (blocked ? blockButton : unblockButton).current?.focus())); }}>Confirm {blockCommand ? "Block" : "Unblock"}</button><button onClick={() => { const blocked = blockCommand; setBlockCommand(null); (blocked ? blockButton : unblockButton).current?.focus(); }}>Cancel</button></div></div>}
              <p role="status">{blockText[state.blockFeedback]}</p>
            </section>
            {availability?.viewerRole === "buyer" && <button disabled={state.busy} onClick={() => void controller.suspend()}>Suspend sharing</button>}
          </>}
        </section>
      </div>
      {planUpdates && <aside className="conversation-sidebar" role={wide ? "complementary" : "tabpanel"} id={idFor("Plan updates")}
        aria-label={wide ? "Plan updates" : undefined} aria-labelledby={wide ? undefined : idFor("Plan updates") + "-tab"}
        hidden={!wide && currentSurface !== "Plan updates"}>{planUpdates}</aside>}
    </div>
  </section>;
}
