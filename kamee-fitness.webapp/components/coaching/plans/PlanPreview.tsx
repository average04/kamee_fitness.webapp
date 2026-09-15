"use client";
import { useState } from "react";
import Image from "next/image";
import type { ExerciseOption, PlanDocument } from "@/lib/coaching/plans";
import { GOAL_LABELS, planGoals } from "@/lib/coaching/goals";
import { calendarDays } from "@/lib/coaching/calendar";
import { flattenSegments } from "@/lib/coaching/outdoor/segments";

export function VideoPlayer({
  id,
  admin = false,
}: {
  id: string;
  admin?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function play() {
    setPending(true);
    setError("");
    try {
      const r = await fetch(
        `${admin ? "/admin/coaching-plans" : "/coaching/videos"}/sign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Playback unavailable");
      setUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Playback unavailable");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      {url ? (
        <video
          controls
          playsInline
          preload="metadata"
          src={url}
          className="plan-video"
          onError={() => {
            setUrl("");
            setError("Playback expired or failed. Try again.");
          }}
        />
      ) : (
        <button
          type="button"
          className="plan-secondary"
          disabled={pending}
          onClick={play}
        >
          {pending ? "Loading…" : "Play video"}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function PlanPreview({
  plan,
  exercises,
  admin = false,
}: {
  plan: PlanDocument;
  exercises: ExerciseOption[];
  admin?: boolean;
}) {
  const [locked, setLocked] = useState(false);
  return (
    <section className="plan-stack">
      <div className="plan-card">
        <h2>Member preview</h2>
        <label>
          <input
            type="checkbox"
            checked={locked}
            onChange={(e) => setLocked(e.target.checked)}
          />{" "}
          Locked preview
        </label>
      </div>
      <article className="coach-panel plan-stack">
        {planGoals(plan).length > 0 && <div>
          <h3>Goals</h3>
          <ul className="flex flex-wrap gap-2" aria-label="Plan goals">
            {planGoals(plan).map(goal => <li key={goal} className="rounded-full border border-white/10 px-3 py-1 text-sm">{GOAL_LABELS[goal] ?? goal}</li>)}
          </ul>
        </div>}
        {plan.cover_image_path && (
          <Image
            src={
              admin
                ? `/admin/coaching-plans/cover?plan=${plan.id}`
                : `/coaching/plans/cover?path=${encodeURIComponent(plan.cover_image_path)}`
            }
            alt="Plan cover"
            width={960}
            height={400}
            unoptimized
            className="coach-cover-preview"
          />
        )}
        <h2>{plan.title}</h2>
        <p>{plan.summary}</p>
        <p className="coach-panel-description">
          {plan.weeks.length} weeks · {plan.est_minutes_per_session ?? "—"} min
          / session · {plan.level}
        </p>
        {locked && <p className="coach-status">Plan content locked</p>}
        {plan.weeks.map((w, wi) => (
          <section key={w.lineage_key} className="plan-stack">
            <h3>
              Week {wi + 1} · {({ build: "Regular training", cutback: "Recovery week", taper: "Pre-event week", goal: "Event / goal week" })[w.role]}
            </h3>
            {w.days.map((d, di) => (
              <div key={d.lineage_key} className="plan-block plan-stack">
                <h4>
                  {calendarDays[di]}{d.title ? ` - ${d.title}` : ""}{" "}
                  <span className="coach-panel-description">
                    · {d.day_kind.replaceAll("_", " ")}
                  </span>
                </h4>
                {!locked && (
                  <>
                    {d.coaching_video_id && (
                      <VideoPlayer id={d.coaching_video_id} admin={admin} />
                    )}
                    {d.blocks.map((b) => (
                      <div key={b.lineage_key}>
                        <h5>{({ main: "Exercises", warmup: "Warm-up", cooldown: "Cool-down", superset: "Superset", circuit: "Circuit" })[b.kind]}</h5>
                        {b.exercises.map((e) => (
                          <div
                            className="plan-preview-exercise"
                            key={e.lineage_key}
                          >
                            <strong>
                              {e.custom_name ?? exercises.find((x) => x.id === e.exercise_id)
                                ?.name ?? "Exercise"}
                            </strong>
                            <p>
                              {e.sets} × {e.reps} · {e.rest_seconds}s rest
                              {e.tempo ? ` · Tempo ${e.tempo}` : ""}
                              {e.weight_hint ? ` · ${e.weight_hint}` : ""}
                            </p>
                            {e.notes && <p>{e.notes}</p>}
                            {e.coaching_video_id && (
                              <VideoPlayer
                                id={e.coaching_video_id}
                                admin={admin}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    {d.cardio && (
                      <>
                        <p>{d.cardio.notes}</p>
                        <ol className="plan-segments">
                          {flattenSegments(d.cardio.segments).map((s, i) => (
                            <li key={i}>
                              {s.mode} · {s.seconds}s · {s.effort}
                              {s.cue ? ` — ${s.cue}` : ""}
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </section>
        ))}
        {plan.meals && (
          <section className="plan-stack">
            <h3>{plan.meals.title}</h3>
            {plan.meals.days.map((d) => (
              <details key={d.day_key}>
                <summary>{d.label}</summary>
                {!locked && (
                  <div className="plan-stack">
                    <p>{d.note}</p>
                    <p>
                      {d.kcal} kcal · {d.protein_g}g protein · {d.carbs_g}g
                      carbs · {d.fat_g}g fat
                    </p>
                    {d.meals.map((m, i) => (
                      <div className="plan-block plan-stack" key={i}>
                        <h4>
                          {m.title} · {m.slot.replaceAll("_", " ")}
                        </h4>
                        <p>{m.portion_note}</p>
                        <ul>
                          {m.ingredients.map((x, j) => (
                            <li key={j}>
                              {x.quantity} {x.unit} {x.name}
                            </li>
                          ))}
                        </ul>
                        <ol>
                          {m.steps.map((s, j) => (
                            <li key={j}>{s}</li>
                          ))}
                        </ol>
                        {m.substitutions.map((s, j) => (
                          <p key={j}>
                            {s.for} → {s.use}. {s.note}
                          </p>
                        ))}
                        <p>
                          {m.kcal} kcal · {m.protein_g}g protein · {m.carbs_g}g
                          carbs · {m.fat_g}g fat
                        </p>
                        {m.video_id && (
                          <VideoPlayer id={m.video_id} admin={admin} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </section>
        )}
      </article>
    </section>
  );
}
