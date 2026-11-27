"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { createBrowserConversationRuntime } from "@/lib/coaching/conversation/runtime";
import { createConversationApi } from "@/lib/coaching/conversation/generated/conversationApi";
import type { ConversationController, ConversationSnapshot } from "@/lib/coaching/conversation/generated/conversationController";
import { createCoachProposalsController, type CoachProposalsController } from "@/lib/coaching/proposals/controller";
import { createProposalJournal } from "@/lib/coaching/proposals/journal";
import { captureBrowserProposalsApi } from "@/lib/coaching/proposals/transport";
import { proposalOperationKey, type ProposalEditTarget, type ProposalOperation, type ProposalReviewChange, type ProposalTiming } from "@/lib/coaching/proposals/types";
import { enrollmentDate } from "@/lib/coaching/conversation/generated/enrollmentTypes";
type Day = { scheduleRowId: string; dayLabel: string; state: string; scheduledDate?: string };
type GetDays = (after: string | null) => Promise<{ days: Day[]; next: string | null }>;
function conversationKey(state: ConversationSnapshot, accountId: string, attemptId: string) {
  const a = state.availability;
  return !state.retired && !state.authorityPaused && a?.viewerRole === "coach" && a.accountId === accountId && a.enrollmentAttemptId === attemptId && a.conversationId && a.capabilities.canReadHistory
    ? `${accountId}/${attemptId}/${a.conversationId}/${a.controlRevision}/${a.reason}` : "";
}
const labels = { move_occurrence: "Schedule change", edit_strength_slot: "Strength prescription", edit_timed_outdoor: "Outdoor intervals" };
const status = { pending: "Awaiting buyer review", applied: "Applied", declined: "Current plan kept", withdrawn: "Withdrawn", conflict: "Schedule changed", closed: "Closed", superseded: "Plan updated since this proposal" };
function number(value: string, min: number, max: number) { return /^\d{1,6}$/.test(value) && Number(value) >= min && Number(value) <= max ? Number(value) : null; }
function strength(value: { sets: number; reps: string; restSeconds: number | null }) { return `${value.sets} sets · Target ${value.reps} · ${value.restSeconds === null ? "Rest unspecified" : `${value.restSeconds}s rest`}`; }
function timing(value: { timings: ProposalTiming[]; targetSeconds: number }) { return `${value.targetSeconds}s total; ` + value.timings.map(t => t.kind === "leaf" ? `${t.seconds}s` : `Repeat ${t.repeat} × (${t.of.map(l => `${l.seconds}s`).join(", ")})`).join("; "); }
function Changes({ changes }: { changes: ProposalReviewChange[] }) {
  return <dl className="proposal-comparison">{changes.map(change => {
    const before = change.kind === "move_occurrence" ? change.before.scheduledDate + (change.before.scheduledTime ? ` at ${change.before.scheduledTime}` : "") : change.kind === "edit_strength_slot" ? strength(change.before) : timing(change.before);
    const after = change.kind === "move_occurrence" ? change.after.scheduledDate + (change.after.scheduledTime ? ` at ${change.after.scheduledTime}` : "") : change.kind === "edit_strength_slot" ? strength(change.after) : timing(change.after);
    return <div key={proposalOperationKey(change)}><dt><strong>{change.kind === "edit_strength_slot" ? change.label : labels[change.kind]} · {change.selector.scheduledDate}</strong></dt><dd><span>Before</span> {before}</dd><dd><span>After</span> {after}</dd></div>;
  })}</dl>;
}
type Add = (change: ProposalOperation) => void;
function StrengthEditor({ slot, blocked, add }: { slot: ProposalEditTarget["strength"][number]; blocked: boolean; add: Add }) {
  const repsEditable = slot.trackingType === "reps" || slot.trackingType === "weight_reps";
  const [sets, setSets] = useState(String(slot.sets)), [reps, setReps] = useState(repsEditable && number(slot.reps, 1, 999) !== null ? slot.reps : ""), [rest, setRest] = useState(slot.restSeconds?.toString() ?? "");
  const s = number(sets, 1, 30), r = reps === "" ? null : number(reps, 1, 999), pause = rest === "" ? null : number(rest, 0, 3600);
  const changes: Extract<ProposalOperation, { kind: "edit_strength_slot" }>["changes"] = {};
  if (s !== null && s !== slot.sets) changes.sets = s;
  if (repsEditable && r !== null && String(r) !== slot.reps) changes.repCount = r;
  if (pause !== slot.restSeconds) changes.restSeconds = pause;
  const invalid = s === null || (repsEditable && reps !== "" && r === null) || (rest !== "" && pause === null);
  return <fieldset disabled={blocked}><legend className="sr-only">{slot.label}</legend><p className="proposal-prescription">Current · {strength(slot)}</p>
    <div className="proposal-rep-fields">
      <label>Sets (1–30)<input className="coach-input" inputMode="numeric" value={sets} onChange={e => setSets(e.target.value)} maxLength={2} /></label>
      {repsEditable && <label>Repetitions (1–999)<input className="coach-input" inputMode="numeric" value={reps} onChange={e => setReps(e.target.value)} maxLength={3} /></label>}
    </div>
    <label>Rest seconds (0–3,600)<input className="coach-input" inputMode="numeric" value={rest} onChange={e => setRest(e.target.value)} maxLength={4} /><small>Leave blank for unspecified rest.</small></label>
    {invalid && <p role="status">Use the ranges shown beside each field.</p>}
    <button type="button" disabled={invalid || !Object.keys(changes).length} onClick={() => add({ kind: "edit_strength_slot", selector: slot.selector, changes })}>Add strength change</button>
  </fieldset>;
}
function OutdoorEditor({ outdoor, add, blocked }: { outdoor: NonNullable<ProposalEditTarget["outdoor"]>; add: Add; blocked: boolean }) {
  const [values, setValues] = useState(() => outdoor.timings.map(t => t.kind === "leaf" ? [String(t.seconds)] : [String(t.repeat), ...t.of.map(l => String(l.seconds))]));
  const [index, setIndex] = useState(0);
  let invalid = false;
  const timings: ProposalTiming[] = outdoor.timings.map((t, i) => {
    const read = (p: number, max: number) => { const n = number(values[i]?.[p] ?? "", 1, max); if (n === null) invalid = true; return n ?? 1; };
    return t.kind === "leaf" ? { kind: "leaf", seconds: read(0, 21600) } : { kind: "repeat", repeat: read(0, 100), of: t.of.map((_, j) => ({ kind: "leaf", seconds: read(j + 1, 21600) })) };
  });
  const total = timings.reduce((n, t) => n + (t.kind === "leaf" ? t.seconds : t.repeat * t.of.reduce((s, l) => s + l.seconds, 0)), 0);
  const leaves = timings.reduce((n, t) => n + (t.kind === "leaf" ? 1 : t.repeat * t.of.length), 0);
  const same = JSON.stringify(timings) === JSON.stringify(outdoor.timings), item = outdoor.timings[index];
  return <fieldset disabled={blocked}><legend>Outdoor intervals</legend><p>Interval {index + 1} of {timings.length}</p>
    <div className="conversation-actions"><button type="button" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Previous interval</button><button type="button" disabled={index === timings.length - 1} onClick={() => setIndex(i => i + 1)}>Next interval</button></div>
    {values[index]?.map((v, p) => <label key={p}>{item.kind === "leaf" ? "Interval seconds" : p === 0 ? "Repeat count (1–100)" : `Part ${p} seconds`}<input className="coach-input" inputMode="numeric" value={v} maxLength={5} onChange={e => setValues(rows => rows.map((r, i) => i === index ? r.map((a, j) => j === p ? e.target.value : a) : r))} /></label>)}
    {(invalid || total > 86400 || leaves > 10000) && <p role="status">Use valid intervals within one day and 10,000 expanded parts.</p>}
    <button type="button" disabled={invalid || same || total > 86400 || leaves > 10000} onClick={() => add({ kind: "edit_timed_outdoor", selector: outdoor.selector, timings })}>Add interval changes</button>
  </fieldset>;
}
function TargetEditor({ target, add, blocked }: { target: ProposalEditTarget; add: Add; blocked: boolean }) {
  const [date, setDate] = useState(target.occurrence.scheduledDate), [slotId, setSlot] = useState<string | null>(null), [count, setCount] = useState(20);
  const slot = target.strength.find(s => s.selector.slotId === slotId), valid = enrollmentDate.safeParse(date).success && date !== target.occurrence.scheduledDate;
  return <fieldset disabled={blocked}><legend className="sr-only">Scheduled {target.occurrence.scheduledDate} in this enrollment’s time zone</legend>
    <details className="proposal-reschedule" open={!target.strength.length && !target.outdoor}><summary>Reschedule this day</summary>
      <div><label>New date<input type="date" className="coach-input" value={date} onChange={e => setDate(e.target.value)} /></label>
        <p>Choose a future date in this enrollment’s time zone. Today and past dates aren’t available.</p>
        <button type="button" disabled={!valid} onClick={() => add({ kind: "move_occurrence", selector: target.occurrence, newDate: date })}>Add date change</button></div>
    </details>
    <div className="conversation-actions proposal-exercises">{target.strength.slice(0, count).map(s => <button type="button" key={s.selector.slotId} aria-pressed={slotId === s.selector.slotId} onClick={() => setSlot(s.selector.slotId)}>Edit {s.label}</button>)}
      {count < target.strength.length && <button type="button" onClick={() => setCount(n => n + 20)}>More exercises</button>}
      {target.outdoor && <button type="button" aria-pressed={slotId === "outdoor"} onClick={() => setSlot("outdoor")}>Edit outdoor intervals</button>}</div>
    {slot && <StrengthEditor key={slot.selector.slotId} slot={slot} add={add} blocked={blocked} />}
    {slotId === "outdoor" && target.outdoor && <OutdoorEditor outdoor={target.outdoor} add={add} blocked={blocked} />}
  </fieldset>;
}
function Editor({ controller, days, getDays }: { controller: CoachProposalsController; days: Day[]; getDays?: GetDays }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [changes, setChanges] = useState<ProposalOperation[]>([]), [note, setNote] = useState(""), [problem, setProblem] = useState<string | null>(null);
  const [scheduleRetry, setScheduleRetry] = useState(0);
  const [schedule, setSchedule] = useState<{ days: Day[]; next: string | null; loading: boolean; error: boolean }>({ days: [], next: null, loading: true, error: false });
  useEffect(() => {
    if (!getDays) return;
    let live = true;
    void getDays(null).then(v => { if (live) setSchedule({ ...v, loading: false, error: false }); }, () => { if (live) setSchedule({ days: [], next: null, loading: false, error: true }); });
    return () => { live = false; };
  }, [getDays, scheduleRetry]);
  const selectable = (getDays ? schedule.days : days).filter(d => d.state === "scheduled"), blocked = state.busy || state.pending;
  const add: Add = change => {
    const key = proposalOperationKey(change);
    if (changes.length >= 20 && !changes.some(v => proposalOperationKey(v) === key)) { setProblem("Remove a change before adding another."); return; }
    setChanges(values => [...values.filter(v => proposalOperationKey(v) !== key), change]); controller.discardPreview(); setProblem(null);
  };
  return <section className="proposal-editor" aria-label="Create proposal"><h3>Propose a change</h3>
    <p>Choose a day to edit. Workouts already started keep their original prescriptions.</p>
    <h4>Scheduled day</h4>
    <div className="proposal-days">{selectable.map(day => <button type="button" key={day.scheduleRowId} disabled={blocked}
      aria-pressed={state.targets?.occurrence.scheduleRowId === day.scheduleRowId} onClick={() => void controller.choose(day.scheduleRowId)}>
      {day.dayLabel}{day.scheduledDate && <small>{day.scheduledDate}</small>}</button>)}</div>
    {getDays && schedule.loading && <p role="status">Loading scheduled days…</p>}
    {getDays && schedule.next && <button type="button" disabled={blocked || schedule.loading} onClick={() => {
      const after = schedule.next; setSchedule(v => ({ ...v, loading: true }));
      void getDays(after).then(v => setSchedule(old => ({ days: [...old.days, ...v.days], next: v.next, loading: false, error: false })), () => setSchedule(old => ({ ...old, loading: false, error: true })));
    }}>More scheduled days</button>}
    {schedule.error && <p role="status">Scheduled days could not be loaded. <button type="button" onClick={() => {
      setSchedule({ days: [], next: null, loading: true, error: false }); setScheduleRetry(n => n + 1);
    }}>Retry scheduled days</button></p>}
    {!selectable.length && (!getDays || (!schedule.loading && !schedule.error)) && <p>No scheduled days are available.</p>}
    {state.targets && <TargetEditor key={state.targets.occurrence.scheduleRowId} target={state.targets} blocked={blocked} add={add} />}
    {!!changes.length && <h4>Changes to preview</h4>}
    <ol>{changes.map((change, i) => <li key={proposalOperationKey(change)}>{labels[change.kind]} · {change.selector.scheduledDate} <button type="button" disabled={blocked} onClick={() => { setChanges(v => v.filter(c => proposalOperationKey(c) !== proposalOperationKey(change))); controller.discardPreview(); }}>Remove change {i + 1}</button></li>)}</ol>
    {!!changes.length && <><label>Note to your client (optional)<textarea className="coach-input" value={note} disabled={blocked} maxLength={4000} onChange={e => { setNote(e.target.value); controller.discardPreview(); }} /></label><button className={state.preview ? undefined : "coach-primary"} type="button" disabled={blocked} onClick={() => void controller.createPreview(changes, note.trim() ? note : null)}>Preview changes</button></>}
    {problem && <p role="alert">{problem}</p>}
    {state.preview && <section className="proposal-preview" aria-label="Review server preview"><h3>Review before sending</h3>{state.preview.note && <p className="conversation-text">{state.preview.note}</p>}<Changes changes={state.preview.changes} /><button className="coach-primary" type="button" disabled={blocked} onClick={() => void controller.sendPreview()}>Send proposal</button></section>}
  </section>;
}
export function CoachProposalView({ controller, days = [], getDays }: { controller: CoachProposalsController; days?: Day[]; getDays?: GetDays }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), consent = state.consent, blocked = state.busy || state.pending;
  const editor = state.page?.editorScope, canEdit = editor && consent?.consentActive && !state.page?.proposals.some(p => p.state === "pending");
  const pending = state.page?.proposals.filter(row => row.state === "pending") ?? [];
  const history = state.page?.proposals.filter(row => row.state !== "pending") ?? [];
  const row = (p: NonNullable<typeof state.page>["proposals"][number]) => <article className="proposal-row" key={p.proposalId}>
    <div><h4>{status[p.state]}</h4><p><time dateTime={p.createdAt}>{p.createdAt.slice(0, 10)}</time> · {[...new Set(p.operationLabels)].map(k => labels[k]).join(" · ")}</p></div>
    <button className="conversation-quiet" type="button" aria-label={`Review proposal: ${status[p.state]}, ${p.createdAt.slice(0, 10)}`} disabled={blocked} onClick={() => void controller.review(p.proposalId)}>Review</button>
    {state.detail?.proposalId === p.proposalId && <section className="proposal-preview" aria-label="Proposal details">
      {state.detail.note && <p className="conversation-text">{state.detail.note}</p>}
      {state.detail.changes ? <Changes changes={state.detail.changes} /> : <p>{state.detail.operationLabels.map(k => labels[k]).join(" · ")}</p>}
      <div className="conversation-actions">{state.detail.actions.canWithdraw && <button type="button" disabled={blocked} onClick={() => void controller.withdraw()}>Withdraw proposal</button>}
        <button type="button" disabled={state.busy} onClick={controller.closeReview}>Close review</button></div>
    </section>}
  </article>;
  return <section className="coach-conversation conversation-panel proposal-panel" aria-label="Plan updates">
    <h2>Plan updates</h2>
    <p>Your client reviews each proposal and chooses whether to apply it.</p>
    {state.message && <p className="conversation-notice" role="status" aria-live="polite">{state.message}</p>}
    {!state.ready && !state.message && <p role="status">Checking plan updates…</p>}
    {state.pending && <section className="proposal-recovery"><h3>Previous request</h3>
      <p>Keep this tab open to check the original request. Closing it or clearing browser data removes local recovery.</p>
      <button className="coach-primary" type="button" disabled={state.busy} onClick={() => void controller.retry()}>Check previous request</button>
    </section>}
    {state.busy && state.pending && <p role="status">Checking the request…</p>}
    {!!pending.length && <section className="proposal-pending"><h3>Pending review</h3>{pending.map(row)}</section>}
    {consent?.disclosure && !consent.consentActive && <section className="conversation-section"><h3>Proposal consent</h3>
      <p>Plan updates require separate consent from message sharing.</p>
      <p className="conversation-text">{consent.disclosure.text}</p>
      <button className="coach-primary" type="button" disabled={blocked} onClick={() => void controller.consentTo("accept", consent.disclosure!)}>Allow plan proposals</button></section>}
    {canEdit && <Editor key={`${editor.expectedControlRevision}/${editor.expectedEffectiveRevision}/${consent.grantId}/${consent.consentGeneration}`} controller={controller} days={days} getDays={getDays} />}
    {state.ready && !editor && !pending.length && !(consent?.disclosure && !consent.consentActive) && <p>New proposals are unavailable for this enrollment.</p>}
    {state.page && <section className="proposal-history"><h3>History</h3>
      {history.length ? history.map(row) : <p>No resolved plan updates on this page.</p>}
      {state.page.nextCursor && <button type="button" disabled={blocked} onClick={() => void controller.more()}>More proposals</button>}
    </section>}
    {consent?.consentActive && <details className="conversation-policy"><summary>Proposal consent</summary>
      <p>You have allowed proposals for this enrollment.</p>
      <button className="conversation-quiet" type="button" disabled={blocked} onClick={() => void controller.consentTo("revoke")}>Withdraw proposal consent</button></details>}
    {!state.pending && <button className="conversation-quiet" type="button" disabled={state.busy} onClick={() => void controller.initialize()}>Refresh proposals</button>}
  </section>;
}
export function CoachProposals({ accountId, attemptId, runtime, conversation }: { accountId: string; attemptId: string; runtime: ReturnType<typeof createBrowserConversationRuntime>; conversation: ConversationController }) {
  const c1 = useSyncExternalStore(conversation.subscribe, conversation.getSnapshot, conversation.getSnapshot), a = c1.availability;
  const key = conversationKey(c1, accountId, attemptId);
  const rendered = useRef(key);
  const [storageErrorKey, setStorageErrorKey] = useState<string | null>(null);
  const current = useRef<CoachProposalsController | null>(null);
  const [resource, setResource] = useState<{ key: string; controller: CoachProposalsController; getDays: GetDays } | null>(null);
  useLayoutEffect(() => { rendered.current = key; return () => { rendered.current = ""; current.current?.dispose(); current.current = null; }; }, [key]);
  useEffect(() => {
    if (!key || !a?.conversationId) return;
    const target = { enrollmentAttemptId: attemptId, conversationId: a.conversationId };
    const isCurrent = () => rendered.current === key && runtime.actor.accountId === accountId && conversationKey(conversation.getSnapshot(), accountId, attemptId) === key;
    let controller: CoachProposalsController, journal: ReturnType<typeof createProposalJournal>;
    try { journal = createProposalJournal({ actor: runtime.actor, target, storage: window.sessionStorage }); controller = createCoachProposalsController({ actor: runtime.actor, target, isCurrent, newRequestId: () => crypto.randomUUID(), capture: () => captureBrowserProposalsApi(runtime), journal }); }
    catch {
      queueMicrotask(() => { if (isCurrent()) setStorageErrorKey(key); });
      return;
    }
    current.current = controller;
    const update = () => { const active = isCurrent() && document.hasFocus() && document.visibilityState === "visible" && navigator.onLine; controller.setActive(active); if (active) void controller.initialize({ background: true }); };
    const stop = runtime.subscribeBoundary(() => controller.dispose());
    const stopVerification = runtime.subscribeVerification(verified => { if (!verified) controller.setActive(false); });
    const getDays: GetDays = async after => {
      if (!isCurrent()) throw Error("proposal_target_changed");
      const captured = await runtime.capture(); if (!isCurrent()) throw Error("proposal_target_changed"); captured.participant.assertCurrent();
      const value = await createConversationApi(captured).context(target, after); captured.participant.assertCurrent();
      if (!isCurrent() || !value.context) throw Error("proposal_context_unavailable");
      return { days: value.context.days, next: value.context.nextAfterScheduleId };
    };
    setResource({ key, controller, getDays }); update();
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update); window.addEventListener("blur", update); window.addEventListener("online", update); window.addEventListener("offline", update); document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); stop(); stopVerification(); window.removeEventListener("focus", update); window.removeEventListener("blur", update); window.removeEventListener("online", update); window.removeEventListener("offline", update); document.removeEventListener("visibilitychange", update); controller.dispose(); };
  }, [key, accountId, attemptId, runtime, conversation, a?.conversationId]);
  if (key && resource?.key === key) return <CoachProposalView controller={resource.controller} getDays={resource.getDays} />;
  return <section className="conversation-panel proposal-panel"><h2>Plan updates</h2><p role="status">
    {key && storageErrorKey === key ? "Plan recovery storage is unavailable. Enable storage for this site and reload." :
      key || c1.loading || !c1.ready && !c1.error && !c1.authorityPaused ? "Checking plan updates…" : "Plan updates are unavailable for this conversation."}
  </p></section>;
}
