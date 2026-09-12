"use client";
import { useEffect, useRef, useState } from "react";
import { Upload } from "tus-js-client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Video } from "@/lib/coaching/plans";
import { VideoPlayer } from "./PlanPreview";

export function VideoLibrary({
  initial,
  initialIntroId,
}: {
  initial: Video[];
  initialIntroId: string | null;
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
  const upload = useRef<Upload | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [hasUpload, setHasUpload] = useState(false);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const db = createBrowserSupabase();
  useEffect(
    () => () => {
      void upload.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!hasUpload && !busy) return;
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
        !confirm(
          "Leave this upload? You can resume from Videos with the same file.",
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
  }, [hasUpload, busy]);
  async function refresh() {
    const { data, error } = await db
      .from("coaching_videos")
      .select("*")
      .is("retired_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setVideos((data ?? []) as Video[]);
  }
  async function finalize(id: string) {
    setBusy(true);
    setMessage("Validating video…");
    try {
      const { data, error } = await db.functions.invoke(
        "finalize-coaching-video",
        { body: { id } },
      );
      if (error || data?.error)
        throw new Error(
          data?.error ?? "Validation failed. Check the video status and retry.",
        );
      setMessage("Video ready.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setBusy(false);
      await refresh();
    }
  }
  async function begin(existing?: Video) {
    if (!file || (!title.trim() && !existing)) {
      setMessage("Choose a video and add a title.");
      return;
    }
    if (file.type !== "video/mp4" || file.size > 200 * 1024 * 1024) {
      setMessage("Choose an MP4 up to 200 MB.");
      return;
    }
    setBusy(true);
    setPaused(false);
    setMessage("");
    setProgress(0);
    try {
      const { data: session } = await db.auth.getSession();
      if (!session.session) throw new Error("Sign in again.");
      const { data, error } = existing
        ? { data: existing, error: null }
        : await db.rpc("begin_coaching_video", {
            p_title: title.trim(),
            p_caption: caption,
          });
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
          const { data: latest } = await db.auth.getSession();
          if (latest.session)
            request.setHeader(
              "authorization",
              `Bearer ${latest.session.access_token}`,
            );
        },
        onProgress: (sent, total) =>
          setProgress(Math.round((sent / total) * 100)),
        onError: () => {
          setMessage("Upload interrupted. Resume to retry.");
          setBusy(false);
          setPaused(true);
          void refresh();
        },
        onSuccess: () => {
          upload.current = null;
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
      if (previous[0]) tus.resumeFromPreviousUpload(previous[0]);
      tus.start();
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not start upload");
      setBusy(false);
    }
  }
  async function cancelUpload() {
    if (!activeUploadId) return;
    await upload.current?.abort();
    const { error } = await db.rpc("retire_coaching_video", {
      p_video_id: activeUploadId,
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      setPaused(true);
      return;
    }
    upload.current = null;
    setHasUpload(false);
    setActiveUploadId(null);
    setBusy(false);
    setPaused(false);
    setProgress(0);
    setMessage("Upload cancelled.");
    await refresh();
  }
  async function retire(id: string) {
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
    const { error } = await db.rpc("retire_coaching_video", { p_video_id: id });
    if (error) setMessage(error.message);
    else {
      if (introId === id) setIntroId(null);
      await refresh();
    }
  }
  return (
    <div className="plan-stack">
      <section className="coach-panel plan-stack">
        <h2>Add video</h2>
        {introId && (
          <button
            className="plan-secondary"
            onClick={async () => {
              const { error } = await db.rpc("set_coaching_intro_video", {
                p_video_id: null,
              });
              if (error) setMessage(error.message);
              else {
                setIntroId(null);
                setMessage("Profile intro removed.");
              }
            }}
          >
            Remove profile intro
          </button>
        )}
        <p className="coach-panel-description">
          MP4 · H.264 · Up to 10 minutes and 200 MB
        </p>
        <label>
          Title
          <input
            className="coach-input"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Caption
          <input
            className="coach-input"
            value={caption}
            maxLength={200}
            onChange={(e) => setCaption(e.target.value)}
            disabled={busy}
          />
        </label>
        <input
          ref={fileInput}
          aria-label="Choose MP4 video"
          type="file"
          accept="video/mp4"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="plan-order">
          <button
            className="plan-primary"
            disabled={busy || paused}
            onClick={() => begin()}
          >
            Upload video
          </button>
          {hasUpload && (
            <button
              className="plan-secondary"
              onClick={async () => {
                if (paused) {
                  setBusy(true);
                  setPaused(false);
                  upload.current?.start();
                } else {
                  await upload.current?.abort();
                  setBusy(false);
                  setPaused(true);
                }
              }}
            >
              {paused ? "Resume upload" : "Pause upload"}
            </button>
          )}
          {hasUpload && (
            <button className="plan-secondary" onClick={cancelUpload}>
              Cancel upload
            </button>
          )}
        </div>
        {(busy || paused) && (
          <progress aria-label="Upload progress" value={progress} max={100}>
            {progress}%
          </progress>
        )}
        <p role="status">{message}</p>
      </section>
      {videos.map((v) => (
        <article key={v.id} className="coach-panel plan-stack">
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
              className="plan-secondary"
              disabled={busy}
              onClick={() => retire(v.id)}
            >
              Remove
            </button>
          </div>
          {v.caption && <p>{v.caption}</p>}
          {v.failure_reason && <p role="alert">{v.failure_reason}</p>}
          {v.status === "ready" ? (
            <>
              <VideoPlayer id={v.id} />
              <button
                className="plan-secondary"
                onClick={async () => {
                  const { error } = await db.rpc("set_coaching_intro_video", {
                    p_video_id: v.id,
                  });
                  if (!error) setIntroId(v.id);
                  setMessage(error?.message ?? "Profile intro video updated.");
                }}
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
                  className="plan-secondary"
                  disabled={busy || !file}
                  onClick={() => begin(v)}
                >
                  Resume with selected file
                </button>
              )}
              <button
                className="plan-secondary"
                disabled={busy || v.id === activeUploadId}
                onClick={() => finalize(v.id)}
              >
                Retry validation
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
