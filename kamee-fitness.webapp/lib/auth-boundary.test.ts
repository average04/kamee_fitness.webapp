import { describe, expect, it, vi } from "vitest";
import { broadcastAuthBoundary, subscribeAuthBoundary } from "./auth-boundary";
import { AuthBoundaryForm } from "@/components/auth/AuthBoundaryForm";
import { isDeleteConfirmation } from "./account-deletion";
import type { FormEvent } from "react";
describe("shared sign-out boundary", () => {
  it("retires subscribers synchronously before a server form can submit", () => {
    const order: string[] = []; const stop = subscribeAuthBoundary(() => order.push("hidden"));
    broadcastAuthBoundary(); order.push("submit"); expect(order).toEqual(["hidden", "submit"]);
    stop(); broadcastAuthBoundary(); expect(order).toEqual(["hidden", "submit"]);
  });
  it("receives a boundary from another tab without shared conversation storage", () => {
    let receive: (() => void) | null = null;
    vi.stubGlobal("window", { addEventListener() {}, localStorage: { setItem() {} } });
    vi.stubGlobal("BroadcastChannel", class { set onmessage(listener: () => void) { receive = listener; } postMessage() {} });
    const hidden = vi.fn(); const stop = subscribeAuthBoundary(hidden);
    expect(receive).not.toBeNull(); (receive as unknown as () => void)();
    expect(hidden).toHaveBeenCalledTimes(1); stop(); vi.unstubAllGlobals();
  });
  it("does not retire sessions when a deletion confirmation is invalid", () => {
    let value = "DELET"; let boundaries = 0;
    const stop = subscribeAuthBoundary(() => { boundaries++; });
    const form = AuthBoundaryForm({ broadcastWhen: () => isDeleteConfirmation(value) });
    const submit = form.props.onSubmit as (event: FormEvent<HTMLFormElement>) => void;
    const event = { currentTarget: {}, defaultPrevented: false } as FormEvent<HTMLFormElement>;
    submit(event); expect(boundaries).toBe(0);
    value = "DELETE"; submit(event); expect(boundaries).toBe(1); stop();
  });
});
