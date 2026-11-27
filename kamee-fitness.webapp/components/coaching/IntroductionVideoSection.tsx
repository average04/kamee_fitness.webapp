import type { Video } from "@/lib/coaching/plans";
import type { CoachStatus } from "@/lib/coaching/states";
import { VideoLibrary } from "./plans/VideoLibrary";

export function IntroductionVideoSection({ status, videos, introId, ownerId, inventoryError }: {
  status: CoachStatus;
  videos: Video[];
  introId: string | null;
  ownerId: string;
  inventoryError?: string | null;
}) {
  if (status === "approved" && !inventoryError) return <VideoLibrary key={ownerId} mode="introduction" initial={videos} initialIntroId={introId} ownerId={ownerId} />;
  return (
    <section className="coach-panel space-y-3" aria-label="Introduction video">
      <div className="flex flex-wrap items-center gap-3">
        <h2>Introduction video</h2>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted">Optional</span>
      </div>
      {inventoryError ? <>
        <p role="alert" className="text-sm text-red-400">{inventoryError}</p>
        <p className="coach-panel-description">Wait for your profile changes to finish saving, then reload this page to try again.</p>
      </> : <p className="coach-panel-description">
        {status === "suspended"
          ? "Introduction video changes are paused while your coach profile is suspended."
          : "You can add an introduction video once your coach profile is approved. It is optional for approval."}
      </p>}
    </section>
  );
}
