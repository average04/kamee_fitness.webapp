import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import * as metrics from "./metrics";
import { loadDashboard } from "@/app/admin/(panel)/metrics";

const fixtureContext = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => fixtureContext.client }));

it("counts every mixed training session and daily trend beyond the transport row cap", async () => {
  const requests: URL[] = [];
  const rows = Array.from({ length: 1205 }, (_, i) => ({
    id: String(1205 - i).padStart(6, "0"),
    source: i % 2 ? "freestyle" : "planned",
    started_at: i % 2 ? "2026-09-28T12:00:00Z" : "2026-09-29T09:00:00Z",
    performed_date: i % 2 ? "2026-09-30" : null,
    status: "completed", submitted_at: null,
  }));
  rows.push({ ...rows[0], id: "old", started_at: "2026-08-01T09:00:00Z" });
  rows.push({ ...rows[1], id: "active", status: "active" });
  fixtureContext.client = createClient("http://fixture.invalid", "fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      let result = [] as typeof rows;
      if (url.pathname.endsWith("/workout_sessions") && url.searchParams.get("select")?.includes("source")) {
        requests.push(url);
        const filter = url.searchParams.get("or") ?? "";
        expect(url.searchParams.get("status")).toBe("eq.completed");
        expect(filter).toContain("performed_date.gte.2026-09-03");
        expect(filter).toContain("started_at.gte.2026-09-03T00:00:00.000Z");
        result = rows.filter((r) => r.status === "completed" && (r.source === "freestyle"
          ? r.performed_date! >= "2026-09-03" : r.started_at >= "2026-09-03T00:00:00.000Z"));
        if (url.searchParams.get("order") === "id.asc") result.sort((a, b) => a.id.localeCompare(b.id));
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000);
        result = result.slice(offset, offset + limit);
      }
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  const dashboard = await loadDashboard(new Date("2026-10-03T00:00:00Z"));
  expect(dashboard.totals.workouts30d).toBe(1205);
  expect(dashboard.sessions.filter((s) => s.workout)).toEqual([
    { date: "2026-09-29", workout: 603, cardio: 0 },
    { date: "2026-09-30", workout: 602, cardio: 0 },
  ]);
  expect(requests.map((u) => u.searchParams.get("offset") ?? "0")).toEqual(["0", "500", "1000"]);
  expect(requests.every((u) => u.searchParams.get("order") === "id.asc")).toBe(true);
});

it("uses performed dates for training and submission audit for saved activity without fabricating historical timestamps", () => {
  const rows: metrics.WorkoutMetricRow[] = [
    { source: "planned", started_at: "2026-09-29T10:00:00Z", performed_date: null, submitted_at: null, status: "completed" },
    { source: "freestyle", started_at: "2026-09-28T22:00:00Z", performed_date: "2026-09-29", submitted_at: "2026-10-03T00:00:00Z", status: "completed" },
    { source: "planned", started_at: "2026-09-29T12:00:00Z", submitted_at: "2026-10-03T01:00:00Z", status: "active" },
  ];
  expect(metrics.workoutTrainingTimestamps(rows)).toEqual(["2026-09-29T10:00:00Z", "2026-09-29"]);
  expect(metrics.workoutSavedActivity(rows)).toEqual([{ type: "workout", label: "Workout saved", at: "2026-10-03T00:00:00Z" }]);
});
