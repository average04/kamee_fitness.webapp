import Link from "next/link";

export default function BackLink({
  href = "/me",
  label = "Back",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link href={href} className="text-sm text-muted hover:text-leaf-300">
      ← {label}
    </Link>
  );
}
