import type { ProfileRow, WeightRow } from "./queries";

export type WeightSeries = {
  points: { date: string; kg: number }[];
  currentKg: number | null;
  targetKg: number | null;
  toGoKg: number | null;
};

export function buildWeightSeries(
  weights: WeightRow[],
  profile: Pick<ProfileRow, "target_weight_kg"> | null,
): WeightSeries {
  const points = weights
    .map((w) => ({ date: w.logged_at.slice(0, 10), kg: w.weight_kg }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const currentKg = points.length ? points[points.length - 1].kg : null;
  const targetKg = profile?.target_weight_kg ?? null;
  const toGoKg =
    currentKg != null && targetKg != null
      ? Math.round((currentKg - targetKg) * 10) / 10
      : null;
  return { points, currentKg, targetKg, toGoKg };
}
