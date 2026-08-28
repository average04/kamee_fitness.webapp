import Image from "next/image";
import { COACH_POINTS } from "@/lib/landing/content";

function PointIcon({ name }: { name: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "size-6 shrink-0 text-leaf-500 mt-0.5",
    "aria-hidden": true,
  } as const;

  if (name === "debrief") {
    return (
      <svg {...common}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="m9.5 14.5 1.8 1.8 3.4-3.6" />
      </svg>
    );
  }

  if (name === "reports") {
    return (
      <svg {...common}>
        <path d="M4 4v14a2 2 0 0 0 2 2h14" />
        <path d="m8 15 3.2-3.8 2.6 2.2L19 7.5" />
      </svg>
    );
  }

  // "ask" and any future point: a chat bubble.
  return (
    <svg {...common}>
      <path d="M20 12a7.5 7.5 0 0 1-7.5 7.5H8l-4 2.5v-4.2A7.5 7.5 0 0 1 12.5 4.5 7.5 7.5 0 0 1 20 12z" />
      <path d="M9.5 11h6M9.5 14.5h3.5" />
    </svg>
  );
}

export default function CoachSection() {
  return (
    <section
      id="coach"
      className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.3em] text-leaf-400">
        Meet your coach
      </p>
      <h2 className="mt-3 max-w-2xl font-display text-[clamp(1.75rem,5vw,2.875rem)] font-extrabold uppercase leading-[1.02] tracking-tight text-mist">
        A coach in your corner, every day.
      </h2>

      <div className="mt-10 grid items-center gap-10 sm:mt-12 lg:grid-cols-2 lg:gap-14">
        {/* Bullets */}
        <ul className="flex flex-col gap-6">
          {COACH_POINTS.map((p) => (
            <li key={p.key} className="flex gap-4">
              <PointIcon name={p.key} />
              <div>
                <h3 className="font-display text-[1.0625rem] font-bold text-mist">
                  {p.title}
                </h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-mist/70">
                  {p.body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Chat mock — proof first on phones, right-hand column on desktop. */}
        <div className="order-first rounded-3xl border border-white/8 bg-white/[0.02] p-5 sm:p-7 lg:order-last">
          <div className="flex items-center gap-2.5 border-b border-white/8 pb-3.5">
            <Image
              src="/adaptive-icon.png"
              alt=""
              width={26}
              height={26}
              className="size-6.5 rounded-[7px]"
            />
            <span className="text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-leaf-300">
              Kamy Coach
            </span>
            <span className="ml-auto text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
              Today
            </span>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <p className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-white/[0.06] px-4 py-3 text-[0.9375rem] text-mist">
              &ldquo;Should I train or rest today?&rdquo;
            </p>

            <p className="max-w-[92%] self-start rounded-2xl rounded-bl-sm border border-leaf-500/25 bg-leaf-500/[0.12] px-4 py-3 text-[0.9375rem] leading-relaxed text-leaf-300">
              You lifted legs yesterday and your week is ahead of plan. Take an
              easy 20-minute walk &mdash; we hit push day tomorrow.
            </p>

            <div className="flex items-center gap-2.5 self-start rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 shrink-0 text-sun-500"
                aria-hidden
              >
                <path d="M4 4v14a2 2 0 0 0 2 2h14" />
                <path d="m8 15 3.2-3.8 2.6 2.2L19 7.5" />
              </svg>
              <span className="text-[0.8125rem] text-mist/75">
                Weekly report ready &mdash; distance up 12%, keep Tuesday easy.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
