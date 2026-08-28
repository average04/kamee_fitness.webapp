import { PLAN_NAMES } from "@/lib/landing/content";

type SessionTone = "ember" | "teal" | "leaf";

interface WeekDay {
  key: string;
  label: string;
  session?: { title: string; time: string; tone: SessionTone };
  rest?: boolean;
}

const WEEK: WeekDay[] = [
  { key: "mon", label: "MON" },
  { key: "tue", label: "TUE", session: { title: "Push day", time: "7:00", tone: "ember" } },
  { key: "wed", label: "WED" },
  { key: "thu", label: "THU", session: { title: "Easy run", time: "6:30", tone: "teal" } },
  { key: "fri", label: "FRI" },
  { key: "sat", label: "SAT", session: { title: "Long run", time: "8:00", tone: "leaf" } },
  { key: "sun", label: "SUN", rest: true },
];

const CELL_TONE: Record<SessionTone, string> = {
  ember: "border-ember-500/40 bg-ember-500/[0.12]",
  teal: "border-teal-500/40 bg-teal-500/[0.12]",
  leaf: "border-leaf-500/45 bg-leaf-500/[0.12]",
};

const TITLE_TONE: Record<SessionTone, string> = {
  ember: "text-ember-400",
  teal: "text-teal-500",
  leaf: "text-leaf-300",
};

export default function PlansSection() {
  return (
    <section
      id="plans"
      className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
        <div>
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.3em] text-ember-500">
            Plans &amp; schedule
          </p>
          <h2 className="mt-4 font-display text-[clamp(1.75rem,5vw,2.875rem)] font-extrabold uppercase leading-[1.02] tracking-tight text-mist">
            From Couch to 5K to half marathon.
          </h2>
          <p className="mt-5 text-[0.9375rem] leading-relaxed text-mist/75 sm:text-base">
            Answer a few questions and the wizard hands you the right plan for
            your level and gear — or build your own from scratch with the custom
            plan builder.
          </p>

          <ul className="mt-7 flex flex-wrap gap-2.5">
            {PLAN_NAMES.map((name) => (
              <li
                key={name}
                className="inline-flex min-h-11 items-center rounded-full border border-leaf-500/30 bg-leaf-500/[0.08] px-4 text-[0.875rem] font-semibold text-leaf-300"
              >
                {name}
              </li>
            ))}
            <li className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-mist/35 px-4 text-[0.875rem] font-semibold text-mist">
              <svg
                className="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                stroke="currentColor"
                fill="none"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Build your own
            </li>
          </ul>

          <div className="mt-8 flex gap-3.5">
            <svg
              className="mt-0.5 size-5 shrink-0 text-ember-500"
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <p className="text-[0.9375rem] leading-relaxed text-mist/75">
              <b className="font-semibold text-mist">
                Missed a session? It heals itself.
              </b>{" "}
              Your plan reshuffles around real life — no guilt spiral, no broken
              week.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-leaf-300">
              This week
            </p>
            <p className="flex items-center gap-2 text-[0.75rem] font-semibold text-muted">
              <svg
                className="size-4 shrink-0 text-sun-500"
                viewBox="0 0 24 24"
                stroke="currentColor"
                fill="none"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4" />
                <path d="M8 2v4" />
                <path d="M3 10h18" />
              </svg>
              Synced to your calendar
            </p>
          </div>

          {/* The 7-column week never widens the page: it scrolls inside here. */}
          <div className="-mx-1 mt-5 overflow-x-auto px-1 pb-1">
            <div className="grid min-w-[14.5rem] grid-cols-7 gap-1.5 sm:gap-2">
              {WEEK.map((day) => (
                <p
                  key={`label-${day.key}`}
                  className="text-center text-[0.625rem] font-bold tracking-[0.1em] text-muted sm:text-[0.6875rem]"
                >
                  {day.label}
                </p>
              ))}

              {WEEK.map((day) => {
                if (day.session) {
                  return (
                    <div
                      key={day.key}
                      className={
                        "flex h-24 flex-col justify-end rounded-xl border p-1 sm:h-28 sm:p-1.5 " +
                        CELL_TONE[day.session.tone]
                      }
                    >
                      <p
                        className={
                          "break-words text-[0.5625rem] font-bold leading-tight sm:text-[0.6875rem] " +
                          TITLE_TONE[day.session.tone]
                        }
                      >
                        {day.session.title}
                      </p>
                      <p className="text-[0.5rem] leading-tight text-muted sm:text-[0.625rem]">
                        {day.session.time}
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={day.key}
                    className="flex h-24 items-center justify-center rounded-xl border border-white/6 bg-white/[0.015] p-1 sm:h-28 sm:p-1.5"
                  >
                    {day.rest ? (
                      <span className="text-[0.5625rem] font-bold uppercase tracking-[0.08em] text-muted sm:text-[0.6875rem]">
                        Rest
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2.5">
            <svg
              className="mt-0.5 size-4 shrink-0 text-muted"
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 16l-4 4-4-4" />
              <path d="M17 20V4" />
              <path d="M3 8l4-4 4 4" />
              <path d="M7 4v16" />
            </svg>
            <p className="text-[0.8125rem] leading-relaxed text-mist/70">
              Drag any session to another day — even across weeks.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
