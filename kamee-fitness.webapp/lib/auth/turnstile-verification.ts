export type VerificationState = { phase: "loading" | "verifying" | "verified" | "error"; message: string };
export type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    theme: "light" | "dark";
    appearance: "always";
    callback: (token: string) => void;
    "error-callback": (code: string) => void;
    "expired-callback": () => void;
    retry: "never";
    "refresh-expired": "manual";
  }) => string;
  remove: (id: string) => void;
};
type Options = { sitekey: string; hostname: string; theme: "light" | "dark"; onChange: (state: VerificationState) => void };

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const LOAD_ERROR = "Verification could not load. Check that challenges.cloudflare.com is not blocked, then retry verification.";

/** A failed script is removed so a deliberate retry can make a fresh request. */
export function loadTurnstile(signal: AbortSignal): Promise<TurnstileApi> {
  if (signal.aborted) return Promise.reject(new DOMException("Verification cancelled", "AbortError"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const isNew = !script;
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
    }
    const element = script;
    const cleanup = () => {
      clearTimeout(timeout);
      element.removeEventListener("load", loaded);
      element.removeEventListener("error", failed);
      signal.removeEventListener("abort", cancelled);
    };
    const failed = () => { cleanup(); element.remove(); reject(new Error(LOAD_ERROR)); };
    const loaded = () => {
      if (!window.turnstile) { failed(); return; }
      cleanup();
      resolve(window.turnstile);
    };
    const cancelled = () => { cleanup(); reject(new DOMException("Verification cancelled", "AbortError")); };
    const timeout = setTimeout(failed, 15_000);
    element.addEventListener("load", loaded);
    element.addEventListener("error", failed);
    signal.addEventListener("abort", cancelled, { once: true });
    if (isNew) document.head.appendChild(element);
  });
}

export function startTurnstileVerification(container: HTMLElement, options: Options, load = loadTurnstile) {
  const abort = new AbortController();
  let token: string | null = null;
  let widgetId: string | null = null;
  let api: TurnstileApi | undefined;
  let failed = false;
  const active = () => !abort.signal.aborted;
  const fail = (message: string) => {
    if (!active()) return;
    failed = true;
    token = null;
    options.onChange({ phase: "error", message });
  };
  options.onChange({ phase: "loading", message: "Loading verification…" });
  void load(abort.signal).then((loaded) => {
    if (!active()) return;
    api = loaded;
    options.onChange({ phase: "verifying", message: "Complete the verification below." });
    widgetId = api.render(container, {
      sitekey: options.sitekey, theme: options.theme, appearance: "always",
      retry: "never", "refresh-expired": "manual",
      callback: (value) => {
        if (!active() || failed) return;
        token = value;
        options.onChange({ phase: "verified", message: "Verification complete." });
      },
      "error-callback": (code) => {
        const safeCode = /^\d{3,6}$/.test(code) ? code : "unknown";
        fail(code === "110200"
          ? `Verification is not authorized for ${options.hostname} (Cloudflare 110200). The site owner needs to allow this hostname; then retry verification.`
          : `Verification failed (Cloudflare ${safeCode}). Retry verification, or try an updated browser with content blockers disabled.`);
      },
      "expired-callback": () => fail("Verification expired. Retry verification before sending your sign-in email."),
    });
  }).catch((error: unknown) => fail(error instanceof Error ? error.message : LOAD_ERROR));
  return {
    consumeToken: () => { const value = active() && !failed ? token : null; token = null; return value; },
    dispose: () => { abort.abort(); token = null; if (widgetId !== null) api?.remove(widgetId); },
  };
}
