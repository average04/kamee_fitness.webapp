"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
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
  newDay,
  progressWeek,
  stateLabel,
  type Day,
  type ExerciseOption,
  type PlanDocument,
  type Video,
  type Week,
} from "@/lib/coaching/plans";
import {
  Field,
  Select,
  OrderControls,
  VideoSelect,
  dropProps,
  startDrag,
} from "./Fields";
import { WorkoutEditor } from "./WorkoutEditor";
import { OutdoorEditor } from "./OutdoorEditor";
import { MealsEditor } from "./MealsEditor";
import { PlanPreview } from "./PlanPreview";

export function PlanEditor({
  initial,
  exercises,
  videos,
}: {
  initial: PlanDocument;
  exercises: ExerciseOption[];
  videos: Video[];
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initial);
  const [tab, setTab] = useState("Schedule");
  const [weekIndex, setWeekIndex] = useState(0);
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
  const canEdit = editable(plan);
  const week = plan.weeks[weekIndex] ?? plan.weeks[0];
  useEffect(() => {
    let leaving = false;
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty && !leaving) e.preventDefault();
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
  const update = (patch: Partial<PlanDocument>) => {
    setPlan((p) => ({ ...p, ...patch }));
    setDirty(true);
    setMessage("");
  };
  const setWeek = (w: Week) =>
    update({ weeks: plan.weeks.map((old, i) => (i === weekIndex ? w : old)) });
  const setDay = (index: number, d: Day) =>
    setWeek({
      ...week,
      days: week.days.map((old, i) => (i === index ? d : old)),
    });
  function save(submit = false) {
    start(async () => {
      setMessage("");
      setIssues([]);
      try {
        const saved = await savePlan(plan);
        if (saved.error) {
          setMessage(saved.error);
          return;
        }
        const revision = saved.revision!;
        setPlan((p) => ({ ...p, draft_revision: revision }));
        setDirty(false);
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
      <header className="plan-card">
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
          {["Details", "Schedule", "Meals", "Preview"].map((t) => (
            <button
              type="button"
              key={t}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
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
              <button
                className="plan-primary"
                disabled={pending || uploading}
                onClick={() => save(true)}
              >
                Submit for review
              </button>
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
      {plan.version_state === "approved" && (
        <div className="plan-order">
          <button
            className="plan-secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const status = listingStatus === "paused" ? "active" : "paused";
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
      {tab === "Preview" ? (
        <PlanPreview plan={plan} exercises={exercises} />
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
              <div className="plan-grid">
                <Field
                  label="Goal"
                  value={plan.goal}
                  onChange={(goal) => update({ goal })}
                />
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
                    <option key={x}>{x}</option>
                  ))}
                </Select>
                <Select
                  label="Equipment"
                  value={plan.equipment_tier}
                  onChange={(equipment_tier) => update({ equipment_tier })}
                >
                  {["bodyweight", "minimal", "full_gym"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
                <Field
                  label="Required equipment (comma separated)"
                  value={plan.required_equipment.join(", ")}
                  onChange={(v) =>
                    update({
                      required_equipment: v.split(",").map((s) => s.trim()),
                    })
                  }
                />
                <Field
                  label="Target muscles (comma separated)"
                  value={plan.target_muscles.join(", ")}
                  onChange={(v) =>
                    update({
                      target_muscles: v.split(",").map((s) => s.trim()),
                    })
                  }
                />
              </div>
              <label className="plan-field">
                <span>Cover · JPG, PNG or WebP, up to 5 MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => uploadCover(e.target.files?.[0])}
                />
              </label>
              {plan.cover_image_path && (
                <Image
                  src={`/coaching/plans/cover?path=${encodeURIComponent(plan.cover_image_path)}`}
                  alt="Plan cover"
                  width={960}
                  height={400}
                  unoptimized
                  className="coach-cover-preview"
                />
              )}
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
                <button
                  type="button"
                  disabled={plan.weeks.length >= 52}
                  onClick={() => {
                    update({
                      weeks: [
                        ...plan.weeks,
                        {
                          lineage_key: crypto.randomUUID(),
                          role: "build",
                          days: [],
                        },
                      ],
                    });
                    setWeekIndex(plan.weeks.length);
                  }}
                >
                  + Week
                </button>
              </div>
              <section className="coach-panel plan-stack">
                <div className="plan-card">
                  <Select
                    label={`Week ${weekIndex + 1}`}
                    value={week.role}
                    onChange={(v) =>
                      setWeek({ ...week, role: v as Week["role"] })
                    }
                  >
                    {["build", "cutback", "taper", "goal"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
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
                {week.days.map((day, di) => (
                  <details
                    open
                    key={day.lineage_key}
                    className="plan-day"
                    {...dropProps(week.lineage_key, di, week.days, (days) => {
                      if (canEdit) setWeek({ ...week, days });
                    })}
                  >
                    <summary>{day.title || `Day ${di + 1}`}</summary>
                    <div className="plan-stack">
                      <div className="plan-card">
                        <Field
                          label="Day title"
                          value={day.title}
                          onChange={(title) => setDay(di, { ...day, title })}
                        />
                        <OrderControls
                          dragGroup={week.lineage_key}
                          label={`day ${di + 1}`}
                          index={di}
                          count={week.days.length}
                          move={(delta) =>
                            setWeek({
                              ...week,
                              days: move(week.days, di, delta),
                            })
                          }
                          duplicate={() => {
                            if (week.days.length < 7)
                              setWeek({
                                ...week,
                                days: [...week.days, duplicate(day)],
                              });
                          }}
                          remove={() => {
                            if (confirm("Remove this day?"))
                              setWeek({
                                ...week,
                                days: week.days.filter((_, i) => i !== di),
                              });
                          }}
                        />
                      </div>
                      <div className="plan-grid">
                        <Select
                          label="Day type"
                          value={day.day_kind}
                          onChange={(v) =>
                            setDay(di, {
                              ...day,
                              day_kind: v as Day["day_kind"],
                            })
                          }
                        >
                          {[
                            ["workout", "Workout"],
                            ["run", "Run / walk"],
                            ["hybrid", "Hybrid"],
                            ["active_recovery", "Active recovery"],
                            ["rest", "Rest"],
                          ].map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </Select>
                        <VideoSelect
                          value={day.coaching_video_id}
                          videos={videos}
                          onChange={(coaching_video_id) =>
                            setDay(di, { ...day, coaching_video_id })
                          }
                        />
                      </div>
                      {day.day_kind === "rest" &&
                        (day.blocks.length > 0 || day.cardio) && (
                          <button
                            type="button"
                            onClick={() =>
                              setDay(di, { ...day, blocks: [], cardio: null })
                            }
                          >
                            Clear session for rest day
                          </button>
                        )}
                      {day.day_kind !== "rest" && (
                        <>
                          {["workout", "hybrid", "active_recovery"].includes(
                            day.day_kind,
                          ) && (
                            <WorkoutEditor
                              blocks={day.blocks}
                              exercises={exercises}
                              videos={videos}
                              onChange={(blocks) =>
                                setDay(di, { ...day, blocks })
                              }
                            />
                          )}
                          {["run", "hybrid", "active_recovery"].includes(
                            day.day_kind,
                          ) && (
                            <OutdoorEditor
                              value={day.cardio}
                              onChange={(cardio) =>
                                setDay(di, { ...day, cardio })
                              }
                            />
                          )}
                        </>
                      )}
                    </div>
                  </details>
                ))}
                <button
                  type="button"
                  className="plan-secondary"
                  disabled={week.days.length >= 7}
                  onClick={() =>
                    setWeek({
                      ...week,
                      days: [
                        ...week.days,
                        newDay(
                          plan.discipline === "running" ? "run" : "workout",
                        ),
                      ],
                    })
                  }
                >
                  Add day
                </button>
                <details>
                  <summary>Apply progression</summary>
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
                      Preview progression
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
                        .filter((v) => !v.retired_at)
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
    </div>
  );
}
