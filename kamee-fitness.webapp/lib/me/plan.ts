export type PlanProgressInput = {
  title: string;
  currentWeek: number;
  totalWeeks: number;
} | null;

export type PlanSummary = {
  title: string;
  currentWeek: number;
  totalWeeks: number;
  pct: number;
};

export function summarizePlan(input: PlanProgressInput): PlanSummary | null {
  if (!input) return null;
  const { title, currentWeek, totalWeeks } = input;
  const pct =
    totalWeeks > 0
      ? Math.max(0, Math.min(100, Math.round((currentWeek / totalWeeks) * 100)))
      : 0;
  return { title, currentWeek, totalWeeks, pct };
}
