import Image from "next/image";

export default function PhoneFrame({
  src,
  alt,
  priority = false,
  className,
}: {
  src?: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={
        "relative aspect-[9/19.5] w-full rounded-[2.2rem] border border-white/12 bg-ink-850 p-1.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-black/40 " +
        (className ?? "")
      }
    >
      <div className="relative h-full w-full overflow-hidden rounded-[1.7rem]">
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            className="object-cover"
            sizes="(max-width: 768px) 70vw, 320px"
          />
        ) : (
          <div
            role="img"
            aria-label={alt}
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_30%,rgba(125,190,141,0.18),transparent_60%)]"
          >
            <Image
              src="/adaptive-icon.png"
              alt=""
              width={64}
              height={64}
              className="size-14 opacity-80"
            />
            <span className="text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted">
              Screenshot soon
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
