import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailCodeSignIn } from "@/components/auth/EmailCodeSignIn";

const { signInWithOtp, verifyOtp } = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({ auth: { signInWithOtp, verifyOtp } }),
}));

let dom: JSDOM | undefined;
let root: Root | undefined;
let destination: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  destination = undefined;
  signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
  verifyOtp.mockResolvedValue({ data: { user: { id: "verified-account" }, session: {} }, error: null });
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  dom?.window.close();
  dom = undefined;
  vi.unstubAllGlobals();
});

async function mount(next: string | null, fallbackNext?: string) {
  dom = new JSDOM('<div id="root"></div>', { url: "https://kamee.fit/login" });
  Object.defineProperty(dom.window, "location", { value: {
    origin: "https://kamee.fit",
    hostname: "kamee.fit",
    get href() { return "https://kamee.fit/login"; },
    set href(value: string) { destination = value; },
  } });
  // Only the external provider is replaced. Token consumption and widget
  // lifecycle still run through the application's Turnstile session.
  dom.window.turnstile = {
    render: (_container, options) => { options.callback("verified-captcha-token"); return "widget-id"; },
    remove: () => {},
  };
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  root = (await import("react-dom/client")).createRoot(document.getElementById("root")!);
  await act(async () => root!.render(createElement(EmailCodeSignIn, {
    next, fallbackNext, invitedEmail: "coach@kamee.fit",
  })));
}

async function submitCode() {
  const input = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom!.window.HTMLInputElement.prototype, "value")!.set!.call(input, "123456");
    input.dispatchEvent(new dom!.window.Event("input", { bubbles: true }));
    input.dispatchEvent(new dom!.window.Event("change", { bubbles: true }));
  });
  await act(async () => input.form!.dispatchEvent(new dom!.window.Event("submit", { bubbles: true, cancelable: true })));
}

async function requestEmail() {
  await act(async () => document.querySelector("form")!.dispatchEvent(new dom!.window.Event("submit", { bubbles: true, cancelable: true })));
}

describe("email code sign-in continuation", () => {
  it("resolves an explicit admin continuation on the server after verifying a code", async () => {
    await mount("/admin");
    await submitCode();
    expect(verifyOtp).toHaveBeenCalledWith({ email: "coach@kamee.fit", token: "123456", type: "email" });
    expect(destination).toBe("/auth/landing?next=%2Fadmin");
  });

  it("preserves an invitation's query and fragment through the server resolver", async () => {
    await mount("/coaching/invite/recipient?source=email#accept");
    await submitCode();
    expect(destination).toBe("/auth/landing?next=%2Fcoaching%2Finvite%2Frecipient%3Fsource%3Demail%23accept");
  });

  it.each([null, "https://other.example/admin", "/\\other.example/admin", "/login?next=/admin", "/auth/callback?code=already-used"])("uses role-aware defaults for absent, unsafe, or looping continuation %s", async (next) => {
    await mount(next);
    await submitCode();
    expect(destination).toBe("/auth/landing");
  });

  it("keeps the deletion flow as explicit context for the resolver", async () => {
    await mount(null, "/delete-account");
    await submitCode();
    expect(destination).toBe("/auth/landing?next=%2Fdelete-account");
  });

  it("retains the sign-in form and shows an invalid-code error without navigation", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Token has expired or is invalid" } });
    await mount("/admin");
    await submitCode();
    expect(destination).toBeUndefined();
    expect(document.body.textContent).toMatch(/code.*expired.*try again/i);
    expect(document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!.form!.querySelector("button")!.disabled).toBe(false);
  });
});

describe("magic link request", () => {
  it("sends only existing-account sign-in with consumed CAPTCHA and exact invitation context", async () => {
    await mount("/coaching/invite/recipient?source=email#accept");
    await requestEmail();
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "coach@kamee.fit",
      options: {
        shouldCreateUser: false,
        captchaToken: "verified-captcha-token",
        emailRedirectTo: "https://kamee.fit/auth/callback?next=%2Fcoaching%2Finvite%2Frecipient%3Fsource%3Demail%23accept",
      },
    });
    expect(document.body.textContent).toContain("Check your inbox");
  });

  it("lets the callback resolve the account's default destination when no context was requested", async () => {
    await mount(null);
    await requestEmail();
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "coach@kamee.fit",
      options: {
        shouldCreateUser: false,
        captchaToken: "verified-captcha-token",
        emailRedirectTo: "https://kamee.fit/auth/callback",
      },
    });
  });
});
