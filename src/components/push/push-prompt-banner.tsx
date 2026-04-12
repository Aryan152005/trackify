"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import {
  isPushSupported,
  getCurrentSubscription,
  subscribeToPush,
} from "@/lib/push/client";

const DISMISS_KEY = "trackify-push-prompt-dismissed-until";
const REMIND_IN_DAYS = 7;

/**
 * Tiny top-of-screen banner shown when push is supported but this device
 * hasn't subscribed yet. Lets the user enable in one click without visiting
 * /reminders. Dismissible for 7 days. Safe to render globally.
 */
export function PushPromptBanner() {
  const [visible, setVisible] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    setPublicKey(key);
    if (!key) return;

    (async () => {
      if (!isPushSupported()) return;
      if (Notification.permission === "denied") return;
      // Check dismissal cooldown
      try {
        const until = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
        if (until && Date.now() < until) return;
      } catch {
        /* ignore */
      }
      // Only show if this device has no active subscription
      try {
        const sub = await getCurrentSubscription();
        if (!sub) setVisible(true);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + REMIND_IN_DAYS * 24 * 3600 * 1000)
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    try {
      await subscribeToPush(publicKey);
      setVisible(false);
    } catch {
      /* user may have declined or error — keep banner for retry */
    }
    setBusy(false);
  }

  if (!visible) return null;

  return (
    <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200 bg-indigo-50 px-3 py-2 text-sm dark:border-indigo-900/50 dark:bg-indigo-950/40">
      <div className="flex min-w-0 items-center gap-2">
        <Bell className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <span className="truncate text-indigo-900 dark:text-indigo-200">
          <strong>Get reminders on this device</strong> — notifications work across all your devices once enabled.
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "Enabling…" : "Enable notifications"}
        </button>
        <Link
          href="/reminders"
          className="rounded-md px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
        >
          Learn more
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
