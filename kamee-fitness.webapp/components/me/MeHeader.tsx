import { signOut } from "@/app/me/actions";
import { avatarSrc } from "@/lib/me/avatars";
import type { Range } from "@/lib/me/range";
import RangeToggle from "./RangeToggle";

export default function MeHeader({
  name,
  avatarUrl,
  isPremium,
  range,
  from,
  to,
}: {
  name: string;
  avatarUrl: string | null;
  isPremium: boolean;
  range: Range;
  from?: string;
  to?: string;
}) {
  // avatar_url is a preset key (e.g. "female-coder"), not a URL — resolve it to
  // a ported web asset; real URLs pass through; unknown/null → initial.
  const src = avatarSrc(avatarUrl);
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-6">
      <div className="flex items-center gap-3">
        {src ? (
          // Source may be a same-origin /avatars asset or an arbitrary remote
          // URL — a plain <img> avoids next/image's per-host allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-full object-cover"
          />
        ) : (
          <div className="grid size-11 place-items-center rounded-full bg-leaf-500/15 font-display font-bold text-leaf-300">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-display text-lg font-bold text-mist">{name}</div>
          {isPremium && (
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-sun-500">
              Premium
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <RangeToggle range={range} from={from} to={to} />
        <form action={signOut}>
          <button className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-muted hover:text-mist">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
