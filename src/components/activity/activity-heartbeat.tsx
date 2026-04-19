"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Pings `touch_user_activity()` RPC so admins can see the *true* last active
 * time (not just last-login) per user.
 *
 * Strategy:
 *   - One ping on mount.
 *   - One ping on tab focus / visibility change.
 *   - Thereafter, every 5 minutes while the tab is visible.
 *
 * Silent failure — this is a best-effort telemetry signal, not business logic.
 */
export function ActivityHeartbeat() {
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function ping() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        await supabase.rpc("touch_user_activity");
      } catch {
        /* ignore */
      }
    }

    ping();
    interval = setInterval(ping, 5 * 60 * 1000);

    const onVisibility = () => {
      if (!document.hidden) ping();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", ping);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", ping);
    };
  }, []);

  return null;
}
