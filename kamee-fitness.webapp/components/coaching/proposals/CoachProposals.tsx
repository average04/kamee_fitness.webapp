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
type Day = { scheduleRowId: string; dayLabel: string; state: string };
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
  return <dl>{changes.map(change => {
    const before = change.kind === "move_occurrence" ? change.before.scheduledDate + (change.before.scheduledTime ? ` at ${change.before.scheduledTime}` : "") : change.kind === "edit_strength_slot" ? strength(change.before) : timing(change.before);
    const after = change.kind === "move_occurrence" ? change.after.scheduledDate + (change.after.scheduledTime ? ` at ${change.after.scheduledTime}` : "") : change.kind === "edit_strength_slot" ? strength(change.after) : timing(change.after);
    return <div key={proposalOperationKey(change)}><dt><strong>{change.kind === "edit_strength_slot" ? change.label : labels[change.kind]} · {change.selector.scheduledDate}</strong></dt><dd>Before: {before}</dd><dd>After: {after}</dd></div>;
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
  return <fieldset disabled={blocked}><legend>{slot.label}</legend><p>{strength(slot)}</p>
    <label>Sets (1–30)<input className="coach-input" inputMode="numeric" value={sets} onChange={e => setSets(e.target.value)} maxLength={2} /></label>
    {repsEditable && <label>Repetitions (1–999)<input className="coach-input" inputMode="numeric" value={reps} onChange={e => setReps(e.target.value)} maxLength={3} /></label>}
    <label>Rest seconds (blank for unspecified)<input className="coach-input" inputMode="numeric" value={rest} onChange={e => setRest(e.target.value)} maxLength={4} /></label>
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
  return <fieldset disabled={blocked}><legend>Scheduled {target.occurrence.scheduledDate} in this enrollment’s time zone</legend>
    <label>New date<input type="date" className="coach-input" value={date} onChange={e => setDate(e.target.value)} /></label>
    <button type="button" disabled={!valid} onClick={() => add({ kind: "move_occurrence", selector: target.occurrence, newDate: date })}>Add date change</button>
    <div className="conversation-actions">{target.strength.slice(0, count).map(s => <button type="button" key={s.selector.slotId} onClick={() => setSlot(s.selector.slotId)}>Edit {s.label}</button>)}
      {count < target.strength.length && <button type="button" onClick={() => setCount(n => n + 20)}>More exercises</button>}
      {target.outdoor && <button type="button" onClick={() => setSlot("outdoor")}>Edit outdoor intervals</button>}</div>
    {slot && <StrengthEditor key={slot.selector.slotId} slot={slot} add={add} blocked={blocked} />}
    {slotId === "outdoor" && target.outdoor && <OutdoorEditor outdoor={target.outdoor} add={add} blocked={blocked} />}
  </fieldset>;
}
function Editor({ controller, days, getDays }: { controller: CoachProposalsController; days: Day[]; getDays?: GetDays }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [changes, setChanges] = useState<ProposalOperation[]>([]), [note, setNote] = useState(""), [problem, setProblem] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<{ days: Day[]; next: string | null; loading: boolean; error: boolean }>({ days: [], next: null, loading: true, error: false });
  useEffect(() => {
    if (!getDays) return;
    let live = true;
    void getDays(null).then(v => { if (live) setSchedule({ ...v, loading: false, error: false }); }, () => { if (live) setSchedule({ days: [], next: null, loading: false, error: true }); });
    return () => { live = false; };
  }, [getDays]);
  const selectable = (getDays ? schedule.days : days).filter(d => d.state === "scheduled"), blocked = state.busy || state.pending;
  const add: Add = change => {
    const key = proposalOperationKey(change);
    if (changes.length >= 20 && !changes.some(v => proposalOperationKey(v) === key)) { setProblem("Remove a change before adding another."); return; }
    setChanges(values => [...values.filter(v => proposalOperationKey(v) !== key), change]); controller.discardPreview(); setProblem(null);
  };
  return <section aria-label="Create proposal"><h3>Create a proposal</h3><p>Only the buyer can Apply. Started workouts keep their frozen prescriptions.</p>
    {selectable.map(day => <button type="button" key={day.scheduleRowId} disabled={blocked} onClick={() => void controller.choose(day.scheduleRowId)}>{day.dayLabel}</button>)}
    {getDays && schedule.next && <button type="button" disabled={blocked || schedule.loading} onClick={() => {
      const after = schedule.next; setSchedule(v => ({ ...v, loading: true }));
      void getDays(after).then(v => setSchedule(old => ({ days: [...old.days, ...v.days], next: v.next, loading: false, error: false })), () => setSchedule(old => ({ ...old, loading: false, error: true })));
    }}>More scheduled days</button>}
    {schedule.error && <p role="status">Scheduled days could not be loaded. Refresh proposals to retry.</p>}
    {!selectable.length && !schedule.loading && <p>No scheduled days are available.</p>}
    {state.targets && <TargetEditor key={state.targets.occurrence.scheduleRowId} target={state.targets} blocked={blocked} add={add} />}
    <ol>{changes.map((change, i) => <li key={proposalOperationKey(change)}>{labels[change.kind]} · {change.selector.scheduledDate} <button type="button" disabled={blocked} onClick={() => { setChanges(v => v.filter(c => proposalOperationKey(c) !== proposalOperationKey(change))); controller.discardPreview(); }}>Remove change {i + 1}</button></li>)}</ol>
    {!!changes.length && <><label>Note to your client (optional)<textarea className="coach-input" value={note} disabled={blocked} maxLength={4000} onChange={e => { setNote(e.target.value); controller.discardPreview(); }} /></label><button type="button" disabled={blocked} onClick={() => void controller.createPreview(changes, note.trim() ? note : null)}>Preview changes</button></>}
    {problem && <p role="alert">{problem}</p>}
    {state.preview && <section aria-label="Review server preview"><h3>Review this preview</h3>{state.preview.note && <p className="conversation-text">{state.preview.note}</p>}<Changes changes={state.preview.changes} /><button className="coach-primary" type="button" disabled={blocked} onClick={() => void controller.sendPreview()}>Send proposal</button></section>}
  </section>;
}
export function CoachProposalView({ controller, days = [], getDays }: { controller: CoachProposalsController; days?: Day[]; getDays?: GetDays }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), consent = state.consent, blocked = state.busy || state.pending;
  const editor = state.page?.editorScope, canEdit = editor && consent?.consentActive && !state.page?.proposals.some(p => p.state === "pending");
  return <section className="coach-conversation conversation-panel" aria-label="Plan proposals"><h2>Plan proposals</h2>
    <p>Proposal consent is separate from message sharing. The buyer reviews and applies changes in the app.</p>
    {state.message && <p role="status" aria-live="polite">{state.message}</p>}
    {state.pending ? <button type="button" disabled={state.busy} onClick={() => void controller.retry()}>Check previous request</button> : <button type="button" disabled={state.busy} onClick={() => void controller.initialize()}>Refresh proposals</button>}
    {consent?.disclosure && !consent.consentActive && <section><p className="conversation-text">{consent.disclosure.text}</p><button type="button" disabled={blocked} onClick={() => void controller.consentTo("accept", consent.disclosure!)}>Allow plan proposals</button></section>}
    {consent?.consentActive && <button type="button" disabled={blocked} onClick={() => void controller.consentTo("revoke")}>Withdraw proposal consent</button>}
    {canEdit && <Editor key={`${editor.expectedControlRevision}/${editor.expectedEffectiveRevision}/${consent.grantId}/${consent.consentGeneration}`} controller={controller} days={days} getDays={getDays} />}
    {state.page?.proposals.map(p => <section key={p.proposalId}><h3>{status[p.state]}</h3><p>{p.createdAt.slice(0, 10)} · {[...new Set(p.operationLabels)].map(k => labels[k]).join(" · ")}</p><button type="button" disabled={blocked} onClick={() => void controller.review(p.proposalId)}>Review proposal</button></section>)}
    {state.page?.nextCursor && <button type="button" disabled={blocked} onClick={() => void controller.more()}>More proposals</button>}
    {state.detail && <section aria-label="Proposal details"><h3>{status[state.detail.state]}</h3>{state.detail.note && <p className="conversation-text">{state.detail.note}</p>}{state.detail.changes ? <Changes changes={state.detail.changes} /> : <p>{state.detail.operationLabels.map(k => labels[k]).join(" · ")}</p>}
      {state.detail.actions.canWithdraw && <button type="button" disabled={blocked} onClick={() => void controller.withdraw()}>Withdraw proposal</button>}<button type="button" disabled={state.busy} onClick={controller.closeReview}>Close review</button></section>}
    {state.pending && <p>Exact request recovery stays in this tab across refresh. Keep the tab open; closing it or clearing browser data removes local recovery.</p>}
  </section>;
}
export function CoachProposals({ accountId, attemptId, runtime, conversation }: { accountId: string; attemptId: string; runtime: ReturnType<typeof createBrowserConversationRuntime>; conversation: ConversationController }) {
  const c1 = useSyncExternalStore(conversation.subscribe, conversation.getSnapshot, conversation.getSnapshot), a = c1.availability;
  const key = conversationKey(c1, accountId, attemptId);
  const rendered = useRef(key);
  const current = useRef<CoachProposalsController | null>(null);
  const [resource, setResource] = useState<{ key: string; controller: CoachProposalsController; getDays: GetDays } | null>(null);
  useLayoutEffect(() => { rendered.current = key; return () => { rendered.current = ""; current.current?.dispose(); current.current = null; }; }, [key]);
  useEffect(() => {
    if (!key || !a?.conversationId) return;
    const target = { enrollmentAttemptId: attemptId, conversationId: a.conversationId };
    const isCurrent = () => rendered.current === key && runtime.actor.accountId === accountId && conversationKey(conversation.getSnapshot(), accountId, attemptId) === key;
    let controller: CoachProposalsController, journal: ReturnType<typeof createProposalJournal>;
    try { journal = createProposalJournal({ actor: runtime.actor, target, storage: window.sessionStorage }); controller = createCoachProposalsController({ actor: runtime.actor, target, isCurrent, newRequestId: () => crypto.randomUUID(), capture: () => captureBrowserProposalsApi(runtime), journal }); }
    catch { return; }
    current.current = controller;
    const update = () => { const active = isCurrent() && document.hasFocus() && document.visibilityState === "visible" && navigator.onLine; controller.setActive(active); if (active) void controller.initialize(); };
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
  return resource?.key === key && key ? <CoachProposalView controller={resource.controller} getDays={resource.getDays} /> : null;
}
