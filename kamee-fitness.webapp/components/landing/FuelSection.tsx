const POINTS = [
  { title: "Snap it. Describe it. Save it.", body: "Take a meal photo, upload one from your library, or tell Kamy what you ate. Review the estimated calories and macros before they reach your journal." },
  { title: "Your portions, your call.", body: "Adjust grams, cups, or pieces and remove items from the estimate. Edit a saved meal’s portions later and its totals update with it." },
  { title: "Eat to the Plan.", body: "Food guidance follows your training week, from strength and rest days to the meal before a long run. Set your own daily targets if you want them." },
];

const MACROS = [
  { name: "Protein", value: "38 g", width: "29%", color: "bg-leaf-500" },
  { name: "Carbs", value: "65 g", width: "50%", color: "bg-fuel-500" },
  { name: "Fat", value: "12 g", width: "21%", color: "bg-teal-500" },
];

export default function FuelSection() {
  return (
    <section id="fuel" aria-labelledby="fuel-heading" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.3em] text-fuel-500">Fuel log</p>
        <span className="rounded-full border border-fuel-500/25 bg-fuel-900 px-3 py-1 text-xs font-semibold text-fuel-100">Kamee Premium</span>
      </div>
      <h2 id="fuel-heading" className="mt-3 font-display text-[clamp(1.75rem,5vw,2.875rem)] font-extrabold uppercase leading-[1.02] tracking-tight text-mist">
        Fuel the work you put in.
      </h2>
      <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-mist/75">
        Give your meals a place alongside your training. A daily food journal,
        estimates you can adjust, and meal plans built around the week ahead.
      </p>

      <div className="mt-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <figure className="rounded-3xl border border-fuel-500/20 bg-ink-900 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl font-bold text-mist">Your fuel journal</h3>
            <span className="text-xs font-semibold text-fuel-500">Example day</span>
          </div>
          <div className="mt-5 rounded-xl border border-fuel-500/15 bg-fuel-900/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-fuel-500">Strength day · Protein</p>
            <p className="mt-2 text-sm leading-relaxed text-fuel-100">Eggs, chicken, fish, tofu or beans at every meal.</p>
          </div>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tabular-nums text-mist">520</span>
            <span className="text-sm text-muted">kcal in · est.</span>
          </div>
          <div className="mt-5 space-y-3">
            {MACROS.map((macro) => (
              <div key={macro.name}>
                <div className="mb-1.5 flex justify-between gap-3 text-xs">
                  <span className="text-mist/80">{macro.name}</span>
                  <span className="tabular-nums text-muted">{macro.value} · est.</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8" aria-hidden="true">
                  <div className={`h-full rounded-full ${macro.color}`} style={{ width: macro.width }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-white/8 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Lunch</p>
            <p className="mt-2 font-semibold text-mist">Chicken, rice & vegetables</p>
            <p className="mt-1 text-sm text-muted">520 kcal · est.</p>
          </div>
          <figcaption className="mt-5 text-xs leading-relaxed text-muted">Illustrative journal preview. Nutrition numbers are estimates, and portions stay editable.</figcaption>
        </figure>

        <div>
          <ul className="space-y-6">
            {POINTS.map((point) => (
              <li key={point.title} className="flex gap-3.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-5 shrink-0 text-fuel-500" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
                <p className="text-[0.9375rem] leading-relaxed text-mist/75"><b className="font-semibold text-mist">{point.title}</b> {point.body}</p>
              </li>
            ))}
          </ul>
          <a href="#get-the-app" className="mt-8 inline-flex min-h-11 items-center gap-3 rounded-full bg-ember-500 px-5 py-3 text-sm font-bold text-ink-950 transition-colors hover:bg-ember-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember-400">
            Get Kamee for iOS & Android <span aria-hidden="true">↗</span>
          </a>
          <p className="mt-3 text-xs text-muted">In the app: Record → FUEL · Requires Kamee Premium</p>
        </div>
      </div>
    </section>
  );
}
