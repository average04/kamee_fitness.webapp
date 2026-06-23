import Skeleton from "@/components/me/Skeleton";

export default function Loading() {
  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 py-10">
      <Skeleton className="h-12 w-full" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="mt-10 h-28 w-full" />
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </main>
  );
}
