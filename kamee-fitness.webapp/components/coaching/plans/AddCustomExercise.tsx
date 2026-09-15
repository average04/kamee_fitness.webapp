"use client";
import { useState } from "react";
import { customExerciseIssue, makeCustomExercise } from "@/lib/coaching/custom-exercise";
import type { Exercise } from "@/lib/coaching/plans";
import { Field, Select } from "./Fields";

export function AddCustomExercise({ onAdd }: { onAdd: (exercise: Exercise) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState("reps");
  const [reps, setReps] = useState("10");
  const [seconds, setSeconds] = useState("45");
  const [error, setError] = useState<string | null>(null);
  if (!open) return <button type="button" className="plan-secondary" onClick={() => setOpen(true)}>Add custom exercise</button>;
  return <section className="plan-card plan-stack" aria-label="Custom exercise">
    <h4>Add custom exercise</h4>
    <p className="coach-panel-description">Create an exercise for this plan. You can add instructions and a demonstration video after adding it.</p>
    <Field label="Exercise name *" value={name} onChange={setName} />
    <div className="plan-grid">
      <Select label="Tracking" value={mode} onChange={setMode}>
        <option value="reps">Sets &amp; reps</option><option value="time">Timed</option>
      </Select>
      {mode === "time" ? <Field label="Seconds per set" type="number" min={1} max={3600} value={seconds} onChange={setSeconds} />
        : <Field label="Reps per set" value={reps} onChange={setReps} />}
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="plan-item-actions">
      <button type="button" className="coach-primary" onClick={() => {
        const prescription = mode === "time" ? `${seconds}s` : reps.trim();
        const issue = customExerciseIssue(name, prescription);
        if (issue) { setError(issue); return; }
        onAdd(makeCustomExercise(name, prescription)); setName(""); setError(null); setOpen(false);
      }}>Add exercise</button>
      <button type="button" className="plan-secondary" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
    </div>
  </section>;
}
