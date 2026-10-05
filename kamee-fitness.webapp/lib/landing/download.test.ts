import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { GET } from "../../app/download/route";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0]";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/500.0.0]";

function request(userAgent: string, search = "") {
  return new Request(`https://kamee.fit/download${search}`, {
    headers: { "user-agent": userAgent },
  });
}

describe("download redirect", () => {
  it.each([IPHONE, IPAD])("sends iOS visitors directly to the App Store", (ua) => {
    const response = GET(request(ua));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://apps.apple.com/app/kamee-fitness-658c0e/id6772307537",
    );
  });

  it("sends Android visitors directly to the public Play listing", () => {
    const response = GET(request(ANDROID));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://play.google.com/store/apps/details?id=com.kamee.fitness",
    );
  });

  it("carries the campaign to the App Store", () => {
    const response = GET(request(IPHONE, "?utm_source=facebook&utm_campaign=kamee_2d_v2"));
    const target = new URL(response.headers.get("location")!);
    expect(target.hostname).toBe("apps.apple.com");
    expect(target.searchParams.get("ct")).toBe("kamee_2d_v2");
    expect(target.searchParams.get("mt")).toBe("8");
  });

  it("carries the ad campaign into Play's install referrer", () => {
    const response = GET(request(ANDROID,
      "?utm_source=facebook&utm_medium=paid_social&utm_campaign=kamee_2d_v2&utm_content=30s_video&fbclid=discard",
    ));
    const target = new URL(response.headers.get("location")!);
    expect(target.hostname).toBe("play.google.com");
    expect(target.searchParams.get("referrer")).toBe(
      "utm_source=facebook&utm_medium=paid_social&utm_campaign=kamee_2d_v2&utm_content=30s_video",
    );
    expect(target.searchParams.has("fbclid")).toBe(false);
  });

  it.each(["", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "facebookexternalhit/1.1"])(
    "takes desktop, unknown and preview visitors to the website", (ua) => {
      const response = GET(request(ua, "?utm_source=facebook&redirect=https://evil.example"));
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("https://kamee.fit/?utm_source=facebook");
    },
  );

  it.each([IPHONE, ANDROID, MAC])("never caches a visitor's device-specific response", (ua) => {
    const response = GET(request(ua));
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("netlify-cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toContain("User-Agent");
  });

  it.each([
    { touchPoints: 5, target: "https://apps.apple.com/app/kamee-fitness-658c0e/id6772307537?ct=kamee_2d_v2&mt=8" },
    { touchPoints: 0, target: "https://kamee.fit/?utm_source=facebook&utm_campaign=kamee_2d_v2" },
  ])("distinguishes desktop-mode iPad from an actual Mac", async ({ touchPoints, target }) => {
    const response = GET(request(MAC, "?utm_source=facebook&utm_campaign=kamee_2d_v2"));
    expect(response.status).toBe(200);
    const html = await response.text();
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    let destination = "";
    runInNewContext(script!, {
      navigator: { maxTouchPoints: touchPoints },
      location: { replace: (url: string) => { destination = url; } },
    });
    expect(destination).toBe(target);
  });

  it("keeps manual store links available if automatic navigation is blocked", async () => {
    const html = await GET(request(MAC)).text();
    expect(html).toContain('href="https://apps.apple.com/app/kamee-fitness-658c0e/id6772307537"');
    expect(html).toContain('href="https://play.google.com/store/apps/details?id=com.kamee.fitness"');
    expect(html).toContain('href="https://kamee.fit/"');
  });

  it("does not let campaign text inject HTML or executable script", async () => {
    const search = "?utm_campaign=" + encodeURIComponent('</script><script>globalThis.compromised=true</script>');
    const html = await GET(request(MAC, search)).text();
    let destination = "";
    const context = {
      navigator: { maxTouchPoints: 5 },
      location: { replace: (url: string) => { destination = url; } },
      compromised: false,
    };
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    for (const match of scripts) runInNewContext(match[1], context);
    expect(context.compromised).toBe(false);
    expect(new URL(destination).hostname).toBe("apps.apple.com");
  });
});
