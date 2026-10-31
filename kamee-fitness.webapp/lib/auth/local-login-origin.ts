/** The bare localhost origin explicitly selected for this development server. */
export function configuredLocalLoginOrigin(mode: string | undefined, configuredOrigin: string | undefined): URL | null {
  if (mode !== "development" || !configuredOrigin) return null;
  try {
    const target = new URL(configuredOrigin);
    return target.hostname === "localhost" && !target.username && !target.password &&
      ["http:", "https:"].includes(target.protocol) && target.pathname === "/" && !target.search && !target.hash ? target : null;
  } catch {
    return null;
  }
}

/** Opt-in development alias for the local hostname permitted by CAPTCHA. */
export function localLoginOriginRedirect(
  requestUrl: string,
  method: string,
  mode: string | undefined,
  configuredOrigin: string | undefined,
): URL | null {
  const target = configuredLocalLoginOrigin(mode, configuredOrigin);
  if (!target || !["GET", "HEAD"].includes(method)) return null;
  try {
    const request = new URL(requestUrl);
    if (
      request.hostname !== "127.0.0.1" || request.username || request.password ||
      target.protocol !== request.protocol || target.port !== request.port
    ) return null;
    const path = request.pathname;
    if ((path !== "/login" && path !== "/coaching" && !path.startsWith("/coaching/")) || /\.[a-z\d]+$/i.test(path)) return null;
    request.hostname = target.hostname;
    return request;
  } catch {
    return null;
  }
}
