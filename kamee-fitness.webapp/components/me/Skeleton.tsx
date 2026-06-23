export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={
        "animate-pulse rounded-2xl bg-white/8 motion-reduce:animate-none " +
        className
      }
    />
  );
}
