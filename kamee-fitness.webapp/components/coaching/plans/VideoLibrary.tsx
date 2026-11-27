"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Upload } from "tus-js-client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Video } from "@/lib/coaching/plans";
import { VideoPlayer } from "./PlanPreview";
import { subscribeAuthBoundary } from "@/lib/auth-boundary";
import { setIntroductionVideo } from "@/app/coaching/(hub)/profile/introduction-actions";

export function VideoLibrary({
  initial,
  initialIntroId,
  mode = "library",
  ownerId,
}: {
  initial: Video[];
  initialIntroId: string | null;
  mode?: "library" | "introduction";
  ownerId?: string;
}) {
  const [introId, setIntroId] = useState(initialIntroId);
  const [videos, setVideos] = useState(initial);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [messageError, setMessageError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [candidateId, setCandidateId] = useState("");
  const [retired, setRetired] = useState(false);
  const choiceId = useId();
  // Refs lock same-event duplicate clicks before React commits disabled controls.
  const working = useRef(false);
  const mutation = useRef(false);
  const lifetime = useRef({ active: true, generation: 0 });
  const surface = useRef<HTMLElement | null>(null);
  const upload = useRef<Upload | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [hasUpload, setHasUpload] = useState(false);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [db] = useState(createBrowserSupabase);
  const introduction = mode === "introduction";
  const locked = busy || mutating || hasUpload;
  const controlClass = "min-h-11 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf-500";
  const ready = videos.filter(video => video.status === "ready" && !video.retired_at);
  const current = videos.find(video => video.id === introId);
  const candidate = ready.find(video => video.id === candidateId);
  function setWorking(value: boolean) {
    working.current = value;
    setBusy(value);
  }
  function live(generation: number) {
    return lifetime.current.active && lifetime.current.generation === generation;
  }
  const retirePrivateState = useCallback(() => {
    if (!lifetime.current.active) return;
    lifetime.current.active = false;
    lifetime.current.generation++;
    // Hide synchronously before a sign-out form can submit or another account
    // can render. Async callbacks also fail their captured generation check.
    if (surface.current) surface.current.hidden = true;
    void upload.current?.abort().catch(() => {});
    upload.current = null;
    setVideos([]);
    setIntroId(null);
    setFile(null);
    setTitle("");
    setCaption("");
    setRetired(true);
  }, []);
  useEffect(() => {
    const lifetimeState = lifetime.current;
    lifetimeState.active = true;
    const unsubscribe = subscribeAuthBoundary(retirePrivateState);
    const auth = db.auth.onAuthStateChange?.((event, session) => {
      if (event === "SIGNED_OUT" || (ownerId && session && session.user.id !== ownerId) || (ownerId && event === "INITIAL_SESSION" && !session)) retirePrivateState();
    });
    return () => {
      unsubscribe();
      auth?.data.subscription.unsubscribe();
      lifetimeState.active = false;
      lifetimeState.generation++;
      void upload.current?.abort().catch(() => {});
    };
  }, [db, ownerId, retirePrivateState]);
  useEffect(() => {
    if (retired || (!hasUpload && !busy)) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest("a") : null;
      if (
        a &&
        a.target !== "_blank" &&
        a.href !== location.href &&
        // Fragment navigation stays in this document, including the portal's
        // skip link. Route and query changes still leave the upload screen.
        !(a.origin === location.origin &&
          a.pathname === location.pathname &&
          a.search === location.search) &&
        !confirm(
          "Leave this upload? You can resume from Video assets with the same file.",
        )
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    // Navigation API covers browser history where supported; TUS fingerprint
    // remains available to resume if the browser cannot cancel traversal.
    const navigation = (window as Window & { navigation?: EventTarget })
      .navigation;
    const traverse = (e: Event) => {
      if (
        (e as Event & { navigationType?: string }).navigationType ===
          "traverse" &&
        e.cancelable &&
        !confirm("Leave this upload? Resume later with the same file.")
      )
        e.preventDefault();
    };
    navigation?.addEventListener("navigate", traverse);
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", click, true);
      navigation?.removeEventListener("navigate", traverse);
    };
  }, [hasUpload, busy, retired]);
  async function refresh(generation = lifetime.current.generation) {
    if (!live(generation)) return;
    const { data, error } = await db
      .from("coaching_videos")
      .select("*")
      .is("retired_at", null)
      .order("created_at", { ascending: false });
    if (!live(generation)) return;
    if (error) throw error;
    setVideos((data ?? []) as Video[]);
  }
  async function finalize(id: string) {
    const generation = lifetime.current.generation;
    if (!live(generation) || working.current || mutation.current || upload.current) return;
    setWorking(true);
    setMessageError(false);
    setMessage("Validating video…");
    try {
      const { data, error } = await db.functions.invoke(
        "finalize-coaching-video",
        { body: { id } },
      );
      if (!live(generation)) return;
      if (error || data?.error)
        throw new Error(
          data?.error ?? "Validation failed. Check the video status and retry.",
        );
      setMessage("Video ready.");
    } catch (e) {
      if (!live(generation)) return;
      setMessage(e instanceof Error ? e.message : "Validation failed");
    } finally {
      if (live(generation)) {
        try {
          await refresh(generation);
        } catch {
          if (live(generation)) setMessage("Could not refresh videos. Reload to check the latest status.");
        }
        if (live(generation)) setWorking(false);
      }
    }
  }
  async function begin(existing?: Video) {
    const generation = lifetime.current.generation;
    if (!live(generation) || working.current || mutation.current || upload.current) return;
    setMessageError(false);
    if (!file || (!title.trim() && !existing)) {
      setMessage("Choose a video and add a title.");
      return;
    }
    if (file.type !== "video/mp4" || file.size > 50 * 1024 * 1024) {
      setMessage("Choose an MP4 up to 50 MB.");
      return;
    }
    setWorking(true);
    setPaused(false);
    setMessage("");
    setProgress(0);
    try {
      const { data: session } = await db.auth.getSession();
      if (!live(generation)) return;
      if (!session.session) throw new Error("Sign in again.");
      if (ownerId && session.session.user.id !== ownerId) {
        retirePrivateState();
        return;
      }
      const { data, error } = existing
        ? { data: existing, error: null }
        : await db.rpc("begin_coaching_video", {
            p_title: title.trim(),
            p_caption: caption,
          });
      if (!live(generation)) return;
      if (error || !data)
        throw new Error(error?.message ?? "Could not start upload");
      const video = data as Video;
      const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
      if (base.hostname.endsWith(".supabase.co"))
        base.hostname = base.hostname.replace(
          ".supabase.co",
          ".storage.supabase.co",
        );
      const tus = new Upload(file, {
        endpoint: `${base.origin}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: 6 * 1024 * 1024,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
        metadata: {
          bucketName: "coaching-videos",
          objectName: `${session.session.user.id}/${video.id}.mp4`,
          contentType: "video/mp4",
          cacheControl: "3600",
        },
        fingerprint: async (f) =>
          `coaching-video-${video.id}-${f.size}-${file.lastModified}`,
        onBeforeRequest: async (request) => {
          if (!live(generation) || upload.current !== tus || mutation.current) throw new Error("Upload stopped.");
          const { data: latest } = await db.auth.getSession();
          if (!live(generation) || upload.current !== tus || mutation.current) throw new Error("Upload stopped.");
          if (!live(generation) || !latest.session || (ownerId && latest.session.user.id !== ownerId)) {
            retirePrivateState();
            throw new Error("Sign in again.");
          }
          request.setHeader("authorization", `Bearer ${latest.session.access_token}`);
        },
        onProgress: (sent, total) => {
          if (live(generation) && upload.current === tus && !mutation.current) setProgress(Math.round((sent / total) * 100));
        },
        onError: () => {
          if (!live(generation) || upload.current !== tus || mutation.current) return;
          setMessage("Upload interrupted. Resume to retry.");
          setWorking(false);
          setPaused(true);
          void refresh(generation).catch(() => {
            if (live(generation)) setMessage("Upload interrupted. Reload to check its status.");
          });
        },
        onSuccess: () => {
          if (!live(generation) || upload.current !== tus || mutation.current) return;
          upload.current = null;
          setWorking(false);
          setHasUpload(false);
          setActiveUploadId(null);
          setFile(null);
          if (fileInput.current) fileInput.current.value = "";
          setTitle("");
          setCaption("");
          void finalize(video.id);
        },
      });
      upload.current = tus;
      setHasUpload(true);
      setActiveUploadId(video.id);
      const previous = await tus.findPreviousUploads();
      if (!live(generation)) return;
      if (previous[0]) tus.resumeFromPreviousUpload(previous[0]);
      tus.start();
      await refresh(generation);
    } catch (e) {
      if (!live(generation)) return;
      setMessage(e instanceof Error ? e.message : "Could not start upload");
      setWorking(false);
    }
  }
  async function cancelUpload() {
    const generation = lifetime.current.generation;
    if (!live(generation) || !activeUploadId || mutation.current) return;
    mutation.current = true;
    setMutating(true);
    setMessageError(false);
    try {
      await upload.current?.abort();
      if (!live(generation)) return;
      const { error } = await db.rpc("retire_coaching_video", {
        p_video_id: activeUploadId,
      });
      if (!live(generation)) return;
      if (error) throw new Error(error.message);
      upload.current = null;
      setHasUpload(false);
      setActiveUploadId(null);
      setPaused(false);
      setProgress(0);
      setMessage("Upload cancelled.");
      await refresh(generation).catch(() => {
        if (live(generation)) setMessage("Upload cancelled. Reload to check your library.");
      });
    } catch (e) {
      if (!live(generation)) return;
      setMessage(e instanceof Error ? e.message : "Could not cancel upload. Retry.");
      setMessageError(true);
      setPaused(true);
    } finally {
      if (live(generation)) {
        setWorking(false);
        mutation.current = false;
        setMutating(false);
      }
    }
  }
  async function retire(id: string) {
    const generation = lifetime.current.generation;
    if (!live(generation) || working.current || mutation.current || upload.current) return;
    if (
      !confirm(
        "Remove this video from your library? Existing plan versions will keep it.",
      )
    )
      return;
    if (id === activeUploadId) {
      await cancelUpload();
      return;
    }
    mutation.current = true;
    setMutating(true);
    setMessageError(false);
    try {
      const { error } = await db.rpc("retire_coaching_video", { p_video_id: id });
      if (!live(generation)) return;
      if (error) throw new Error(error.message);
      if (introId === id) setIntroId(null);
      await refresh(generation);
    } catch (e) {
      if (!live(generation)) return;
      setMessage(e instanceof Error ? e.message : "Could not remove video. Retry.");
      setMessageError(true);
    } finally {
      if (live(generation)) {
        mutation.current = false;
        setMutating(false);
      }
    }
  }
  async function changeIntro(id: string | null) {
    const generation = lifetime.current.generation;
    if (!live(generation) || working.current || mutation.current || upload.current) return;
    if (!ownerId) {
      setMessage("Reload this page before changing your introduction video.");
      setMessageError(true);
      return;
    }
    mutation.current = true;
    setMutating(true);
    setMessageError(false);
    setMessage("Saving introduction video…");
    try {
      const result = await setIntroductionVideo(ownerId, id);
      if (!live(generation)) return;
      if (!result.ok) throw new Error(result.error);
      setIntroId(id);
      setCandidateId("");
      setExpanded(false);
      setMessage(id ? "Introduction video updated." : "Introduction video removed. The video is still in your library.");
    } catch (e) {
      if (!live(generation)) return;
      setMessage(e instanceof Error ? e.message : "Could not change introduction video. Retry.");
      setMessageError(true);
    } finally {
      if (live(generation)) {
        mutation.current = false;
        setMutating(false);
      }
    }
  }
  if (retired) return <p role="status" className="coach-panel text-sm text-muted">Sign in again to manage your videos.</p>;
  const uploadForm = (
    <div className="plan-stack">
        <p className="coach-panel-description">
          MP4 · H.264 · Up to 10 minutes and 50 MB
        </p>
        <label>
          Title
          <input
            className="coach-input"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            disabled={locked}
          />
        </label>
        <label>
          Caption
          <input
            className="coach-input"
            value={caption}
            maxLength={200}
            onChange={(e) => setCaption(e.target.value)}
            disabled={locked}
          />
        </label>
        <input
          ref={fileInput}
          aria-label="Choose MP4 video"
          type="file"
          accept="video/mp4"
          className={`w-full min-w-0 ${controlClass}`}
          disabled={locked}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="plan-order">
          <button
            type="button"
            className={`plan-primary ${controlClass}`}
            disabled={locked || paused}
            onClick={() => begin()}
          >
            Upload video
          </button>
          {hasUpload && (
            <button
              type="button"
              className={`plan-secondary ${controlClass}`}
              disabled={mutating}
              onClick={async () => {
                const generation = lifetime.current.generation;
                if (!live(generation) || mutation.current) return;
                if (paused) {
                  setWorking(true);
                  setPaused(false);
                  upload.current?.start();
                } else {
                  await upload.current?.abort();
                  if (!live(generation)) return;
                  setWorking(false);
                  setPaused(true);
                }
              }}
            >
              {paused ? "Resume upload" : "Pause upload"}
            </button>
          )}
          {hasUpload && (
            <button type="button" className={`plan-secondary ${controlClass}`} disabled={mutating} onClick={cancelUpload}>
              Cancel upload
            </button>
          )}
        </div>
        {(busy || paused) && (
          <progress aria-label="Upload progress" value={progress} max={100}>
            {progress}%
          </progress>
        )}
    </div>
  );
  const assetCards = videos.filter(video => !video.retired_at && (!introduction || video.status !== "ready")).map((v) => (
        <article key={v.id} className={introduction ? "plan-stack border-t border-white/10 pt-4" : "coach-panel plan-stack"}>
          <div className="plan-card">
            <div>
              <h2>{v.title}</h2>
              <p className="coach-panel-description">
                {v.status}
                {v.duration_seconds
                  ? ` · ${Math.ceil(v.duration_seconds)} sec`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className={`plan-secondary ${controlClass}`}
              disabled={locked}
              onClick={() => retire(v.id)}
            >
              Remove
            </button>
          </div>
          {v.caption && <p>{v.caption}</p>}
          {v.failure_reason && <p role="alert">{v.failure_reason}</p>}
          {v.status === "ready" ? (
            <>
              <VideoPlayer key={v.id} id={v.id} />
              <button
                type="button"
                className={`plan-secondary ${controlClass}`}
                disabled={locked || !ownerId || introId === v.id}
                onClick={() => changeIntro(v.id)}
              >
                {introId === v.id
                  ? "Current profile intro"
                  : "Use as profile intro"}
              </button>
            </>
          ) : (
            <div className="plan-order">
              {v.status === "uploading" && (
                <button
                  type="button"
                  className={`plan-secondary ${controlClass}`}
                  disabled={locked || !file}
                  onClick={() => begin(v)}
                >
                  Resume with selected file
                </button>
              )}
              <button
                type="button"
                className={`plan-secondary ${controlClass}`}
                disabled={locked || v.id === activeUploadId}
                onClick={() => finalize(v.id)}
              >
                Retry validation
              </button>
            </div>
          )}
        </article>
      ));
  const feedback = <p role={messageError ? "alert" : "status"} className={messageError ? "text-sm text-red-400" : "text-sm text-mist"}>{message}</p>;
  if (introduction) return (
    <section ref={element => { surface.current = element; }} className="coach-panel plan-stack [&_button]:min-h-11 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-4 [&_button]:focus-visible:outline-leaf-500" aria-label="Introduction video">
      <div className="flex flex-wrap items-center gap-3">
        <h2>Introduction video</h2>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted">Optional</span>
      </div>
      <p className="coach-panel-description">Help members get to know you and your coaching approach. A short introduction works well.</p>
      {introId ? (
        <div role="group" aria-label="Current introduction video" className="plan-stack">
          <p className="text-sm font-medium text-mist">{current?.title ?? "Your current introduction"}</p>
          <VideoPlayer key={introId} id={introId} />
          <div>
            <button type="button" className={`plan-secondary ${controlClass}`} disabled={locked || !ownerId} onClick={() => changeIntro(null)}>Remove introduction video</button>
          </div>
        </div>
      ) : <p className="text-sm text-muted">No introduction video added yet.</p>}
      <div>
        <button type="button" className={`plan-secondary ${controlClass}`} disabled={locked} aria-expanded={expanded} aria-controls={choiceId} onClick={() => setExpanded(value => !value)}>
          {introId ? "Change introduction video" : "Add introduction video"}
        </button>
      </div>
      {expanded && (
        <div id={choiceId} className="plan-stack border-t border-white/10 pt-5">
          {ready.length > 0 && <><label className="plan-stack text-sm text-mist">
            Choose from your videos
            <select className={`coach-input ${controlClass}`} aria-label="Choose an introduction video" disabled={locked} value={candidateId} onChange={event => setCandidateId(event.target.value)}>
              <option value="">Choose a ready video</option>
              {ready.map(video => <option key={video.id} value={video.id}>{video.title}{video.id === introId ? " (current)" : ""}</option>)}
            </select>
          </label>
          {candidate && <div role="group" aria-label="Selected video preview" className="plan-stack"><VideoPlayer key={candidate.id} id={candidate.id} /></div>}
          <div>
            <button type="button" className={`plan-primary ${controlClass}`} disabled={locked || !ownerId || !candidate || candidate.id === introId} onClick={() => candidate && changeIntro(candidate.id)}>Use as introduction video</button>
          </div></>}
          {ready.length > 0 ? <details className="plan-stack">
            <summary className={`inline-flex cursor-pointer items-center text-sm text-mist ${controlClass}`}>Upload a new video</summary>
            <div className="pt-3">{uploadForm}</div>
          </details> : uploadForm}
          {assetCards}
        </div>
      )}
      {feedback}
    </section>
  );
  return (
    <div ref={element => { surface.current = element; }} className="plan-stack">
      <section className="coach-panel plan-stack">
        <h2>Add video</h2>
        {introId && <button type="button" className={`plan-secondary ${controlClass}`} disabled={locked || !ownerId} onClick={() => changeIntro(null)}>Remove profile intro</button>}
        {uploadForm}
        {feedback}
      </section>
      {assetCards}
    </div>
  );
}
