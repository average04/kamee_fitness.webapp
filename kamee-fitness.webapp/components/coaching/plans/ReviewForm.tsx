"use client";
import { useActionState } from "react";
import {
  reviewPlan,
  reviewExercise,
} from "@/app/admin/(panel)/coaching-plans/actions";
import type { ExerciseOption } from "@/lib/coaching/plans";

export function ReviewForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reviewPlan, {});
  return (
    <form className="plan-stack" action={action}>
      <input type="hidden" name="id" value={id} />
      <label>
        Decision
        <select name="decision" className="coach-input">
          <option value="changes_requested">Request changes</option>
          <option value="approved">Approve</option>
        </select>
      </label>
      <label>
        Feedback
        <textarea
          name="note"
          className="coach-input"
          rows={3}
          maxLength={2000}
        />
      </label>
      <button className="plan-primary" disabled={pending}>
        Save review
      </button>
      <p role="status">{state.error ?? state.message}</p>
    </form>
  );
}
export function ExerciseReviewForm({
  id,
  exercises,
}: {
  id: string;
  exercises: ExerciseOption[];
}) {
  const [state, action, pending] = useActionState(reviewExercise, {});
  return (
    <form className="plan-stack" action={action}>
      <input type="hidden" name="id" value={id} />
      <label>
        Decision
        <select name="decision" className="coach-input">
          <option value="added">Link catalog exercise</option>
          <option value="declined">Decline</option>
        </select>
      </label>
      <label>
        Exercise
        <select name="exercise" className="coach-input">
          <option value="">Choose exercise</option>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Note
        <textarea name="note" className="coach-input" maxLength={2000} />
      </label>
      <button className="plan-primary" disabled={pending}>
        Save decision
      </button>
      <p role="status">{state.error ?? state.message}</p>
    </form>
  );
}
