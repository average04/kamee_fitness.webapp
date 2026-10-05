import { buildStoreUrl, readUtm } from "@/lib/landing/attribution";
import { SITE_URL } from "@/lib/public-plans";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
  Vary: "User-Agent",
  "X-Robots-Tag": "noindex, nofollow",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scriptValue(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Public ad destination; no sign-in or app-install tracking is required. */
export function GET(request: Request): Response {
  const search = new URL(request.url).search;
  const ua = request.headers.get("user-agent") ?? "";
  const home = new URL("/", SITE_URL);
  home.search = new URLSearchParams(readUtm(search)).toString();

  let target = home.toString();
  if (/Android/i.test(ua)) target = buildStoreUrl("android", search);
  else if (/iPhone|iPad|iPod/i.test(ua)) target = buildStoreUrl("ios", search);
  else if (/Macintosh/i.test(ua)) {
    // iPad Safari's desktop mode has the same UA as a Mac. Only the browser
    // can distinguish these using touch points, so resolve before navigating.
    const ios = buildStoreUrl("ios", search);
    const android = buildStoreUrl("android", search);
    return new Response(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Download Kamee Fitness</title>
<style>body{margin:0;background:#0e1417;color:#edf2ee;font:18px system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}main{max-width:28rem;padding:32px}h1{font-size:30px}p{line-height:1.5;color:#c6d2cd}a{display:block;margin-top:16px;color:#93caa5}</style>
</head><body><main>
<h1>Download Kamee Fitness</h1>
<p>Opening your download page. You can also choose a store below.</p>
<a href="${escapeHtml(ios)}">Download on the App Store</a>
<a href="${escapeHtml(android)}">Get it on Google Play</a>
<a href="${escapeHtml(home.toString())}">Visit kamee.fit</a>
</main><script>
location.replace(navigator.maxTouchPoints > 1 ? ${scriptValue(ios)} : ${scriptValue(home.toString())});
</script></body></html>`, {
      headers: { ...RESPONSE_HEADERS, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(null, {
    status: 302,
    headers: { ...RESPONSE_HEADERS, Location: target },
  });
}
