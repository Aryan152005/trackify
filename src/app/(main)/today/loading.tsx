/**
 * Loading skeleton for /today. Mirrors the real page layout so there's no
 * layout shift when content swaps in. Blocks use the shimmering `.skeleton`
 * class from globals.css.
 */
export default function TodayLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* PageHeader */}
      <div className="space-y-2">
        <div className="skeleton h-7 w-64" />
        <div className="skeleton h-4 w-80" />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-2 h-7 w-14" />
            <div className="skeleton mt-1 h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Quick capture */}
      <div className="rounded-xl border border-indigo-200 p-4 dark:border-indigo-900/50">
        <div className="skeleton h-4 w-36" />
        <div className="skeleton mt-3 h-10 w-full" />
      </div>

      {/* Focus tasks */}
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="skeleton h-4 w-28" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
