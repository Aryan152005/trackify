"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";

const CHECK_INTERVAL = 30_000; // Check every 30 seconds
const NOTIFIED_KEY = "wis-notified-reminders";

function getNotified(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function markNotified(id: string) {
  const set = getNotified();
  set.add(id);
  // Keep only last 200 to avoid bloat
  const arr = [...set].slice(-200);
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
}

async function requestPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function showNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  // Try service worker notification first (works when app is in background on Android)
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "wis-reminder",
        renotify: true,
      } as NotificationOptions);
    });
  } else {
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
    });
  }
}

export function ReminderNotifier() {
  const workspaceId = useWorkspaceId();
  const checking = useRef(false);

  const checkReminders = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date().toISOString();
      // Reminders due in the last 5 minutes that aren't completed
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      let query = supabase
        .from("reminders")
        .select("id, title, description, reminder_time")
        .eq("user_id", user.id)
        .eq("is_completed", false)
        .gte("reminder_time", fiveMinAgo)
        .lte("reminder_time", now)
        .order("reminder_time", { ascending: true })
        .limit(10);

      if (workspaceId) {
        query = query.eq("workspace_id", workspaceId);
      }

      const { data: dueReminders } = await query;
      if (!dueReminders || dueReminders.length === 0) return;

      const notified = getNotified();

      for (const reminder of dueReminders) {
        if (notified.has(reminder.id)) continue;
        showNotification(
          `Reminder: ${reminder.title}`,
          reminder.description || "Your reminder is due now."
        );
        markNotified(reminder.id);
      }
    } catch {
      // Silent fail — don't break the app
    } finally {
      checking.current = false;
    }
  }, [workspaceId]);

  useEffect(() => {
    // Request permission on mount
    requestPermission();

    // Initial check
    checkReminders();

    // Poll every 30 seconds
    const interval = setInterval(checkReminders, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkReminders]);

  return null;
}
