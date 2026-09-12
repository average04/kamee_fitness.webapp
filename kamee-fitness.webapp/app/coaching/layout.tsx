import { Onest } from "next/font/google";
import "./workspace.css";

const onest = Onest({ subsets: ["latin"], variable: "--font-coach-display", weight: ["600", "700"] });

export default function CoachingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${onest.variable} coaching-workspace`}>{children}</div>;
}
