import type { Metadata } from "next";
import Terms from "@/content/legal/terms.mdx";
import { LegalDocLayout } from "@/components/LegalDocLayout";

export const metadata: Metadata = {
  title: "Terms of Service — Kamee Fitness",
  description: "The terms that govern your use of Kamee Fitness.",
};

// IDs must match slugifyHeading() in mdx-components.tsx — strip the leading
// "N. " from each heading, lowercase, replace non-alphanum with dashes.
const SECTIONS = [
  { id: "acceptance-changes", label: "1. Acceptance & changes" },
  { id: "eligibility", label: "2. Eligibility" },
  { id: "your-account-security", label: "3. Your account & security" },
  { id: "the-service", label: "4. The Service" },
  { id: "health-fitness-disclaimer", label: "5. Health & fitness disclaimer" },
  { id: "acceptable-use", label: "6. Acceptable use" },
  { id: "buddy-features", label: "7. Buddy features" },
  { id: "subscriptions-billing-and-refunds", label: "8. Subscriptions & billing" },
  { id: "your-content", label: "9. Your content" },
  { id: "intellectual-property", label: "10. Intellectual property" },
  { id: "third-party-services", label: "11. Third-party services" },
  { id: "disclaimers", label: "12. Disclaimers" },
  { id: "limitation-of-liability", label: "13. Limitation of liability" },
  { id: "indemnification", label: "14. Indemnification" },
  { id: "termination", label: "15. Termination" },
  { id: "governing-law-dispute-resolution", label: "16. Governing law" },
  { id: "miscellaneous", label: "17. Miscellaneous" },
  { id: "contact", label: "18. Contact" },
];

export default function TermsPage() {
  return (
    <LegalDocLayout title="Terms of Service" sections={SECTIONS}>
      <Terms />
    </LegalDocLayout>
  );
}
