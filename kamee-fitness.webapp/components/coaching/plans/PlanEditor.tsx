"use client";
import { commaValues, validateDraft } from "@/lib/coaching/plan-validation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  savePlan,
  submitPlan,
  clonePlan,
  requestExercise,
  changeListingStatus,
} from "@/app/coaching/(hub)/plans/actions";
import {
  duplicate,
  editable,
  move,
  progressWeek,
  stateLabel,
  type ExerciseOption,
  type PlanDocument,
  type Video,
  type Week,
} from "@/lib/coaching/plans";
import {
  Field,
  Select,
  OrderControls,
  dropProps,
  startDrag,
} from "./Fields";
import { GOAL_LABELS, planGoals } from "@/lib/coaching/goals";
import { MultiSelectField } from "./MultiSelectField";
import { WeekSchedule } from "./WeekSchedule";
import { MealsEditor } from "./MealsEditor";
import { PlanPreview } from "./PlanPreview";

type Recovery = PlanDocument & { equipmentText?: string; musclesText?: string; savedAt?: string };

export function PlanEditor({
  initial,
  ownerId,
  exercises,
  videos,
}: {
  initial: PlanDocument;
  ownerId: string;
  exercises: ExerciseOption[];
  videos: Video[];
}) {
  const router = useRouter();
  const coverInputId = useId();
  const [plan, setPlan] = useState(initial);
  const [equipmentText, setEquipmentText] = useState(initial.required_equipment.join(", "));
  const [musclesText, setMusclesText] = useState(initial.target_muscles.join(", "));
  const [tab, setTab] = useState("Details");
  const [weekIndex, setWeekIndex] = useState(0);
  const [weeksToAdd, setWeeksToAdd] = useState("1");
  const [listingStatus, setListingStatus] = useState(
    initial.listing_status ?? "draft",
  );
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [progression, setProgression] = useState<Week | null>(null);
  const [deltas, setDeltas] = useState({ sets: 0, reps: 1, rest: 0 });
  const canEdit = editable(plan) && listingStatus !== "retired";
  const recoveryKey = `coaching-draft:${ownerId}:${initial.id}`;
  const [hydrated, setHydrated] = useState(false);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    try {
      const raw = sessionStorage.getItem(recoveryKey);
      if (raw && editable(initial)) {
        const saved = JSON.parse(raw) as Recovery;
        if (saved.id === initial.id) {
          // Browser storage is read after hydration; restoration requires a click.
          setRecovery(saved);
        }
      }
    } catch {
      /* The server copy is still available when storage is blocked. */
    }
  }, [recoveryKey, initial]);
  const week = plan.weeks[weekIndex] ?? plan.weeks[0];
  useEffect(() => {
    let leaving = false;
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty && !leaving) { e.preventDefault(); e.returnValue = ""; }
    };
    const navigation = (e: MouseEvent) => {
      if (
        !dirty ||
        e.button !== 0 ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const anchor = e.target instanceof Element ? e.target.closest("a") : null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.href === location.href ||
        anchor.getAttribute("href")?.startsWith("#")
      )
        return;
      if (confirm("Leave without saving your edits?")) leaving = true;
      else {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigation, true);
    };
  }, [dirty]);
  const update = (patch: Partial<PlanDocument>, equipment = equipmentText, muscles = musclesText) => {
    setMessage("");
    const next = { ...plan, ...patch };
    setPlan(next);
    try {
      sessionStorage.setItem(recoveryKey, JSON.stringify({ ...next, equipmentText: equipment, musclesText: muscles, savedAt: new Date().toISOString() }));
    } catch {
      try { sessionStorage.removeItem(recoveryKey); } catch {}
      setMessage(
        "Browser recovery could not update. Any stored copy may be older; save before leaving.",
      );
    }
    setDirty(true);
  };
  const setWeek = (w: Week) =>
    update({ weeks: plan.weeks.map((old, i) => (i === weekIndex ? w : old)) });
  function save(submit = false) {
    const document = { ...plan, required_equipment: commaValues(equipmentText), target_muscles: commaValues(musclesText) };
    const problems = validateDraft(document);
    if (problems.length) {
      setIssues(problems);
      return;
    }
    start(async () => {
      setMessage("");
      setIssues([]);
      try {
        const saved = await savePlan(document);
        if (saved.error) {
          setMessage(saved.error);
          return;
        }
        const revision = saved.revision!;
        setPlan({ ...document, draft_revision: revision });
        setDirty(false);
        setRecovery(null);
        try {
          sessionStorage.removeItem(recoveryKey);
        } catch {}
        if (submit) {
          const result = await submitPlan(plan.id, revision);
          if (result.error) setMessage(result.error);
          else if (result.issues?.length) setIssues(result.issues);
          else {
            setPlan((p) => ({
              ...p,
              draft_revision: revision + 1,
              version_state: "in_review",
            }));
            setMessage("Submitted for review.");
            router.refresh();
          }
        } else setMessage("Saved.");
      } catch {
        setMessage("Could not save. Your edits are still here; try again.");
      }
    });
  }
  async function uploadCover(file?: File) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      const r = await fetch("/coaching/plans/cover", { method: "POST", body });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Cover upload failed");
      update({ cover_image_path: data.path });
      setMessage("Cover uploaded. Save the plan to attach it.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Cover upload failed");
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="plan-stack">
      <Link className="text-sm text-muted" href="/coaching/plans">
        ← Plans
      </Link>
      <header
        className="plan-card"
        data-coaching-hydrated={hydrated ? "true" : undefined}
      >
        <div>
          <h1 className="text-3xl font-semibold">{plan.title}</h1>
          <p className="coach-panel-description">
            Version {plan.version_no} · {stateLabel(plan.version_state)}
          </p>
        </div>
        <span className="coach-status">
          {dirty ? "Unsaved changes" : stateLabel(plan.version_state)}
        </span>
      </header>
      {plan.review_note && (
        <div className="coach-panel">
          <h2>Review feedback</h2>
          <p>{plan.review_note}</p>
        </div>
      )}
      <div className="plan-toolbar">
        <nav className="plan-tabs" aria-label="Plan sections">
          {(canEdit ? ["Details", "Schedule", "Meals", "Preview"] : ["Preview"]).map((t) => (
            <button
              type="button"
              key={t}
              aria-pressed={!canEdit || tab === t}
              onClick={() => setTab(t)}
            >
              {t === "Meals" ? "Meals (optional)" : t}
            </button>
          ))}
        </nav>
        <div className="plan-order">
          {canEdit ? (
            <>
              <button
                className="plan-secondary"
                disabled={pending || uploading}
                onClick={() => save()}
              >
                {pending ? "Saving…" : "Save draft"}
              </button>
              {tab === "Preview" && <button
                className="plan-primary"
                disabled={pending || uploading}
                onClick={() => save(true)}
              >
                Submit for review
              </button>}
            </>
          ) : (
            plan.version_state === "approved" && (
              <button
                className="plan-primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      const result = await clonePlan(plan.id);
                      if (result.error) setMessage(result.error);
                    } catch (e) {
                      throw e;
                    }
                  })
                }
              >
                Create next version
              </button>
            )
          )}
        </div>
      </div>
      {listingStatus !== "retired" && (
        <details className="plan-advanced">
          <summary>Plan options</summary>
          <div className="plan-order">
          {plan.version_state === "approved" && (
            <button
              className="plan-secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const status =
                    listingStatus === "paused" ? "active" : "paused";
                  const result = await changeListingStatus(
                    plan.listing_id,
                    status,
                  );
                  if (result.error) setMessage(result.error);
                  else {
                    setListingStatus(status);
                    setMessage(
                      status === "paused" ? "Plan paused." : "Plan resumed.",
                    );
                  }
                })
              }
            >
              {listingStatus === "paused" ? "Resume plan" : "Pause plan"}
            </button>
          )}
          <button
            className="plan-secondary"
            disabled={pending}
            onClick={() => {
              if (
                confirm(
                  "Retire this plan? Its versions are kept, but you cannot edit or resume it.",
                )
              )
                start(async () => {
                  const result = await changeListingStatus(
                    plan.listing_id,
                    "retired",
                  );
                  if (result.error) setMessage(result.error);
                  else {
                    setPlan((p) => ({ ...p, version_state: "retired" }));
                    setListingStatus("retired");
                    setMessage("Plan retired.");
                  }
                });
            }}
          >
            Retire plan
          </button>
        </div>
        </details>
      )}
      {recovery && canEdit && (
        <div className="coach-panel plan-stack" role="status">
          <p>
            Unsaved edits are available from this browser tab.
            {recovery.savedAt ? ` Copy saved ${new Date(recovery.savedAt).toLocaleString()}.` : " This older copy has no timestamp."}
            {recovery.draft_revision !== initial.draft_revision
              ? " The server version has changed. Restoring will keep conflict protection."
              : ""}
          </p>
          <div className="plan-order">
            <button
              onClick={() => {
                setPlan({
                  ...recovery,
                  draft_revision: recovery.draft_revision,
                  version_state: initial.version_state,
                });
                setEquipmentText(recovery.equipmentText ?? recovery.required_equipment.join(", "));
                setMusclesText(recovery.musclesText ?? recovery.target_muscles.join(", "));
                setDirty(true);
                setRecovery(null);
                setMessage("Local edits restored. Review before saving.");
              }}
            >
              Restore local edits
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem(recoveryKey);
                setRecovery(null);
              }}
            >
              Discard local edits
            </button>
          </div>
        </div>
      )}
      {canEdit && plan.draft_revision < initial.draft_revision && (
        <div className="coach-panel" role="status">
          <p>These edits are based on an older version. Saving is blocked until you resolve the conflict.</p>
          <button className="plan-secondary" disabled={pending} onClick={() => {
            if (confirm("Overwrite the newer saved version with these local edits? Changes saved in the other tab will be replaced when you save.")) {
              update({ draft_revision: initial.draft_revision });
              setMessage("Overwrite confirmed. Review your edits, then save.");
            }
          }}>Overwrite newer version</button>
        </div>
      )}
      <div aria-live="polite">
        {message && <p role="status">{message}</p>}
        {issues.length > 0 && (
          <div className="coach-panel">
            <h2>Before you submit</h2>
            <ul className="plan-issues">
              {issues.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {tab === "Preview" || !canEdit ? (
        <PlanPreview plan={{ ...plan, required_equipment: commaValues(equipmentText), target_muscles: commaValues(musclesText) }} exercises={exercises} />
      ) : (
        <fieldset
          disabled={!canEdit || pending || uploading}
          className="plan-stack plan-fieldset"
        >
          {tab === "Details" && (
            <section className="coach-panel plan-stack">
              <Field
                label="Title"
                value={plan.title}
                onChange={(title) => update({ title })}
              />
              <Field
                label="Summary"
                multiline
                value={plan.summary}
                onChange={(summary) => update({ summary })}
              />
              <p className="coach-panel-description">
                {plan.summary?.length ?? 0} / 120 minimum characters
              </p>
              <div className="plan-details-basics">
                <Field
                  label="Minutes per session"
                  type="number"
                  min={1}
                  max={1440}
                  value={plan.est_minutes_per_session}
                  onChange={(v) =>
                    update({ est_minutes_per_session: Number(v) })
                  }
                />
                <Select
                  label="Level"
                  value={plan.level}
                  onChange={(level) => update({ level })}
                >
                  {["none", "beginner", "intermediate", "advanced"].map((x) => (
                    <option key={x} value={x}>{({ none: "Any level", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", bodyweight: "No equipment", minimal: "Basic equipment", full_gym: "Full gym" } as Record<string, string>)[x] ?? x}</option>
                  ))}
                </Select>
                <Select
                  label="Equipment access"
                  value={plan.equipment_tier}
                  onChange={(equipment_tier) => update({ equipment_tier })}
                >
                  {["bodyweight", "minimal", "full_gym"].map((x) => (
                    <option key={x} value={x}>{({ none: "Any level", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", bodyweight: "No equipment", minimal: "Basic equipment", full_gym: "Full gym" } as Record<string, string>)[x] ?? x}</option>
                  ))}
                </Select>
              </div>
              <div className="plan-details-selections">
                <MultiSelectField label="Goals" hint="Choose all the outcomes this plan supports."
                  value={planGoals(plan)} labels={GOAL_LABELS}
                  options={Object.keys(GOAL_LABELS)}
                  onChange={goals => update({ goals, goal: goals[0] ?? null })} />
                <MultiSelectField label="Required equipment" hint="Select the items members need. Leave empty if none are needed."
                  value={commaValues(equipmentText)}
                  options={["Dumbbells", "Barbell", "Weight plates", "Kettlebell", "Resistance bands", "Bench", "Squat rack", "Pull-up bar", "Cable machine", "Exercise mat", "Treadmill", "Running shoes"]}
                  onChange={values => { const text = values.join(", "); setEquipmentText(text); update({}, text, musclesText); }} />
                <MultiSelectField label="Target muscles" hint="Choose the muscle groups trained by this plan."
                  value={commaValues(musclesText)}
                  options={["Full body", "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Core", "Glutes", "Quadriceps", "Hamstrings", "Calves"]}
                  onChange={values => { const text = values.join(", "); setMusclesText(text); update({}, equipmentText, text); }} />
              </div>
              <section className="plan-cover-upload" aria-labelledby={`${coverInputId}-title`}>
                <div>
                  <h3 id={`${coverInputId}-title`}>Plan cover photo</h3>
                  <p id={`${coverInputId}-hint`} className="coach-panel-description">Choose an image that represents your plan. JPG, PNG or WebP, up to 5 MB.</p>
                </div>
                {plan.cover_image_path ? (
                  <Image src={`/coaching/plans/cover?path=${encodeURIComponent(plan.cover_image_path)}`}
                    alt="Plan cover preview" width={960} height={400} unoptimized className="coach-cover-preview" />
                ) : <div className="plan-cover-placeholder" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>
                  <span>No cover photo selected</span>
                </div>}
                <div>
                  <input id={coverInputId} type="file" accept="image/jpeg,image/png,image/webp"
                    className="peer sr-only" aria-describedby={`${coverInputId}-hint`}
                    onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; void uploadCover(file); }} />
                  <label htmlFor={coverInputId} className="plan-cover-button peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-leaf-500">
                    {uploading ? "Uploading cover…" : plan.cover_image_path ? "Replace cover photo" : "Choose cover photo"}
                  </label>
                </div>
                <p role="status" className="coach-panel-description">
                  {uploading ? "Uploading your image. Please wait." : plan.cover_image_path ? "Cover selected. Save draft to keep your changes." : "Your selected image will appear here."}
                </p>
              </section>
              {plan.version_no > 1 && (
                <Field
                  label="What changed?"
                  multiline
                  value={plan.change_note}
                  onChange={(change_note) => update({ change_note })}
                />
              )}
            </section>
          )}
          {tab === "Schedule" && (
            <>
              <div className="plan-tabs" aria-label="Weeks">
                {plan.weeks.map((w, i) => (
                  <button
                    type="button"
                    key={w.lineage_key}
                    draggable={canEdit}
                    onDragStart={(e) => startDrag(e, plan.id, i)}
                    {...dropProps(plan.id, i, plan.weeks, (weeks) => {
                      if (canEdit) {
                        update({ weeks });
                        setWeekIndex(i);
                      }
                    })}
                    aria-pressed={weekIndex === i}
                    onClick={() => {
                      setWeekIndex(i);
                      setProgression(null);
                    }}
                  >
                    Week {i + 1}
                  </button>
                ))}
                <div className="plan-add-weeks">
                  <Field label="Weeks to add" type="number" min={1} max={52 - plan.weeks.length}
                    value={weeksToAdd} onChange={setWeeksToAdd} />
                  <button type="button" disabled={!Number.isInteger(Number(weeksToAdd)) || Number(weeksToAdd) < 1 || Number(weeksToAdd) + plan.weeks.length > 52}
                    onClick={() => {
                      const count = Number(weeksToAdd);
                      if (!Number.isInteger(count) || count < 1 || count + plan.weeks.length > 52) return;
                      update({ weeks: [...plan.weeks, ...Array.from({ length: count }, () => ({
                        lineage_key: crypto.randomUUID(), role: "build" as const, days: [],
                      }))] });
                      setWeekIndex(plan.weeks.length);
                      setProgression(null);
                    }}>Add weeks</button>
                </div>
              </div>
              <section className="coach-panel plan-stack">
                <div className="plan-stack">
                  <h2>Week {weekIndex + 1}</h2>
                  <details className="plan-advanced">
                    <summary>Week settings</summary>
                    <div className="plan-week-settings">
                    <Select label="Training phase" value={week.role}
                      onChange={(v) => setWeek({ ...week, role: v as Week["role"] })}>
                      <option value="build">Regular training</option>
                      <option value="cutback">Recovery week (lighter training)</option>
                      <option value="taper">Pre-event week (reduced training)</option>
                      <option value="goal">Event / goal week</option>
                    </Select>
                  <OrderControls
                    label={`week ${weekIndex + 1}`}
                    index={weekIndex}
                    count={plan.weeks.length}
                    move={(d) => {
                      update({ weeks: move(plan.weeks, weekIndex, d) });
                      setWeekIndex(weekIndex + d);
                    }}
                    duplicate={() => {
                      if (plan.weeks.length < 52)
                        update({ weeks: [...plan.weeks, duplicate(week)] });
                    }}
                    remove={() => {
                      if (
                        plan.weeks.length > 1 &&
                        confirm("Remove this week and its days?")
                      ) {
                        update({
                          weeks: plan.weeks.filter((_, i) => i !== weekIndex),
                        });
                        setWeekIndex(0);
                      }
                    }}
                  />
                    </div>
                  </details>
                </div>
                <WeekSchedule key={week.lineage_key} week={week} exercises={exercises} videos={videos} onChange={setWeek} />
                <details>
                  <summary>Duplicate week with adjustments (advanced)</summary>
                  <div className="plan-stack">
                    <p className="coach-panel-description">
                      Copy this week with adjusted exercises. Reps change only
                      for whole-number prescriptions.
                    </p>
                    <div className="plan-grid">
                      {(["sets", "reps", "rest"] as const).map((key) => (
                        <Field
                          key={key}
                          label={`${key === "rest" ? "Rest seconds" : key} change`}
                          type="number"
                          value={deltas[key]}
                          onChange={(v) =>
                            setDeltas({ ...deltas, [key]: Number(v) })
                          }
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="plan-secondary"
                      onClick={() =>
                        setProgression(
                          progressWeek(
                            week,
                            deltas.sets,
                            deltas.reps,
                            deltas.rest,
                          ),
                        )
                      }
                    >
                      Preview adjusted week
                    </button>
                    {progression && (
                      <>
                        <PlanPreview
                          plan={{ ...plan, weeks: [progression], meals: null }}
                          exercises={exercises}
                        />
                        <button
                          type="button"
                          className="plan-primary"
                          disabled={plan.weeks.length >= 52}
                          onClick={() => {
                            update({
                              weeks: [
                                ...plan.weeks.slice(0, weekIndex + 1),
                                progression,
                                ...plan.weeks.slice(weekIndex + 1),
                              ],
                            });
                            setWeekIndex(weekIndex + 1);
                            setProgression(null);
                          }}
                        >
                          Insert next week
                        </button>
                      </>
                    )}
                  </div>
                </details>
              </section>
              <details className="coach-panel">
                <summary>Missing an exercise?</summary>
                <form
                  className="plan-stack"
                  action={(form) =>
                    start(async () => {
                      const r = await requestExercise(form);
                      setMessage(r.error ?? "Exercise request sent.");
                    })
                  }
                >
                  <label>
                    Name
                    <input
                      className="coach-input"
                      name="name"
                      required
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      className="coach-input"
                      name="description"
                      maxLength={2000}
                    />
                  </label>
                  <label>
                    Primary muscle
                    <input className="coach-input" name="primary_muscle" />
                  </label>
                  <label>
                    Equipment
                    <input className="coach-input" name="equipment" />
                  </label>
                  <label>
                    Reference video
                    <select className="coach-input" name="video_id">
                      <option value="">No video</option>
                      {videos
                        .filter((v) => v.status === "ready" && !v.retired_at)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button className="plan-secondary">Request exercise</button>
                </form>
              </details>
            </>
          )}
          {tab === "Meals" && (
            <MealsEditor
              value={plan.meals}
              videos={videos}
              onChange={(meals) => update({ meals })}
            />
          )}
        </fieldset>
      )}
      {canEdit && <div className="plan-card plan-step-navigation">
        {tab !== "Details" && <button type="button" className="plan-secondary" disabled={pending || uploading}
          onClick={() => setTab(({ Schedule: "Details", Meals: "Schedule", Preview: "Meals" } as Record<string, string>)[tab])}>Back</button>}
        {tab !== "Preview" && <button type="button" className="plan-primary" disabled={pending || uploading}
          onClick={() => setTab(({ Details: "Schedule", Schedule: "Meals", Meals: "Preview" } as Record<string, string>)[tab])}>
          {tab === "Details" ? "Next: add training days" : tab === "Schedule" ? "Next: meals (optional)" : "Next: preview plan"}
        </button>}
      </div>}
    </div>
  );
}
