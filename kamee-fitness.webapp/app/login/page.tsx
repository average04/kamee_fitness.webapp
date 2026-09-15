"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmailCodeSignIn } from "@/components/auth/EmailCodeSignIn";
import styles from "./login.module.css";

function LoginForm() {
  const params = useSearchParams();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Kamee Fitness home">
          <Image src="/adaptive-icon.png" alt="" width={36} height={36} />
          <span>Kamee Fitness</span>
        </Link>
        <Link href="/" className={styles.back}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 5-7 7 7 7M5 12h14" /></svg>
          Back to home
        </Link>
      </header>

      <div className={styles.layout}>
        <section className={styles.story} aria-label="Strong and steady wins the race">
          <Image src="/hero/login-runner-illustration.webp" alt="" fill sizes="(min-width: 900px) 55vw, 1px" className={styles.art} />
          <div className={styles.storyCopy}>
            <p className={styles.eyebrow}>Your pace. Your progress.</p>
            <h2>Strong and steady<br />wins the race.</h2>
            <p>One session, one small win,<br />one step forward.</p>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="login-title">
          <div className={styles.formWrap}>
            <p className={styles.eyebrow}>Your Kamee account</p>
            <h1 id="login-title">Welcome back.</h1>
            <p className={styles.intro}>A little consistency goes a long way.<br />Sign in with the email you use in the app.</p>
            <div className={styles.form}>
              {params.get("error") === "not-authorized" && <p role="alert" className="mt-4 text-sm text-red-300">That account is not authorized for the admin panel.</p>}
              {params.get("error") === "auth" && <p role="alert" className="mt-4 text-sm text-red-300">Sign-in link was invalid or expired. Try again.</p>}
              <EmailCodeSignIn next={params.get("next")} fallbackNext="/auth/landing" sendLabel="Email me a sign-in link" />
            </div>
            <p className={styles.explanation}>Use the link or the six-digit code in your email.<br />No password needed here.</p>
            <div className={styles.newAccount}>
              <p>New to Kamee?</p>
              <Link href="/#get-the-app">Get the app to create your account <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <span>Strong and steady, together.</span>
        <nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav>
      </footer>
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
