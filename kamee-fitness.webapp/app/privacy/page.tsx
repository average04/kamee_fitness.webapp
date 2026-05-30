import type { Metadata } from "next";
import Privacy from "@/content/legal/privacy.mdx";
import { LegalDocLayout } from "@/components/LegalDocLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Kamee Fitness",
  description: "How Kamee Fitness handles your personal data.",
};

// IDs must match slugifyHeading() in mdx-components.tsx — strip the leading
// "N. " from each heading, lowercase, replace non-alphanum with dashes.
const SECTIONS = [
  { id: "who-we-are-how-to-contact-us", label: "1. Who we are" },
  { id: "scope", label: "2. Scope" },
  { id: "data-we-collect", label: "3. Data we collect" },
  { id: "what-we-don-t-collect-our-privacy-promises", label: "4. What we don't collect" },
  { id: "how-we-use-your-data", label: "5. How we use it" },
  { id: "third-party-processors", label: "6. Third-party processors" },
  { id: "international-transfers", label: "7. International transfers" },
  { id: "how-long-we-keep-your-data", label: "8. Retention" },
  { id: "security", label: "9. Security" },
  { id: "your-rights", label: "10. Your rights" },
  { id: "children", label: "11. Children" },
  { id: "push-notifications-email", label: "12. Notifications" },
  { id: "changes-to-this-policy", label: "13. Changes" },
  { id: "appendix-apple-app-store-privacy-nutrition-label", label: "14. Apple nutrition label" },
  { id: "contact", label: "15. Contact" },
];

export default function PrivacyPage() {
  return (
    <LegalDocLayout title="Privacy Policy" sections={SECTIONS}>
      <Privacy />
    </LegalDocLayout>
  );
}
