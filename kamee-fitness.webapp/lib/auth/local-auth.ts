/** The local Supabase stack has CAPTCHA disabled. Never skip it for hosted auth. */
export function isLocalDevelopmentAuth(mode: string | undefined, pageOrigin: string, apiUrl: string | undefined): boolean {
  if (mode !== "development" || !apiUrl) return false;
  try {
    const local = (value: string) => {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    };
    return local(pageOrigin) && local(apiUrl);
  } catch { return false; }
}
