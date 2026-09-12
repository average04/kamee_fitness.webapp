import type { Metadata } from "next";
import CoachTerms from "@/content/legal/coach-terms.mdx";
import { LegalDocLayout } from "@/components/LegalDocLayout";
import {
  COACH_TERMS_DRAFT,
  COACH_TERMS_LAST_UPDATED,
  COACH_TERMS_VERSION,
} from "@/lib/legal-version";

// Public (no coach session needed) so invited coaches can read the terms
// before accepting. /coaching is disallowed in robots.ts, and the page is
// noindex as well.
export const metadata: Metadata = {
  title: "Coach Terms",
  description: "The terms for coaches in the Kamee Coaching Hub.",
  robots: { index: false, follow: false },
};

// IDs must match slugifyHeading() in mdx-components.tsx.
const SECTIONS = [
  { id: "about-these-coach-terms", label: "1. About these terms" },
  { id: "eligibility-invitation", label: "2. Eligibility & invitation" },
  { id: "your-coach-profile", label: "3. Your coach profile" },
  { id: "credentials-documents-verification", label: "4. Credentials & documents" },
  { id: "review-approval-changes", label: "5. Review & approval" },
  { id: "how-you-coach", label: "6. How you coach" },
  { id: "your-content-the-licence-you-give-us", label: "7. Your content" },
  { id: "our-relationship", label: "8. Our relationship" },
  { id: "paid-plans-payments", label: "9. Paid plans" },
  { id: "suspension-removal-leaving", label: "10. Suspension & leaving" },
  { id: "privacy", label: "11. Privacy" },
  { id: "liability", label: "12. Liability" },
  { id: "changes-versions", label: "13. Changes & versions" },
  { id: "contact", label: "14. Contact" },
];

export default function CoachTermsPage() {
  return (
    <LegalDocLayout
      title="Coach Terms"
      sections={SECTIONS}
      lastUpdated={COACH_TERMS_LAST_UPDATED}
      subtitle={`Version ${COACH_TERMS_VERSION}`}
      notice={
        COACH_TERMS_DRAFT ? (
          <p
            role="note"
            className="mt-4 rounded-lg border border-ember-600/40 bg-ember-600/10 px-4 py-3 text-sm text-ember-400"
          >
            Draft for review. These Coach Terms are not in effect and cannot be accepted yet.
          </p>
        ) : null
      }
    >
      <CoachTerms />
    </LegalDocLayout>
  );
}
