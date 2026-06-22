"use client";

import { useState } from "react";
import { FAQ } from "@/lib/landing/content";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
      <h2 className="text-center font-display text-[clamp(1.8rem,4.5vw,2.75rem)] font-extrabold uppercase tracking-tight text-mist">
        Questions
      </h2>

      <div className="mt-10 divide-y divide-white/8 border-y border-white/8">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-trigger-${i}`}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left font-display font-semibold text-mist transition-colors hover:text-leaf-300"
                >
                  {item.q}
                  <span
                    className={
                      "shrink-0 text-leaf-400 transition-transform " +
                      (isOpen ? "rotate-45" : "")
                    }
                    aria-hidden
                  >
                    +
                  </span>
                </button>
              </h3>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-trigger-${i}`}
                hidden={!isOpen}
                className="pb-5 text-mist/75"
              >
                {item.q === "Is my data private?" ? (
                  <p>
                    Yes. See our{" "}
                    <a href="/privacy" className="text-leaf-400 underline">
                      Privacy Policy
                    </a>{" "}
                    for exactly what we store and why.
                  </p>
                ) : (
                  <p>{item.a}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
