import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaveController, shallowEqual, type SaveState } from "./autosave";
import type { FormState } from "./profile";

/** A promise plus externally-callable resolve/reject, for controlling when an in-flight save settles. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutosaveController", () => {
  it("debounces update() calls: only the last input within debounceMs is saved", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: (s) => states.push(s) });

    c.update("a");
    vi.advanceTimersByTime(300);
    c.update("b");
    vi.advanceTimersByTime(300);
    c.update("c");
    vi.advanceTimersByTime(799);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    // The timer fired synchronously, but fix round 2 routes the actual
    // opts.save(input) call through a microtask (Promise.resolve().then())
    // so a synchronous throw inside it still lands in .catch(); flush that
    // microtask before checking the mock was called.
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("c");
  });

  it("calls onStateChange('saving') then 'saved' on a successful save", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("x");
    expect(states).toEqual(["saving"]);
    await vi.waitFor(() => expect(states).toEqual(["saving", "saved"]));
  });

  it("calls onStateChange('error') when the save result carries a message", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ message: "nope" }));
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("x");
    await vi.waitFor(() => expect(states).toEqual(["saving", "error"]));
  });

  it("calls onStateChange('error') when the save result carries field errors", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({
      errors: { headline: "too long" },
    }));
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("x");
    await vi.waitFor(() => expect(states).toEqual(["saving", "error"]));
  });

  it("calls onStateChange('error') when the save promise rejects", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => {
      throw new Error("network down");
    });
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("x");
    await vi.waitFor(() => expect(states).toEqual(["saving", "error"]));
  });

  it("calls onStateChange('error') when save throws synchronously, instead of escaping saveNow() uncaught", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(() => {
      throw new Error("boom, synchronously");
    });
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    // Must not throw synchronously out of saveNow() itself.
    expect(() => c.saveNow("x")).not.toThrow();
    await vi.waitFor(() => expect(states).toEqual(["saving", "error"]));
  });

  it("saveNow() bypasses the debounce timer and fires immediately", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: () => {} });

    c.update("a");
    c.saveNow("b");
    await Promise.resolve(); // flush the microtask opts.save is now called through
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("b");

    // The pending debounce timer for "a" must have been cancelled by saveNow.
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("never overlaps saves: a call while one is in flight queues only the latest input for one follow-up save", async () => {
    const first = deferred<FormState>();
    const save = vi.fn<(input: string) => Promise<FormState>>().mockReturnValueOnce(first.promise);
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("a");
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);

    // Fires while "a" is still in flight -- must queue, not call save again yet.
    c.saveNow("b");
    c.saveNow("c");
    expect(save).toHaveBeenCalledTimes(1);

    const second = deferred<FormState>();
    save.mockReturnValueOnce(second.promise);
    first.resolve({ savedAt: "t1" });

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("c");

    second.resolve({ savedAt: "t2" });
    await vi.waitFor(() => expect(states.at(-1)).toBe("saved"));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("dispose() flushes a pending debounced save instead of dropping the last edit", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: () => {} });

    c.update("a");
    c.dispose();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("a");

    // The (now-cancelled) timer's original delay elapsing must not fire a second save.
    vi.advanceTimersByTime(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("dispose() is a no-op when nothing is pending (never edited, or already settled)", () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: () => {} });

    c.dispose();
    expect(save).not.toHaveBeenCalled();
  });

  it("update() that lands while a save is in flight is queued once its debounce timer fires", async () => {
    const first = deferred<FormState>();
    const save = vi.fn<(input: string) => Promise<FormState>>().mockReturnValueOnce(first.promise);
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: () => {} });

    c.saveNow("a");
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);

    c.update("b");
    vi.advanceTimersByTime(800);
    // The debounce timer fired and called trigger("b"), but "a" is still in
    // flight, so it must have been queued rather than started immediately.
    expect(save).toHaveBeenCalledTimes(1);

    const second = deferred<FormState>();
    save.mockReturnValueOnce(second.promise);
    first.resolve({ savedAt: "t1" });

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("b");
    second.resolve({ savedAt: "t2" });
  });

  it("a queued save still runs after the in-flight save settles with an error", async () => {
    const first = deferred<FormState>();
    const save = vi.fn<(input: string) => Promise<FormState>>().mockReturnValueOnce(first.promise);
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("a");
    c.saveNow("b"); // queued while "a" is in flight

    const second = deferred<FormState>();
    save.mockReturnValueOnce(second.promise);
    first.resolve({ message: "boom" }); // "a" fails

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("b");

    second.resolve({ savedAt: "t2" });
    await vi.waitFor(() => expect(states.at(-1)).toBe("saved"));
  });

  it("a queued save still runs after the in-flight save's promise rejects, and settles", async () => {
    const first = deferred<FormState>();
    const save = vi.fn<(input: string) => Promise<FormState>>().mockReturnValueOnce(first.promise);
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("a");
    c.saveNow("b"); // queued while "a" is in flight

    const second = deferred<FormState>();
    save.mockReturnValueOnce(second.promise);
    first.reject(new Error("network down")); // "a" rejects outright, not just a message result

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("b");

    second.resolve({ savedAt: "t2" });
    await vi.waitFor(() => expect(states.at(-1)).toBe("saved"));
  });

  it("skips a save whose input matches the last successfully saved snapshot", async () => {
    const save = vi.fn<(input: { a: number }) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<{ a: number }>({ save, onStateChange: () => {} });

    c.saveNow({ a: 1 });
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    c.saveNow({ a: 1 }); // unchanged since the last successful save
    expect(save).toHaveBeenCalledTimes(1);

    c.saveNow({ a: 2 }); // actually changed
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });

  it("does not skip a repeat of an input whose last save failed", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ message: "boom" }));
    const c = createAutosaveController<string>({ save, onStateChange: () => {} });

    c.saveNow("a");
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    c.saveNow("a"); // retry of the same input -- must not be treated as "unchanged"
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });

  it("passes the full result to onResult", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({
      errors: { about: "too short" },
    }));
    let last: FormState | undefined;
    const c = createAutosaveController<string>({
      save,
      onStateChange: () => {},
      onResult: (r) => {
        last = r;
      },
    });

    c.saveNow("x");
    await vi.waitFor(() => expect(last).toEqual({ errors: { about: "too short" } }));
  });
});

describe("queue before the equality shortcut (PR review finding 2)", () => {
  it("save A, start B, request A again while B is pending, resolve B -> saves [A, B, A] and ends saved on A", async () => {
    const pending: Array<ReturnType<typeof deferred<FormState>>> = [];
    const save = vi.fn<(input: string) => Promise<FormState>>(() => {
      const d = deferred<FormState>();
      pending.push(d);
      return d.promise;
    });
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("A");
    await Promise.resolve();
    pending[0].resolve({ savedAt: "t1" });
    await vi.waitFor(() => expect(states.at(-1)).toBe("saved"));

    c.saveNow("B");
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(2);
    expect(c.hasPending()).toBe(true);

    // A equals the last successful save, but B is in flight and will overwrite it:
    // A must be queued, not skipped.
    c.saveNow("A");
    expect(c.hasPending()).toBe(true);

    pending[1].resolve({ savedAt: "t2" });
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(save.mock.calls.map((call) => call[0])).toEqual(["A", "B", "A"]);
    expect(c.hasPending()).toBe(true);

    pending[2].resolve({ savedAt: "t3" });
    await vi.waitFor(() => expect(c.hasPending()).toBe(false));
    expect(states.at(-1)).toBe("saved");

    // The final saved value is A: repeating A is now a no-op, B is not.
    c.saveNow("A");
    expect(save).toHaveBeenCalledTimes(3);
    c.saveNow("B");
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(4);
    expect(save).toHaveBeenLastCalledWith("B");
  });

  it("a queued input equal to what the in-flight save just stored is dropped, not re-sent", async () => {
    const pending: Array<ReturnType<typeof deferred<FormState>>> = [];
    const save = vi.fn<(input: string) => Promise<FormState>>(() => {
      const d = deferred<FormState>();
      pending.push(d);
      return d.promise;
    });
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("B");
    await Promise.resolve();
    c.saveNow("B"); // queued behind the identical in-flight save
    pending[0].resolve({ savedAt: "t" });
    await vi.waitFor(() => expect(c.hasPending()).toBe(false));
    expect(save).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe("saved");
  });

  it("after the server refuses an in-flight save, a queued input equal to the stored value reports saved without a round trip and clears the refusal", async () => {
    const pending: Array<ReturnType<typeof deferred<FormState>>> = [];
    const save = vi.fn<(input: string) => Promise<FormState>>(() => {
      const d = deferred<FormState>();
      pending.push(d);
      return d.promise;
    });
    const states: SaveState[] = [];
    const results: FormState[] = [];
    const c = createAutosaveController<string>({
      save,
      onStateChange: (s) => states.push(s),
      onResult: (r) => results.push(r),
    });

    c.saveNow("A");
    await Promise.resolve();
    pending[0].resolve({ savedAt: "t1" });
    await vi.waitFor(() => expect(states.at(-1)).toBe("saved"));

    c.saveNow("B");
    await Promise.resolve();
    c.saveNow("A"); // user reverted while B was in flight
    // The server answered and refused B, so it definitely still holds A.
    pending[1].resolve({ errors: { headline: "Too long" } });
    await vi.waitFor(() => expect(c.hasPending()).toBe(false));
    expect(save).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toBe("saved");
    // B's field errors are cleared rather than left next to "Saved".
    expect(results.at(-1)).toEqual({});
  });

  it("after an in-flight save is rejected, the stored value is unknown, so a queued input equal to the old value is still sent", async () => {
    const pending: Array<ReturnType<typeof deferred<FormState>>> = [];
    const save = vi.fn<(input: string) => Promise<FormState>>(() => {
      const d = deferred<FormState>();
      pending.push(d);
      return d.promise;
    });
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("A");
    await Promise.resolve();
    pending[0].resolve({ savedAt: "t1" });
    await vi.waitFor(() => expect(states.at(-1)).toBe("saved"));

    c.saveNow("B");
    await Promise.resolve();
    c.saveNow("A");
    // A lost response: B may or may not have committed.
    pending[1].reject(new Error("network"));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(save.mock.calls.map((call) => call[0])).toEqual(["A", "B", "A"]);
    pending[2].resolve({ savedAt: "t3" });
    await vi.waitFor(() => expect(c.hasPending()).toBe(false));
    expect(states.at(-1)).toBe("saved");
  });
});

describe("hasPending()", () => {
  it("is false before anything has happened", () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<string>({ save, onStateChange: () => {} });
    expect(c.hasPending()).toBe(false);
  });

  it("is true while a debounce timer is pending, false once it fires and settles", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: () => {} });

    c.update("a");
    expect(c.hasPending()).toBe(true);

    vi.advanceTimersByTime(800);
    expect(c.hasPending()).toBe(true); // now in flight

    await vi.waitFor(() => expect(c.hasPending()).toBe(false));
  });

  it("is true while a save is in flight", async () => {
    const first = deferred<FormState>();
    const save = vi.fn<(input: string) => Promise<FormState>>().mockReturnValueOnce(first.promise);
    const c = createAutosaveController<string>({ save, onStateChange: () => {} });

    c.saveNow("a");
    expect(c.hasPending()).toBe(true);

    first.resolve({ savedAt: "t" });
    await vi.waitFor(() => expect(c.hasPending()).toBe(false));
  });

  it("stays true across a queued save until the queued save itself settles", async () => {
    const first = deferred<FormState>();
    const save = vi.fn<(input: string) => Promise<FormState>>().mockReturnValueOnce(first.promise);
    const c = createAutosaveController<string>({ save, onStateChange: () => {} });

    c.saveNow("a");
    c.saveNow("b"); // queued
    expect(c.hasPending()).toBe(true);

    const second = deferred<FormState>();
    save.mockReturnValueOnce(second.promise);
    first.resolve({ savedAt: "t1" });

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(c.hasPending()).toBe(true); // the queued save ("b") is now the one in flight

    second.resolve({ savedAt: "t2" });
    await vi.waitFor(() => expect(c.hasPending()).toBe(false));
  });

  it("is false after a save is skipped for matching the last successfully saved snapshot", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<string>({ save, onStateChange: () => {} });

    c.saveNow("a");
    await vi.waitFor(() => expect(c.hasPending()).toBe(false));

    c.saveNow("a"); // unchanged -- skipped entirely
    expect(save).toHaveBeenCalledTimes(1);
    expect(c.hasPending()).toBe(false);
  });
});

describe("shallowEqual", () => {
  it("compares primitives with Object.is", () => {
    expect(shallowEqual("a", "a")).toBe(true);
    expect(shallowEqual(1, 2)).toBe(false);
    expect(shallowEqual(NaN, NaN)).toBe(true);
  });

  it("compares flat objects key by key", () => {
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "y" })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("treats null/non-object mismatches as unequal", () => {
    expect(shallowEqual<unknown>(null, {})).toBe(false);
    expect(shallowEqual<unknown>({}, null)).toBe(false);
    expect(shallowEqual<unknown>("a", { a: 1 })).toBe(false);
  });
});
