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
  metadataBase: new URL("https://kamee.fit"),
  title: {
    default: "Kamee Fitness — Personal Workout & Training App",
    template: "%s · Kamee Fitness",
  },
  description:
    "Kamee Fitness — personalized plans, guided workouts, GPS tracking, and a coach named Kamy. Free on iOS, now in early access on Android.",
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
    "Android fitness app",
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
    url: "https://kamee.fit",
    siteName: "Kamee Fitness",
    title: "Kamee Fitness — Personal Workout & Training App",
    description:
      "Slow and steady wins the race. Personalized plans, guided workouts, GPS tracking, and Coach Kamy. Free on iOS, early access on Android.",
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
      "Slow and steady wins the race. Free on iOS, early access on Android.",
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
