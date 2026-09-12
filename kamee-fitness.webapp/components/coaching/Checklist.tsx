import { CHECKLIST_KEYS, MISSING_LABELS } from "@/lib/coaching/profile";

// The explicit required-item list (credentials are optional). "profile" is a
// parent/meta key the RPC returns when the row itself is missing -- handled
// below as "everything is missing", never rendered as its own row.
const KEYS: readonly string[] = CHECKLIST_KEYS;

export function Checklist({ missing }: { missing: string[] }) {
  const missingSet = new Set(missing);
  // The RPC's `profile` key is a parent/meta flag (the row itself is
  // missing or unreadable), not one of the listed items. Treat it as
  // "everything is missing" rather than letting the absence of the other 6
  // literal keys read as "7 of 7 complete".
  const allMissing = missingSet.has("profile");
  const doneCount = allMissing ? 0 : KEYS.filter((k) => !missingSet.has(k)).length;

  return (
    <div className="coach-panel coach-checklist">
      <h2>Checklist</h2>
      <p className="coach-panel-description">{doneCount} of {KEYS.length} complete</p>
      <div className="coach-progress" role="progressbar" aria-label="Profile completion" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={KEYS.length}><div style={{ width: `${doneCount / KEYS.length * 100}%` }} /></div>
      <ul className="mt-3 space-y-2">
        {KEYS.map((key) => {
          const done = !allMissing && !missingSet.has(key);
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              {done ? <CheckIcon /> : <CircleIcon />}
              <span className={done ? "text-muted line-through" : "text-mist"}>
                {MISSING_LABELS[key]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 shrink-0 text-leaf-500"
      aria-hidden="true"
    >
      <path
        d="M4 10.5l3.5 3.5L16 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 shrink-0 text-muted"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
