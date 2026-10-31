import { describe, expect, it, vi } from "vitest";
import { createConversationLifecycle } from "./lifecycle";

describe("browser conversation lifecycle", () => {
  it("polls only focused, visible, online and verifies identity on focus and visibility", async () => {
    let tick = () => {}; const refresh = vi.fn(async () => {}); const verify = vi.fn(async () => {}); const intervals: number[] = [];
    const active: boolean[] = [];
    const life = createConversationLifecycle({ verify, refresh, setActive: value => active.push(value),
      schedule: (callback, milliseconds) => { intervals.push(milliseconds); tick = callback; return () => { tick = () => {}; }; } });
    await life.update({ focused: true, visible: true, online: true });
    tick(); await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
    await life.update({ focused: true, visible: false, online: true });
    tick(); expect(refresh).toHaveBeenCalledTimes(2);
    await life.update({ focused: true, visible: true, online: false });
    tick(); expect(refresh).toHaveBeenCalledTimes(2);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(intervals).toEqual([15_000]);
    expect(active).toEqual([false, true, false, false]);
    life.dispose();
  });
  it("pauses on verification failure, retries in place and never verifies while inactive", async () => {
    let failing = true;
    const refresh = vi.fn(async () => {}); const active = vi.fn();
    const verify = vi.fn(async () => { if (failing) throw Error("connection unavailable"); });
    const life = createConversationLifecycle({ verify, refresh,
      setActive: active, schedule: () => () => {} });
    await life.update({ focused: true, visible: true, online: true });
    expect(refresh).not.toHaveBeenCalled(); expect(active).toHaveBeenLastCalledWith(false);
    await life.update({ focused: false, visible: true, online: true });
    await life.update({ focused: true, visible: true, online: false }); expect(verify).toHaveBeenCalledTimes(1);
    failing = false; await life.update({ focused: true, visible: true, online: true }); expect(refresh).toHaveBeenCalledTimes(1);
    life.dispose(); await life.update({ focused: true, visible: true, online: true });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("coalesces timer ticks while a refresh is outstanding and resumes once it completes", async () => {
    let tick = () => {}, finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const life = createConversationLifecycle({ verify: async () => {}, refresh, setActive() {}, schedule: callback => { tick = callback; return () => {}; } });
    const starting = life.update({ focused: true, visible: true, online: true }); await Promise.resolve(); await Promise.resolve();
    tick(); tick(); expect(refresh).toHaveBeenCalledTimes(1); finish(); await starting; await Promise.resolve();
    tick(); expect(refresh).toHaveBeenCalledTimes(2); finish(); life.dispose();
  });
});
