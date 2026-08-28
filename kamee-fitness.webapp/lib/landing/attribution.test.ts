import { describe, expect, it, vi } from "vitest";
import { buildStoreUrl, readUtm, trackStoreClick } from "./attribution";
import { APP_STORE_URL, PLAY_STORE_URL } from "./stores";

describe("readUtm", () => {
  it("keeps only utm params, dropping everything else", () => {
    expect(readUtm("?utm_source=meta&gclid=abc&utm_campaign=spring")).toEqual({
      utm_source: "meta",
      utm_campaign: "spring",
    });
  });

  it("ignores empty values and a bare query string", () => {
    expect(readUtm("?utm_source=")).toEqual({});
    expect(readUtm("")).toEqual({});
  });
});

describe("buildStoreUrl", () => {
  it("returns the plain listing when there is no campaign", () => {
    expect(buildStoreUrl("android", "")).toBe(PLAY_STORE_URL);
    expect(buildStoreUrl("ios", "?gclid=abc")).toBe(APP_STORE_URL);
  });

  it("packs the utm params into Play's referrer value", () => {
    const url = new URL(
      buildStoreUrl("android", "?utm_source=meta&utm_medium=cpc"),
    );
    expect(url.searchParams.get("id")).toBe("com.kamee.fitness");
    const referrer = new URLSearchParams(
      url.searchParams.get("referrer") ?? "",
    );
    expect(referrer.get("utm_source")).toBe("meta");
    expect(referrer.get("utm_medium")).toBe("cpc");
  });

  it("maps the campaign onto Apple's ct token", () => {
    const url = new URL(
      buildStoreUrl("ios", "?utm_source=meta&utm_campaign=spring"),
    );
    expect(url.searchParams.get("ct")).toBe("spring");
    expect(url.searchParams.get("mt")).toBe("8");
  });

  it("falls back to utm_source when no campaign is given", () => {
    const url = new URL(buildStoreUrl("ios", "?utm_source=meta"));
    expect(url.searchParams.get("ct")).toBe("meta");
  });

  it("truncates an over-long campaign token", () => {
    const url = new URL(buildStoreUrl("ios", `?utm_campaign=${"x".repeat(80)}`));
    expect(url.searchParams.get("ct")).toHaveLength(40);
  });
});

describe("trackStoreClick", () => {
  it("reports through gtag and plausible when present", () => {
    const gtag = vi.fn();
    const plausible = vi.fn();
    trackStoreClick("android", "hero", { gtag, plausible });
    expect(gtag).toHaveBeenCalledWith("event", "store_click", {
      platform: "android",
      placement: "hero",
    });
    expect(plausible).toHaveBeenCalledWith("Store click", {
      props: { platform: "android", placement: "hero" },
    });
  });

  it("falls back to dataLayer only when gtag is absent", () => {
    const dataLayer: unknown[] = [];
    trackStoreClick("ios", "closing", { dataLayer });
    expect(dataLayer).toEqual([
      { event: "store_click", platform: "ios", placement: "closing" },
    ]);

    const withGtag: unknown[] = [];
    trackStoreClick("ios", "closing", { gtag: vi.fn(), dataLayer: withGtag });
    expect(withGtag).toEqual([]);
  });

  it("is a no-op with no tag installed, and swallows tag errors", () => {
    expect(() => trackStoreClick("ios", "hero", {})).not.toThrow();
    expect(() =>
      trackStoreClick("ios", "hero", {
        gtag: () => {
          throw new Error("tag blew up");
        },
      }),
    ).not.toThrow();
  });
});
