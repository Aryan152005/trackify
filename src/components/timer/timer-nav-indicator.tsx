"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Timer } from "lucide-react";
import { getActiveTimer, subscribeTimer, formatElapsed, computeElapsed, type ActiveTimer } from "@/lib/timer/store";

/**
 * Small pulsing chip in the nav when a focus timer is running. Click opens
 * the dashboard where the full timer widget lives. Updates elapsed every
 * second; disappears when no timer is active. Cross-tab synced via storage
 * events.
 */
export function TimerNavIndicator() {
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setActive(getActiveTimer());
    return subscribeTimer(() => setActive(getActiveTimer()));
  }, []);

  useEffect(() => {
    if (!active || active.pausedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;
  const elapsed = computeElapsed(active, now);
  const paused = !!active.pausedAt;

  return (
    <Link
      href="/dashboard"
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition sm:inline-flex ${
        paused
          ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
          : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
      }`}
      title={paused ? "Focus timer paused — click to view" : "Focus timer running — click to view"}
    >
      {paused ? (
        <Timer className="h-3 w-3" />
      ) : (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
        </span>
      )}
      <Timer className={`h-3.5 w-3.5 ${paused ? "hidden" : ""}`} />
      <span className="tabular-nums">{formatElapsed(elapsed)}</span>
      {active.title && (
        <span className="max-w-[120px] truncate text-[11px] opacity-80">· {active.title}</span>
      )}
    </Link>
  );
}
