import { MISSING_LABELS } from "@/lib/coaching/profile";

const KEYS = Object.keys(MISSING_LABELS);

export function Checklist({ missing }: { missing: string[] }) {
  const missingSet = new Set(missing);
  const doneCount = KEYS.filter((k) => !missingSet.has(k)).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-sm font-semibold text-mist">
        {doneCount} of {KEYS.length} complete
      </h2>
      <ul className="mt-3 space-y-2">
        {KEYS.map((key) => {
          const done = !missingSet.has(key);
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
