"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { useRealtime } from "@/lib/realtime/use-realtime";
import {
  markAsRead,
  markAllRead,
  deleteNotification,
  deleteReadNotifications,
} from "@/lib/notifications/actions";
import { NotificationList } from "@/components/notifications/notification-list";
import { AnimatedPage } from "@/components/ui/animated-layout";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import type { Notification, NotificationType } from "@/lib/types/notification";

type ReadFilter = "all" | "unread";
type TypeFilter = NotificationType | "all";

/**
 * Buckets a notification by how recent it is, in the viewer's local timezone.
 * Today / Yesterday / This week / Older give the user a sense of scale
 * without forcing an absolute date on every row.
 */
function bucketOf(iso: string): "today" | "yesterday" | "week" | "older" {
  const now = new Date();
  const then = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 3600 * 1000);
  const weekAgo = new Date(startOfToday.getTime() - 7 * 24 * 3600 * 1000);
  if (then >= startOfToday) return "today";
  if (then >= startOfYesterday) return "yesterday";
  if (then >= weekAgo) return "week";
  return "older";
}

const BUCKET_ORDER: Array<"today" | "yesterday" | "week" | "older"> = [
  "today", "yesterday", "week", "older",
];
const BUCKET_LABEL: Record<"today" | "yesterday" | "week" | "older", string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Earlier this week",
  older: "Older",
};

const TYPE_FILTER_OPTIONS: Array<{ id: TypeFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "mention", label: "Mentions" },
  { id: "assignment", label: "Assignments" },
  { id: "reminder", label: "Reminders" },
  { id: "request", label: "Requests" },
  { id: "nudge", label: "Nudges" },
  { id: "comment", label: "Comments" },
];

export default function NotificationsPage() {
  const workspaceId = useWorkspaceId();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Resolve current user once
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userId || !workspaceId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  }, [userId, workspaceId]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime — pushes new notifications in immediately, updates reflected,
  // deletions propagated. Subscribed while userId+workspaceId known.
  useRealtime({
    table: "notifications",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId && !!workspaceId,
    onInsert(payload) {
      const n = payload.new as unknown as Notification;
      if (n.workspace_id !== workspaceId) return;
      setNotifications((prev) => [n, ...prev]);
    },
    onUpdate(payload) {
      const n = payload.new as unknown as Notification;
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? n : x)));
    },
    onDelete(payload) {
      const old = payload.old as { id?: string };
      if (old.id) setNotifications((prev) => prev.filter((x) => x.id !== old.id));
    },
  });

  // ─── Actions ─────────────────────────────────────────────────
  async function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await markAsRead(id);
  }
  async function handleDelete(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
  }
  async function handleMarkAllRead() {
    if (!workspaceId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllRead(workspaceId);
    toast.success("All marked read");
  }
  async function performClearRead() {
    if (!workspaceId) return;
    setClearing(true);
    try {
      const res = await deleteReadNotifications(workspaceId);
      setNotifications((prev) => prev.filter((n) => !n.is_read));
      toast.success(res.deleted === 0 ? "Nothing to clear" : `Cleared ${res.deleted} read`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't clear read notifications");
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  // ─── Filter + group ──────────────────────────────────────────
  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (readFilter === "unread" && n.is_read) return false;
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, readFilter, typeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<"today" | "yesterday" | "week" | "older", Notification[]>();
    for (const n of filtered) {
      const b = bucketOf(n.created_at);
      const list = map.get(b) ?? [];
      list.push(n);
      map.set(b, list);
    }
    // Within each bucket, unread first then newest
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return map;
  }, [filtered]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const readCount = notifications.filter((n) => n.is_read).length;

  // Per-type counts for the filter chips — shown in parens so users know
  // whether there's anything to filter to.
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notifications.length };
    for (const n of notifications) counts[n.type] = (counts[n.type] ?? 0) + 1;
    return counts;
  }, [notifications]);

  return (
    <AnimatedPage>
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-zinc-500" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Notifications</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck className="mr-1.5 h-4 w-4" />
                Mark all read
              </Button>
            )}
            {readCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmClear(true)}
                className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Clear read
              </Button>
            )}
          </div>
        </div>

        {/* Read-state tabs */}
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800 w-fit">
          {(["all", "unread"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setReadFilter(tab)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                readFilter === tab
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab === "all" ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTER_OPTIONS.map((opt) => {
            const count = typeCounts[opt.id] ?? 0;
            const active = typeFilter === opt.id;
            if (opt.id !== "all" && count === 0) return null;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTypeFilter(opt.id)}
                className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition ${
                  active
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                }`}
              >
                {opt.label}
                <span className="ml-1 text-zinc-400">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900">
            <Bell className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {notifications.length === 0
                ? "No notifications yet"
                : "Nothing matches these filters"}
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {notifications.length === 0 ? "You're all caught up!" : "Try widening the filter above."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {BUCKET_ORDER.map((bucket) => {
              const list = grouped.get(bucket);
              if (!list || list.length === 0) return null;
              return (
                <section key={bucket}>
                  <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {BUCKET_LABEL[bucket]}
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {list.length}
                    </span>
                  </h2>
                  <NotificationList
                    notifications={list}
                    onMarkRead={handleMarkRead}
                    onDelete={handleDelete}
                  />
                </section>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all read notifications?"
        description={`${readCount} read notification${readCount === 1 ? "" : "s"} will be permanently removed. Unread items stay put.`}
        confirmLabel={clearing ? "Clearing…" : "Clear read"}
        cancelLabel="Keep"
        variant="danger"
        onConfirm={performClearRead}
      />
    </AnimatedPage>
  );
}
