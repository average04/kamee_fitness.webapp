import type { FormState } from "./profile";

/**
 * Autosave state machine shared by the Coaching Hub's editable fields
 * (profile form, cover upload). Pure and timer-injectable so it can be unit
 * tested without a DOM or React — components just wire up `update` on
 * change, `saveNow` on blur/select/checkbox/retry, and `dispose` on unmount.
 *
 * Rules (see task-10 brief / global constraints):
 * - `update()` debounces by `debounceMs` (default 800ms); only the latest
 *   input scheduled within the window is saved.
 * - `saveNow()` bypasses the debounce timer and saves immediately.
 * - Saves never overlap: a call that arrives while one is in flight replaces
 *   any previously queued input; exactly one follow-up save runs once the
 *   in-flight save settles, using the latest queued input.
 */

export type SaveState = "idle" | "saving" | "saved" | "error";

export type AutosaveController<T> = {
  update(input: T): void;
  saveNow(input: T): void;
  dispose(): void;
};

function formStateFailed(result: FormState): boolean {
  return Boolean(result.message) || Boolean(result.errors && Object.keys(result.errors).length > 0);
}

export function createAutosaveController<T>(opts: {
  save: (input: T) => Promise<FormState>;
  debounceMs?: number;
  onStateChange: (state: SaveState) => void;
  onResult?: (result: FormState) => void;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void;
}): AutosaveController<T> {
  const debounceMs = opts.debounceMs ?? 800;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id));

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let queuedInput: { value: T } | null = null;

  function settleQueue() {
    if (!queuedInput) return;
    const next = queuedInput.value;
    queuedInput = null;
    runSave(next);
  }

  function runSave(input: T) {
    inFlight = true;
    opts.onStateChange("saving");
    opts
      .save(input)
      .then((result) => {
        inFlight = false;
        opts.onResult?.(result);
        opts.onStateChange(formStateFailed(result) ? "error" : "saved");
        settleQueue();
      })
      .catch(() => {
        inFlight = false;
        opts.onStateChange("error");
        settleQueue();
      });
  }

  function trigger(input: T) {
    if (inFlight) {
      queuedInput = { value: input };
      return;
    }
    runSave(input);
  }

  return {
    update(input: T) {
      if (timerId !== null) clearTimer(timerId);
      timerId = setTimer(() => {
        timerId = null;
        trigger(input);
      }, debounceMs);
    },
    saveNow(input: T) {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
      }
      trigger(input);
    },
    dispose() {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
      }
    },
  };
}
