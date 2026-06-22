import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing/stores";

export function StoreBadge({
  platform,
  href,
  eyebrow,
}: {
  platform: "ios" | "android";
  href?: string;
  eyebrow?: string;
}) {
  const isIos = platform === "ios";
  const live = Boolean(href);
  const storeName = isIos ? "App Store" : "Google Play";

  const className =
    "flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors " +
    (live
      ? "border-leaf-500/40 bg-leaf-500/[0.07] hover:border-leaf-400/60 hover:bg-leaf-500/[0.12]"
      : "border-white/10 bg-white/[0.03] hover:border-leaf-500/30");

  const inner = (
    <>
      <span className="text-leaf-400/90">
        {isIos ? (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-6"
            aria-hidden
          >
            <path d="M17.05 12.04c-.03-2.86 2.34-4.23 2.44-4.3-1.33-1.95-3.4-2.22-4.13-2.25-1.76-.18-3.43 1.04-4.32 1.04-.89 0-2.26-1.02-3.72-.99-1.91.03-3.68 1.11-4.66 2.82-1.99 3.45-.51 8.55 1.42 11.35.95 1.37 2.08 2.91 3.56 2.85 1.43-.06 1.97-.92 3.7-.92 1.72 0 2.21.92 3.72.89 1.54-.03 2.51-1.4 3.45-2.78 1.09-1.59 1.54-3.13 1.56-3.21-.03-.01-2.99-1.15-3.02-4.55zM14.13 4.62c.79-.96 1.32-2.29 1.18-3.62-1.14.05-2.52.76-3.33 1.72-.73.85-1.37 2.2-1.2 3.5 1.27.1 2.57-.65 3.35-1.6z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-6"
            aria-hidden
          >
            <path d="M4 3.42v17.16a.6.6 0 0 0 .9.52l14.4-8.58a.6.6 0 0 0 0-1.04L4.9 2.9a.6.6 0 0 0-.9.52z" />
          </svg>
        )}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-leaf-400/80">
          {eyebrow ?? (live ? "Download on the" : "Coming soon")}
        </span>
        <span className="font-display text-sm font-semibold text-mist">
          {storeName}
        </span>
      </span>
    </>
  );

  if (live) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={
          eyebrow
            ? `${eyebrow} to Kamee Fitness on ${storeName}`
            : `Download Kamee Fitness on the ${storeName}`
        }
        className={className}
      >
        {inner}
      </a>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function StoreBadges({ className }: { className?: string }) {
  return (
    <div className={"flex flex-wrap items-center gap-3 " + (className ?? "")}>
      <StoreBadge platform="ios" href={APP_STORE_URL} />
      <StoreBadge platform="android" href={PLAY_STORE_URL} eyebrow="Early access" />
    </div>
  );
}
