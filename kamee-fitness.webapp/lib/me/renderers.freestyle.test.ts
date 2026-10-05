import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import ExerciseSetTable from "@/components/me/ExerciseSetTable";
import RecordsList from "@/components/me/RecordsList";
import FeedItem from "@/components/me/FeedItem";
import { buildFeed } from "./feed";
import { summarizeWorkoutDetail } from "./workoutDetail";

const id = "personal:11111111-1111-4111-8111-111111111111";
it("does not invent volume or duration for an unmeasured reps-only workout in the feed", () => {
  const [item] = buildFeed([{ id: "past", source: "freestyle", performed_date: "2026-09-29", started_at: "2026-09-28T22:00:00Z", duration_seconds: null, status: "completed", avg_hr: null, day_id: null }], [
    { session_id: "past", plan_exercise_id: null, tracking_type: "reps", reps_done: 8, weight: null },
  ], [], {}, 50);
  const html = renderToStaticMarkup(createElement(FeedItem, { item, units: "metric" }));
  expect(html).toContain("1 set");
  expect(html).not.toContain("0 kg");
  expect(html).not.toContain("0m");
});
it("renders private occurrence links once encoded with readable unmeasured load and measured seconds", () => {
  const summary = summarizeWorkoutDetail([
    { exerciseId: id, occurrenceId: "first", name: "Private press", reps: 8, weightKg: null, trackingType: "weight_reps" },
    { exerciseId: id, occurrenceId: "second", name: "Private hold", reps: null, weightKg: null, durationSeconds: 45, trackingType: "duration" },
  ], [], {}, {}, {});
  const html = renderToStaticMarkup(createElement(ExerciseSetTable, { summary, units: "metric" }));
  expect(html.match(/href="\/me\/exercises\/personal%3A/g)).toHaveLength(2);
  expect(html).toContain("8 reps · load not recorded");
  expect(html).toContain("45 s");
  expect(html).not.toContain("0 kg");
  expect(html).not.toContain("null");
});
it("renders typed lifting record links once encoded", () => {
  const html = renderToStaticMarkup(createElement(RecordsList, {
    records: [{ exerciseId: id, name: "Private press", prKg: 60, prDateIso: "2026-09-29", est1RmKg: 70, timesTrained: 2, lastDoneIso: "2026-09-29" }], units: "metric",
  }));
  expect(html).toContain(`/me/exercises/personal%3A${id.split(":")[1]}`);
});
