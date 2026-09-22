import type { Metadata } from "next";
import { LegalDocLayout } from "@/components/LegalDocLayout";
import { HELP_FAQ } from "@/lib/landing/content";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to the common questions about Kamee Fitness — tracking, syncing, the Fuel Log, Premium billing and your account.",
};

/** Own date, deliberately not the Terms/Privacy LAST_UPDATED. */
const FAQ_UPDATED = "September 23, 2026";

const SECTIONS = HELP_FAQ.map((s) => ({ id: s.id, label: s.label }));

/**
 * The help FAQ the mobile app's Settings → Help → FAQs row opens.
 *
 * Every answer is expanded rather than behind an accordion: someone arriving
 * from the app already has a problem, and making them tap thirteen times to
 * find which answer is theirs is worse than a page they can scan or
 * ctrl-F. The landing page keeps its own accordion for its own shorter,
 * pitch-oriented list.
 */
export default function FaqPage() {
  return (
    <LegalDocLayout title="FAQ" sections={SECTIONS} lastUpdated={FAQ_UPDATED}>
      <p className="text-ink-300 mb-10">
        Short answers to what people ask most. If yours is not here, tap
        Settings → Help → Contact support in the app, or email{" "}
        <a href="mailto:support@kamee.fit" className="text-leaf-400 underline">
          support@kamee.fit
        </a>
        .
      </p>

      {HELP_FAQ.map((section) => (
        <section key={section.id} id={section.id} className="mb-12 scroll-mt-8">
          <h2 className="text-2xl font-bold text-leaf-300 mb-6">
            {section.label}
          </h2>
          <div className="space-y-7">
            {section.items.map((item) => (
              <div key={item.q}>
                <h3 className="font-semibold text-mist mb-2">{item.q}</h3>
                <p className="text-ink-300 leading-relaxed">
                  {item.q === "Is my data private?" ? (
                    <>
                      Yes. See our{" "}
                      <a href="/privacy" className="text-leaf-400 underline">
                        Privacy Policy
                      </a>{" "}
                      for exactly what we store and why.
                    </>
                  ) : (
                    item.a
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </LegalDocLayout>
  );
}
