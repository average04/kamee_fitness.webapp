import type { FormState } from "./profile";

/**
 * Autosave state machine shared by the Coaching Hub's editable fields
 * (profile form, cover upload). Pure and timer-injectable so it can be unit
 * tested without a DOM or React — components just wire up `update` on
 * change, `saveNow` on blur/select/checkbox/retry, and `dispose` on unmount.
 *
 * Rules (see task-10 brief / global constraints, tightened by fix round 1):
 * - `update()` debounces by `debounceMs` (default 800ms); only the latest
 *   input scheduled within the window is saved.
 * - `saveNow()` bypasses the debounce timer and saves immediately.
 * - Saves never overlap: a call that arrives while one is in flight replaces
 *   any previously queued input; exactly one follow-up save runs once the
 *   in-flight save settles (success OR failure), using the latest queued
 *   input.
 * - `dispose()` flushes a pending debounced input as one fire-and-forget
 *   save instead of dropping the user's last edit; it is a no-op when
 *   nothing is pending.
 * - A call whose input is `isEqual` to the last *successfully* saved input
 *   is skipped entirely (no network round trip) -- blur/debounce firing on
 *   a field the user didn't actually change is a no-op.
 * - `hasPending()` reports whether there is unsaved work outstanding (a
 *   debounce timer waiting to fire, a save in flight, or a save queued
 *   behind one in flight) -- fix round 2's I6: this is the single source of
 *   truth a `beforeunload` handler should read, rather than a React flag
 *   that drifts out of sync with the controller's actual state.
 */

export type SaveState = "idle" | "saving" | "saved" | "error";

export type AutosaveController<T> = {
  update(input: T): void;
  saveNow(input: T): void;
  dispose(): void;
  hasPending(): boolean;
};

function formStateFailed(result: FormState): boolean {
  return Boolean(result.message) || Boolean(result.errors && Object.keys(result.errors).length > 0);
}

/** Default equality for the "skip an unchanged save" rule: shallow, key-by-key for plain objects, `Object.is` for primitives. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }
  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const aKeys = Object.keys(aRec);
  const bKeys = Object.keys(bRec);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => Object.is(aRec[k], bRec[k]));
}

export function createAutosaveController<T>(opts: {
  save: (input: T) => Promise<FormState>;
  debounceMs?: number;
  isEqual?: (a: T, b: T) => boolean;
  onStateChange: (state: SaveState) => void;
  onResult?: (result: FormState) => void;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void;
}): AutosaveController<T> {
  const debounceMs = opts.debounceMs ?? 800;
  const isEqual = opts.isEqual ?? shallowEqual;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id));

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let pendingInput: { value: T } | null = null; // the input a pending debounce timer will fire with
  let inFlight = false;
  let queuedInput: { value: T } | null = null;
  let lastSaved: { value: T } | null = null;

  function settleQueue() {
    if (!queuedInput) return;
    const next = queuedInput.value;
    queuedInput = null;
    runSave(next);
  }

  function runSave(input: T) {
    inFlight = true;
    opts.onStateChange("saving");
    // Fix round 2: route the call through Promise.resolve().then(...) so a
    // *synchronous* throw inside opts.save (not just a rejected promise)
    // still lands in the .catch() below instead of escaping runSave()
    // uncaught (which would happen synchronously inside saveNow()'s caller,
    // e.g. an onBlur handler).
    Promise.resolve()
      .then(() => opts.save(input))
      .then((result) => {
        inFlight = false;
        opts.onResult?.(result);
        const failed = formStateFailed(result);
        if (!failed) lastSaved = { value: input };
        opts.onStateChange(failed ? "error" : "saved");
        settleQueue();
      })
      .catch(() => {
        inFlight = false;
        opts.onStateChange("error");
        settleQueue();
      });
  }

  function trigger(input: T) {
    if (lastSaved && isEqual(lastSaved.value, input)) {
      // Nothing changed since the last successful save -- skip the round trip.
      return;
    }
    if (inFlight) {
      queuedInput = { value: input };
      return;
    }
    runSave(input);
  }

  return {
    update(input: T) {
      if (timerId !== null) clearTimer(timerId);
      pendingInput = { value: input };
      timerId = setTimer(() => {
        timerId = null;
        pendingInput = null;
        trigger(input);
      }, debounceMs);
    },
    saveNow(input: T) {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
        pendingInput = null;
      }
      trigger(input);
    },
    dispose() {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
      }
      if (pendingInput) {
        const toSave = pendingInput.value;
        pendingInput = null;
        // Fire-and-forget: the component is unmounting, nothing left to await into.
        trigger(toSave);
      }
    },
    hasPending() {
      return timerId !== null || inFlight || queuedInput !== null;
    },
  };
}
