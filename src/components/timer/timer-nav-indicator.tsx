"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Timer } from "lucide-react";
import { getActiveTimer, subscribeTimer, formatElapsed, type ActiveTimer } from "@/lib/timer/store";

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
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;
  const elapsed = Math.max(0, Math.floor((now - active.startedAt) / 1000));

  return (
    <Link
      href="/dashboard"
      className="hidden items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 sm:inline-flex dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
      title="Focus timer running — click to view"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
      </span>
      <Timer className="h-3.5 w-3.5" />
      <span className="tabular-nums">{formatElapsed(elapsed)}</span>
    </Link>
  );
}
