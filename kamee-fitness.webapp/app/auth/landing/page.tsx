import { redirect } from "next/navigation";
import { getSignInDestination } from "@/lib/auth/landing";

export default async function SignInLanding() {
  redirect(await getSignInDestination());
}
