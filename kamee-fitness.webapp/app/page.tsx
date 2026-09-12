import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import ProofTiles, { Ticker } from "@/components/landing/ProofTiles";
import CoachSection from "@/components/landing/CoachSection";
import GpsSection from "@/components/landing/GpsSection";
import PlansSection from "@/components/landing/PlansSection";
import LogSection from "@/components/landing/LogSection";
import FuelSection from "@/components/landing/FuelSection";
import ProgressBand from "@/components/landing/ProgressBand";
import CommunitiesSection, {
  PricingBand,
} from "@/components/landing/CommunitiesSection";
import ClosingCta from "@/components/landing/ClosingCta";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import { FAQ } from "@/lib/landing/content";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing/stores";

const SITE_URL = "https://kamee.fit";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Kamee Fitness",
      url: SITE_URL,
      logo: `${SITE_URL}/adaptive-icon.png`,
      sameAs: [APP_STORE_URL, PLAY_STORE_URL],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Kamee Fitness",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "MobileApplication",
      name: "Kamee Fitness",
      operatingSystem: "iOS, Android",
      applicationCategory: "HealthApplication",
      url: SITE_URL,
      downloadUrl: [APP_STORE_URL, PLAY_STORE_URL],
      installUrl: [APP_STORE_URL, PLAY_STORE_URL],
      image: `${SITE_URL}/hero/keyart.webp`,
      description:
        "Personalized training plans, GPS run tracking, a workout log, calendar sync, and Coach Kamy. Premium adds a Fuel Log with meal estimates and training-aware meal plans.",
      featureList: [
        "AI coach with session debriefs and weekly reports",
        "Training plans from Couch to 5K to half marathon",
        "GPS tracking with live splits, heart-rate zones and route replay",
        "Guided and free-form workout logging",
        "Premium Fuel Log with photo meal estimates and editable portions",
        "Premium meal plans that follow your training week",
        "Training calendar with external calendar sync",
        "Clubs, events and a live race calendar",
      ],
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="relative z-10">
        <Hero />
        <ProofTiles />
        <Ticker />
        <CoachSection />
        <GpsSection />
        <PlansSection />
        <LogSection />
        <FuelSection />
        <ProgressBand />
        <CommunitiesSection />
        <PricingBand />
        <ClosingCta />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
