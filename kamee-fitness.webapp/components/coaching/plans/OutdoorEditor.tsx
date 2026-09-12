"use client";
import { useState } from "react";
import type { Cardio } from "@/lib/coaching/plans";
import {
  buildRunDayCardio,
  parseRunDayCardio,
  type RunDayKind,
  type RunDayParams,
} from "@/lib/coaching/outdoor/runDayForm";
import {
  sessionTotalSeconds,
  type SegmentLeaf,
} from "@/lib/coaching/outdoor/segments";
import { Field, Select } from "./Fields";

const labels: Record<RunDayKind, string> = {
  easy: "Easy run",
  long: "Long run",
  run_walk: "Run / walk",
  intervals: "Run intervals",
  tempo: "Tempo",
  strides: "Strides",
  time_trial: "Run time trial",
  easy_walk: "Easy walk",
  brisk_walk: "Brisk walk",
  long_walk: "Long walk",
  walk_intervals: "Walk intervals",
  time_trial_walk: "Walk time trial",
};
export function OutdoorEditor({
  value,
  onChange,
}: {
  value: Cardio | null;
  onChange: (v: Cardio | null) => void;
}) {
  const parsed = value
    ? parseRunDayCardio({
        sessionType: value.session_type,
        segments: value.segments,
      })
    : null;
  const [kind, setKind] = useState<RunDayKind>(parsed?.kind ?? "easy");
  const [minutes, setMinutes] = useState(
    parsed && "minutes" in parsed
      ? parsed.minutes
      : parsed && "steadyMin" in parsed
        ? parsed.steadyMin
        : parsed && "baseMin" in parsed
          ? parsed.baseMin
          : 20,
  );
  const [reps, setReps] = useState(
    parsed && "reps" in parsed ? parsed.reps : 6,
  );
  const [work, setWork] = useState(
    parsed && "runSec" in parsed
      ? parsed.runSec
      : parsed && "workSec" in parsed
        ? parsed.workSec
        : parsed && "fastSec" in parsed
          ? parsed.fastSec
          : 60,
  );
  const [recover, setRecover] = useState(
    parsed && "walkSec" in parsed
      ? parsed.walkSec
      : parsed && "recoverSec" in parsed
        ? parsed.recoverSec
        : parsed && "easySec" in parsed
          ? parsed.easySec
          : 90,
  );
  function apply() {
    if (
      value &&
      !confirm(
        "Replace the current session with these settings? Custom segment edits will be removed.",
      )
    )
      return;
    let params: RunDayParams;
    switch (kind) {
      case "run_walk":
        params = { kind, reps, runSec: work, walkSec: recover };
        break;
      case "intervals":
        params = { kind, reps, workSec: work, recoverSec: recover };
        break;
      case "walk_intervals":
        params = { kind, reps, fastSec: work, easySec: recover };
        break;
      case "tempo":
        params = { kind, easyMin: 5, steadyMin: minutes };
        break;
      case "strides":
        params = { kind, baseMin: minutes };
        break;
      default:
        params = { kind, minutes };
    }
    const { cardio } = buildRunDayCardio(params);
    onChange({
      lineage_key: value?.lineage_key ?? crypto.randomUUID(),
      target_kind: cardio.targetKind,
      mode: cardio.mode,
      target_seconds: cardio.targetSeconds,
      guidance_config: cardio.guidanceConfig,
      notes: cardio.notes,
      segments: cardio.segments!,
      session_type: cardio.sessionType,
    });
  }
  function updateLeaf(
    index: number,
    child: number | null,
    patch: Partial<SegmentLeaf>,
  ) {
    if (!value) return;
    const segments = structuredClone(value.segments);
    const segment = segments[index];
    if ("repeat" in segment && child !== null)
      segment.of[child] = { ...segment.of[child], ...patch };
    else if ("role" in segment) segments[index] = { ...segment, ...patch };
    // Custom edits use the structured model; never leave stale legacy cues.
    onChange({
      ...value,
      segments,
      target_seconds: sessionTotalSeconds(segments),
      target_kind: "continuous",
      guidance_config: null,
    });
  }
  const leaf = (s: SegmentLeaf, i: number, child: number | null) => (
    <div className="plan-grid" key={`${i}-${child}`}>
      <Select
        label={s.role}
        value={s.mode}
        onChange={(v) =>
          updateLeaf(i, child, { mode: v as SegmentLeaf["mode"] })
        }
      >
        <option value="run">Run</option>
        <option value="walk">Walk</option>
      </Select>
      <Field
        label="Seconds"
        type="number"
        min={1}
        max={21600}
        value={s.seconds}
        onChange={(v) => updateLeaf(i, child, { seconds: Number(v) })}
      />
      <Select
        label="Effort"
        value={s.effort}
        onChange={(v) =>
          updateLeaf(i, child, { effort: v as SegmentLeaf["effort"] })
        }
      >
        {["easy", "steady", "hard"].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </Select>
      <Field
        label="Cue (optional)"
        value={s.cue ?? ""}
        onChange={(v) => updateLeaf(i, child, { cue: v })}
      />
    </div>
  );
  return (
    <section className="plan-stack">
      <h3>Run / walk session</h3>
      <div className="plan-grid">
        <Select
          label="Session"
          value={kind}
          onChange={(v) => setKind(v as RunDayKind)}
        >
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        {["run_walk", "intervals", "walk_intervals"].includes(kind) ? (
          <>
            <Field
              label="Repetitions"
              type="number"
              min={1}
              max={100}
              value={reps}
              onChange={(v) => setReps(Number(v))}
            />
            <Field
              label="Work seconds"
              type="number"
              min={1}
              max={3600}
              value={work}
              onChange={(v) => setWork(Number(v))}
            />
            <Field
              label="Recovery seconds"
              type="number"
              min={1}
              max={3600}
              value={recover}
              onChange={(v) => setRecover(Number(v))}
            />
          </>
        ) : (
          <Field
            label={kind === "tempo" ? "Steady minutes" : "Work minutes"}
            type="number"
            min={1}
            max={360}
            value={minutes}
            onChange={(v) => setMinutes(Number(v))}
          />
        )}
      </div>
      <button type="button" className="plan-secondary" onClick={apply}>
        {value ? "Replace session" : "Add session"}
      </button>
      {value && (
        <button
          type="button"
          className="plan-secondary"
          onClick={() => {
            if (confirm("Remove this run / walk session?")) onChange(null);
          }}
        >
          Remove session
        </button>
      )}
      {value && (
        <>
          <p className="coach-panel-description">
            {Math.round((value.target_seconds ?? 0) / 60)} minutes including
            warm-up and cooldown
          </p>
          {value.segments.map((s, i) =>
            "repeat" in s ? (
              <div key={i} className="plan-stack">
                <Field
                  label="Repeat"
                  type="number"
                  min={1}
                  max={100}
                  value={s.repeat}
                  onChange={(v) => {
                    const segments = structuredClone(value.segments);
                    (segments[i] as { repeat: number }).repeat = Number(v);
                    onChange({
                      ...value,
                      segments,
                      target_seconds: sessionTotalSeconds(segments),
                      target_kind: "continuous",
                      guidance_config: null,
                    });
                  }}
                />
                {s.of.map((l, j) => leaf(l, i, j))}
              </div>
            ) : (
              leaf(s, i, null)
            ),
          )}
          <Field
            label="Session notes"
            multiline
            value={value.notes}
            onChange={(notes) => onChange({ ...value, notes })}
          />
        </>
      )}
    </section>
  );
}
