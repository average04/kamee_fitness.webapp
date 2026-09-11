import Link from "next/link";

export const metadata = { title: "Not a coach" };

export default function NotACoachPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 text-mist">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <h1 className="font-display text-xl font-semibold">
          This area is for Kamee coaches.
        </h1>
        <p className="mt-2 text-sm text-muted">
          If you think this is a mistake, reach out to Kamee support.
        </p>
        <Link
          href="/me"
          className="mt-6 inline-block rounded-lg bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-500"
        >
          Back to your stats
        </Link>
      </div>
    </main>
  );
}
