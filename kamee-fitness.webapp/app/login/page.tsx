"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EmailCodeSignIn } from "@/components/auth/EmailCodeSignIn";

function LoginForm() {
  const params = useSearchParams();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 text-mist">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="font-display text-xl font-semibold">Your Kamee stats</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in with the email on your Kamee account.
        </p>

        <EmailCodeSignIn next={params.get("next")} />

        <p className="mt-6 text-xs text-muted/70">
          New here? Create your account in the Kamee app first.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
