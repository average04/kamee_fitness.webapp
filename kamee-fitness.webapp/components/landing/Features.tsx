import Image from "next/image";
import { FEATURES, type Feature } from "@/lib/landing/content";
import PhoneFrame from "./PhoneFrame";

const ACCENT: Record<Feature["accent"], string> = {
  leaf: "text-leaf-400",
  teal: "text-teal-500",
};

export default function Features() {
  const rows = FEATURES.filter((f) => f.screenshot);
  const cards = FEATURES.filter((f) => !f.screenshot);

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-center font-display text-[clamp(1.8rem,4.5vw,2.75rem)] font-extrabold uppercase tracking-tight text-mist">
        What&rsquo;s inside
      </h2>

      <div className="mt-14 space-y-20 sm:space-y-24">
        {rows.map((f, i) => (
          <div
            key={f.key}
            className={
              "grid items-center gap-8 sm:gap-12 lg:grid-cols-2 " +
              (i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : "")
            }
          >
            <div className="mx-auto w-[clamp(190px,46vw,270px)]">
              <PhoneFrame src={f.screenshot} alt={`Kamee Fitness — ${f.title}`} />
            </div>
            <div className="text-center lg:text-left">
              <h3 className={"font-display text-2xl font-bold " + ACCENT[f.accent]}>
                {f.title}
              </h3>
              <p className="mt-3 max-w-md text-balance text-lg text-mist/80 lg:max-w-none">
                {f.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {cards.map((f) => (
        <div
          key={f.key}
          className="mx-auto mt-20 flex max-w-2xl flex-col items-center gap-5 rounded-3xl border border-white/8 bg-white/[0.02] p-8 text-center sm:flex-row sm:gap-7 sm:p-10 sm:text-left"
        >
          <Image
            src="/adaptive-icon.png"
            alt=""
            width={88}
            height={88}
            className="size-20 shrink-0 drop-shadow-[0_0_24px_rgba(125,190,141,0.3)]"
          />
          <div>
            <h3 className={"font-display text-2xl font-bold " + ACCENT[f.accent]}>
              {f.title}
            </h3>
            <p className="mt-2 text-lg text-mist/80">{f.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
