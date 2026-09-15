"use client";
import { useId, useState } from "react";
import { newDay, type Day, type Week, type ExerciseOption, type Video } from "@/lib/coaching/plans";
import { Field, VideoSelect } from "./Fields";
import { WorkoutEditor } from "./WorkoutEditor";
import { OutdoorEditor } from "./OutdoorEditor";
import { calendarDays, replaceCalendarDay } from "@/lib/coaching/calendar";

const kinds: Record<Day["day_kind"], string> = {
  workout: "Workout", run: "Run / walk", rest: "Rest", hybrid: "Workout + run", active_recovery: "Recovery",
};

export function WeekSchedule({ week, exercises, videos, onChange }: {
  week: Week; exercises: ExerciseOption[]; videos: Video[]; onChange: (week: Week) => void;
}) {
  const [selected, setSelected] = useState(0);
  const panelId = useId();
  const day = week.days[selected];
  const setDay = (next: Day) => onChange(replaceCalendarDay(week, selected, next));
  function choose(kind: Day["day_kind"]) {
    const current = day ?? newDay(kind);
    const dropBlocks = ["run", "rest"].includes(kind) && current.blocks.length > 0;
    const dropCardio = ["workout", "rest"].includes(kind) && !!current.cardio;
    if ((dropBlocks || dropCardio) && !confirm("Changing this session removes its " +
      [dropBlocks && "exercises", dropCardio && "run / walk session"].filter(Boolean).join(" and ") + ". Continue?")) return;
    setDay({ ...current, day_kind: kind, blocks: dropBlocks ? [] : current.blocks,
      cardio: dropCardio ? null : current.cardio });
  }
  return <div className="plan-stack">
    <div className="plan-week-strip" aria-label="Plan days">
      {calendarDays.map((name, index) => {
        const session = week.days[index];
        return <button key={name} type="button" aria-label={`${name}: ${session ? kinds[session.day_kind] : "Unscheduled"}`}
          aria-pressed={selected === index} aria-controls={panelId} onClick={() => setSelected(index)}>
          <span aria-hidden="true" className="plan-weekday-letter">{name}</span>
          <span aria-hidden="true" className="plan-weekday-status">{session ? kinds[session.day_kind] : "+"}</span>
          <span aria-hidden="true" className={`plan-day-mark ${session && session.day_kind !== "rest" ? "has-session" : ""}`} />
        </button>;
      })}
    </div>
    <p className="coach-panel-description">Build sessions in order. Members choose which weekdays to train. Unscheduled days are rest days.</p>
    <section id={panelId} aria-label={`${calendarDays[selected]} session`} className="plan-day-panel">
      <div key={calendarDays[selected]} className="plan-stack plan-session-enter">
        <div className="flex items-center justify-between gap-3">
          <h3 className="plan-selected-day">{calendarDays[selected]}</h3>
          {day && day.day_kind !== "rest" && <button type="button" className="plan-secondary text-red-400"
            onClick={() => {
              if (confirm(`Remove all activities from ${calendarDays[selected]}? Other days will stay unchanged.`))
                setDay({ ...newDay("rest"), lineage_key: day.lineage_key });
            }}>Remove activity</button>}
        </div>
        <div className="plan-session-choices" aria-label="Session type">
          {(["workout", "run", "hybrid", "rest"] as const).map(kind =>
            <button key={kind} type="button" aria-pressed={day?.day_kind === kind} onClick={() => choose(kind)}>
              {kind === "hybrid" ? "Hybrid" : kinds[kind]}
            </button>)}
        </div>
        {!day && <div className="plan-empty"><p>What would you like to add?</p></div>}
        {day?.day_kind === "rest" && <p className="plan-rest-message">Rest day. No session to build.</p>}
        {day && day.day_kind !== "rest" && <>
          <Field label="Session name" value={day.title} onChange={title => setDay({ ...day, title })} />
          {["workout", "hybrid", "active_recovery"].includes(day.day_kind) &&
            <WorkoutEditor blocks={day.blocks} exercises={exercises} videos={videos}
              onChange={blocks => setDay({ ...day, blocks })} />}
          {["run", "hybrid", "active_recovery"].includes(day.day_kind) &&
            <OutdoorEditor value={day.cardio} onChange={cardio => setDay({ ...day, cardio })} />}
          {day.day_kind === "workout" && <button type="button" className="plan-secondary" onClick={() => choose("hybrid")}>Add run / walk to this day</button>}
          {day.day_kind === "run" && <button type="button" className="plan-secondary" onClick={() => choose("hybrid")}>Add workout to this day</button>}
        </>}
        {day && <details className="plan-advanced">
            <summary>Day video &amp; other options</summary>
            <div className="plan-stack">
              <VideoSelect value={day.coaching_video_id} videos={videos}
                onChange={coaching_video_id => setDay({ ...day, coaching_video_id })} />
              <button type="button" className="plan-secondary" onClick={() => choose("active_recovery")}>Set as active recovery</button>
            </div>
          </details>}
      </div>
    </section>
  </div>;
}
