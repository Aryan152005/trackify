import { cn } from "@/lib/utils";

/**
 * Shimmer placeholder. Default is a rounded rect you can size with className.
 *
 * <Skeleton className="h-6 w-40" />
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800/70",
        className
      )}
    />
  );
}

/** Multi-line text placeholder. */
export function SkeletonLines({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800/70"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

/** Generic card shape used for list/grid placeholders. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-36 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
    />
  );
}
