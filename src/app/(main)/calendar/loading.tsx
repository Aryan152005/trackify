export default function CalendarLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex gap-2">
          <div className="h-10 w-10 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-24 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-10 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="h-[500px] rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
    </div>
  );
}
