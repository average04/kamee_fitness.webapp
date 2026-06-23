import Skeleton from "@/components/me/Skeleton";

export default function Loading() {
  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-4 h-8 w-56" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </main>
  );
}
