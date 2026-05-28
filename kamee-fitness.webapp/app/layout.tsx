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
  title: "Kamee Fitness — Coming Soon",
  description:
    "Slow and steady wins the race. Kamee Fitness is almost here — join the waitlist for early access on iOS and Android.",
  keywords: [
    "Kamee Fitness",
    "fitness app",
    "workout",
    "personal trainer",
    "coming soon",
    "waitlist",
  ],
  openGraph: {
    title: "Kamee Fitness — Coming Soon",
    description:
      "Slow and steady wins the race. Kamee Fitness is almost here — join the waitlist.",
    siteName: "Kamee Fitness",
    type: "website",
    images: [{ url: "/adaptive-icon.png", width: 1024, height: 1024, alt: "Kamee Fitness" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kamee Fitness — Coming Soon",
    description:
      "Slow and steady wins the race. Kamee Fitness is almost here — join the waitlist.",
    images: ["/adaptive-icon.png"],
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
