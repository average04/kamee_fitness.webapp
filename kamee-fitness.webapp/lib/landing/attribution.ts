import { APP_STORE_URL, PLAY_STORE_URL } from "./stores";

export type StorePlatform = "ios" | "android";

/** Campaign params we forward from the ad click through to the store. */
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/** Picks the utm_* params out of a query string, preserving UTM_KEYS order. */
export function readUtm(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/**
 * Store URL carrying the ad campaign, so installs attribute back to it.
 *
 * Play takes a single `referrer` value holding an encoded query string (the
 * Install Referrer API hands it to the app verbatim). Apple has no equivalent,
 * only the `ct` campaign token, so the campaign name goes there.
 */
export function buildStoreUrl(
  platform: StorePlatform,
  search: string,
): string {
  const utm = readUtm(search);
  const base = platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
  if (Object.keys(utm).length === 0) return base;

  const url = new URL(base);
  if (platform === "android") {
    const referrer = new URLSearchParams(utm).toString();
    url.searchParams.set("referrer", referrer);
  } else {
    const campaign = utm.utm_campaign ?? utm.utm_source;
    if (!campaign) return base;
    url.searchParams.set("ct", campaign.slice(0, 40));
    url.searchParams.set("mt", "8");
  }
  return url.toString();
}

type Tracker = {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  plausible?: (event: string, opts?: { props?: Record<string, string> }) => void;
};

/**
 * Reports a store-button click to whichever analytics tag is on the page.
 * Every target is optional: with no tag installed this is a no-op, so the
 * markup never depends on an analytics script having loaded.
 */
export function trackStoreClick(
  platform: StorePlatform,
  placement: string,
  win: Tracker = typeof window === "undefined" ? {} : (window as Tracker),
): void {
  const props = { platform, placement };
  try {
    win.gtag?.("event", "store_click", props);
    win.plausible?.("Store click", { props });
    if (!win.gtag && Array.isArray(win.dataLayer)) {
      win.dataLayer.push({ event: "store_click", ...props });
    }
  } catch {
    // Analytics must never break the download link.
  }
}
