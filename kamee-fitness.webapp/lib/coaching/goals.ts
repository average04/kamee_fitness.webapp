export const GOAL_LABELS: Record<string, string> = {
  strength: "Build strength", hypertrophy: "Build muscle", conditioning: "Improve endurance",
  general_fitness: "Improve fitness", weight_loss_foundation: "Weight management",
  mobility: "Improve mobility", running_speed: "Run faster", running_distance: "Run farther",
  race_preparation: "Race preparation", consistency: "Build consistency", recovery: "Recovery",
};
/** Old servers/drafts have one free-text goal; never silently split that text. */
export function planGoals(plan: { goals?: string[]; goal: string | null }): string[] {
  return plan.goals ?? (plan.goal?.trim() ? [plan.goal] : []);
}
