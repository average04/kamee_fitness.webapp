import { redirect } from "next/navigation";

/** Compatibility for bookmarks and previously sent onboarding links. */
export default function OnboardingPage() {
  redirect("/coaching/profile");
}
