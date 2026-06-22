import Atmosphere from "@/components/landing/Atmosphere";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowToJoin from "@/components/landing/HowToJoin";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import { APP_STORE_URL } from "@/lib/landing/stores";

const SITE_URL = "https://kamee.fitness";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Kamee Fitness",
      url: SITE_URL,
      logo: `${SITE_URL}/adaptive-icon.png`,
      sameAs: [APP_STORE_URL],
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
      downloadUrl: APP_STORE_URL,
      installUrl: APP_STORE_URL,
      image: `${SITE_URL}/adaptive-icon.png`,
      description:
        "Personal workout and training app built on steady, sustainable progress.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}/#organization` },
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
      <Atmosphere />
      <Header />
      <main className="relative z-10">
        <Hero />
        <Features />
        <HowToJoin />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
