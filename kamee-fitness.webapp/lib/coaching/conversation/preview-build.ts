type PreviewBuildEnvironment = {
  context?: string;
  requested?: string;
  localQa?: string;
  siteUrl?: string;
  supabaseUrl?: string;
};

function bareLoopbackOrigin(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch { return false; }
}

/** Exposure only. Participant authorization remains a fresh server decision. */
export function coachingPreviewBuildExposure(input: PreviewBuildEnvironment): "preview" | "off" {
  if (input.requested !== "true") return "off";
  if (input.context === "deploy-preview") return "preview";
  if (input.context) return "off";
  return input.localQa === "true" && bareLoopbackOrigin(input.siteUrl) && bareLoopbackOrigin(input.supabaseUrl)
    ? "preview" : "off";
}
