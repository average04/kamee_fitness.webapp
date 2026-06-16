import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kamee.fitness"),
  title: {
    default: "Kamee Fitness — Personal Workout & Training App",
    template: "%s · Kamee Fitness",
  },
  description:
    "Kamee Fitness is a personal workout and training app built on steady, sustainable progress. Download free on iOS for guided workouts, training plans, and progress tracking. Android coming soon.",
  applicationName: "Kamee Fitness",
  authors: [{ name: "Kamee Fitness" }],
  creator: "Kamee Fitness",
  publisher: "Kamee Fitness",
  category: "health",
  keywords: [
    "Kamee Fitness",
    "Kamee",
    "fitness app",
    "workout app",
    "personal training app",
    "personal trainer",
    "workout tracker",
    "exercise tracker",
    "training plans",
    "strength training",
    "home workout",
    "gym workout",
    "fitness coaching",
    "iOS fitness app",
    "progress tracking",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "https://kamee.fitness",
    siteName: "Kamee Fitness",
    title: "Kamee Fitness — Personal Workout & Training App",
    description:
      "Build a stronger you, one steady step at a time. Download Kamee Fitness free on iOS — guided workouts, training plans, and progress tracking. Android coming soon.",
    locale: "en_US",
    images: [
      {
        url: "/adaptive-icon.png",
        width: 1024,
        height: 1024,
        alt: "Kamee Fitness",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kamee Fitness — Personal Workout & Training App",
    description:
      "Build a stronger you, one steady step at a time. Download Kamee Fitness free on iOS. Android coming soon.",
    images: ["/adaptive-icon.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Kamee Fitness",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#07090a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${hanken.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
