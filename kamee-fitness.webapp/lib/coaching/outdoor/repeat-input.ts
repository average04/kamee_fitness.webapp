import { assertRunRepetitions } from "./runDayForm";

/** Keep text editing separate from the last committed prescription. */
export function repeatInputState(committed: number, draft = String(committed)) {
  try {
    const value = Number(draft);
    assertRunRepetitions(value);
    return { committed, draft, value, error: null };
  } catch (error) {
    return {
      committed,
      draft,
      value: null,
      error: error instanceof Error ? error.message : "Check the repetitions.",
    };
  }
}
