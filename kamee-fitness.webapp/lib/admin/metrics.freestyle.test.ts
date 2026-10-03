import { expect, it } from "vitest";
import * as metrics from "./metrics";

it("uses performed dates for training and submission audit for saved activity without fabricating historical timestamps", () => {
  const rows: metrics.WorkoutMetricRow[] = [
    { source: "planned", started_at: "2026-09-29T10:00:00Z", performed_date: null, submitted_at: null, status: "completed" },
    { source: "freestyle", started_at: "2026-09-28T22:00:00Z", performed_date: "2026-09-29", submitted_at: "2026-10-03T00:00:00Z", status: "completed" },
    { source: "planned", started_at: "2026-09-29T12:00:00Z", submitted_at: "2026-10-03T01:00:00Z", status: "active" },
  ];
  expect(metrics.workoutTrainingTimestamps(rows)).toEqual(["2026-09-29T10:00:00Z", "2026-09-29"]);
  expect(metrics.workoutSavedActivity(rows)).toEqual([{ type: "workout", label: "Workout saved", at: "2026-10-03T00:00:00Z" }]);
});
