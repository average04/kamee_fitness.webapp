import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";

/**
 * A calmer cousin of <Atmosphere />: same visual language (leaf glow + grain)
 * but without the concentric rings, which are tuned to halo a centred hero and
 * cut distractingly across body copy. Static, so BlogShell stays a server
 * component.
 */
function BlogBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="hero-glow absolute left-1/2 top-0 size-[min(140vw,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl" />
      <div className="grain absolute inset-0" />
    </div>
  );
}

/**
 * The landing page's chrome, reused for the blog's entry points (hub + pillar)
 * so they read as part of the site rather than a detached microsite. No
 * background colour here — body already paints ink-950, and an opaque layer
 * would hide the backdrop. Individual guides deliberately skip this and keep a
 * plain reading layout.
 */
export function BlogShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <BlogBackdrop />
      <Header />
      <main className="relative z-10 pt-16">{children}</main>
      <Footer />
    </div>
  );
}
