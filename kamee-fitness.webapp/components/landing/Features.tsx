import { FEATURES, type Feature } from "@/lib/landing/content";
import PhoneFrame from "./PhoneFrame";

const ACCENT: Record<Feature["accent"], string> = {
  leaf: "text-leaf-400",
  teal: "text-teal-500",
};

export default function Features() {
  const rows = FEATURES.slice(0, 4);
  const grid = FEATURES.slice(4);

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-center font-display text-[clamp(1.8rem,4.5vw,2.75rem)] font-extrabold uppercase tracking-tight text-mist">
        What&rsquo;s inside
      </h2>

      <div className="mt-14 space-y-20">
        {rows.map((f, i) => (
          <div
            key={f.key}
            className={
              "grid items-center gap-8 sm:gap-12 lg:grid-cols-2 " +
              (i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : "")
            }
          >
            <div className="mx-auto w-[clamp(180px,46vw,260px)]">
              <PhoneFrame src={f.screenshot} alt={`Kamee Fitness — ${f.title}`} />
            </div>
            <div className="text-center lg:text-left">
              <h3 className={"font-display text-2xl font-bold " + ACCENT[f.accent]}>
                {f.title}
              </h3>
              <p className="mt-3 max-w-md text-balance text-mist/80 lg:max-w-none">
                {f.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-20 grid gap-6 sm:grid-cols-2">
        {grid.map((f) => (
          <div
            key={f.key}
            className="rounded-2xl border border-white/8 bg-white/[0.02] p-6"
          >
            <h3 className={"font-display text-xl font-bold " + ACCENT[f.accent]}>
              {f.title}
            </h3>
            <p className="mt-2 text-mist/75">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
