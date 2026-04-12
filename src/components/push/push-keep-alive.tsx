"use client";

import { useEffect } from "react";
import { isPushSupported } from "@/lib/push/client";

/**
 * Runs on every authenticated page load. If the browser has an active push
 * subscription, re-POSTs it to /api/push/subscribe so the server-side row
 * stays in sync — even if the DB row was pruned (e.g. 410 Gone) on a previous
 * send. This ensures "once enabled, always on" behavior.
 *
 * Completely silent: no UI, no toasts, no errors shown. Fire and forget.
 */
export function PushKeepAlive() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPushSupported()) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub || cancelled) return;
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
