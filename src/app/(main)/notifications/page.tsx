"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { useRealtime } from "@/lib/realtime/use-realtime";
import {
  markAsRead,
  markAllRead,
  deleteNotification,
} from "@/lib/notifications/actions";
import { NotificationList } from "@/components/notifications/notification-list";
import { AnimatedPage } from "@/components/ui/animated-layout";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/lib/types/notification";

type Filter = "all" | "unread";

export default function NotificationsPage() {
  const workspaceId = useWorkspaceId();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  // Get current user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Fetch all notifications
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

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime
  useRealtime({
    table: "notifications",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId && !!workspaceId,
    onInsert(payload) {
      const newNotif = payload.new as unknown as Notification;
      if (newNotif.workspace_id !== workspaceId) return;
      setNotifications((prev) => [newNotif, ...prev]);
    },
    onUpdate(payload) {
      const updated = payload.new as unknown as Notification;
      setNotifications((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      );
    },
    onDelete(payload) {
      const old = payload.old as { id?: string };
      if (old.id) {
        setNotifications((prev) => prev.filter((n) => n.id !== old.id));
      }
    },
  });

  async function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
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
  }

  const filtered =
    filter === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AnimatedPage>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-zinc-500" />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800 w-fit">
        {(["all", "unread"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              filter === tab
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {tab === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : (
        <NotificationList
          notifications={filtered}
          onMarkRead={handleMarkRead}
          onDelete={handleDelete}
        />
      )}
    </AnimatedPage>
  );
}
