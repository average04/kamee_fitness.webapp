"use client";
import { useActionState } from "react";
import { createPlan } from "@/app/coaching/(hub)/plans/actions";

export function CreatePlan() {
  const [state, action, pending] = useActionState(createPlan, {});
  return (
    <form action={action} className="coach-panel plan-stack">
      <h2>Create plan</h2>
      <label>
        Title
        <input
          className="coach-input"
          name="title"
          required
          maxLength={120}
          placeholder="e.g. Four-week strength foundations"
        />
      </label>
      <label>
        Type
        <select name="discipline" className="coach-input">
          <option value="strength">Workout</option>
          <option value="running">Outdoor · Run / walk</option>
        </select>
      </label>
      {state.error && <p role="alert">{state.error}</p>}
      <button className="plan-primary" disabled={pending}>
        {pending ? "Creating…" : "Create plan"}
      </button>
    </form>
  );
}
