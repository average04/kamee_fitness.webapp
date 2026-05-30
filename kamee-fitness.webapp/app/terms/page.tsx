import type { Metadata } from "next";
import Terms from "@/content/legal/terms.mdx";
import { LegalDocLayout } from "@/components/LegalDocLayout";

export const metadata: Metadata = {
  title: "Terms of Service — Kamee Fitness",
  description: "The terms that govern your use of Kamee Fitness.",
};

const SECTIONS = [
  { id: "acceptance", label: "1. Acceptance & changes" },
  { id: "eligibility", label: "2. Eligibility" },
  { id: "account", label: "3. Your account" },
  { id: "service", label: "4. The Service" },
  { id: "health-disclaimer", label: "5. Health disclaimer" },
  { id: "acceptable-use", label: "6. Acceptable use" },
  { id: "buddy-features", label: "7. Buddy features" },
  { id: "subscriptions", label: "8. Subscriptions" },
  { id: "user-content", label: "9. Your content" },
  { id: "ip", label: "10. Intellectual property" },
  { id: "third-party", label: "11. Third-party services" },
  { id: "disclaimers", label: "12. Disclaimers" },
  { id: "liability", label: "13. Limitation of liability" },
  { id: "indemnification", label: "14. Indemnification" },
  { id: "termination", label: "15. Termination" },
  { id: "governing-law", label: "16. Governing law" },
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
