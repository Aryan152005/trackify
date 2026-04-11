"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  ClipboardList,
  Clock,
  FileText,
  MessageSquare,
  AtSign,
  Megaphone,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { useRealtime } from "@/lib/realtime/use-realtime";
import { markAsRead, markAllRead } from "@/lib/notifications/actions";
import type { Notification, NotificationType } from "@/lib/types/notification";
import { cn } from "@/lib/utils";

const typeIcons: Record<NotificationType, React.ReactNode> = {
  mention: <AtSign className="h-4 w-4 text-purple-500" />,
  assignment: <ClipboardList className="h-4 w-4 text-indigo-500" />,
  reminder: <Clock className="h-4 w-4 text-orange-500" />,
  request: <FileText className="h-4 w-4 text-amber-500" />,
  nudge: <Megaphone className="h-4 w-4 text-pink-500" />,
  comment: <MessageSquare className="h-4 w-4 text-sky-500" />,
};

function getEntityHref(notification: Notification): string | null {
  if (!notification.entity_type || !notification.entity_id) return null;
  const map: Record<string, string> = {
    task: "/tasks",
    entry: "/entries",
    reminder: "/reminders",
    board: "/boards",
    note: "/notes",
  };
  const base = map[notification.entity_type];
  if (!base) return null;
  return `${base}/${notification.entity_id}`;
}

export function NotificationBell() {
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const loadedRef = useRef(false);

  // Get current user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Fetch recent notifications and unread count
  const fetchNotifications = useCallback(async () => {
    if (!userId || !workspaceId) return;
    const supabase = createClient();

    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("workspace_id", workspaceId)
        .eq("is_read", false),
    ]);

    if (data) setNotifications(data as Notification[]);
    setUnreadCount(count ?? 0);
  }, [userId, workspaceId]);

  useEffect(() => {
    if (!loadedRef.current && userId && workspaceId) {
      loadedRef.current = true;
      fetchNotifications();
    }
  }, [userId, workspaceId, fetchNotifications]);

  // Realtime subscription
  useRealtime({
    table: "notifications",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId && !!workspaceId,
    onInsert(payload) {
      const newNotif = payload.new as unknown as Notification;
      if (newNotif.workspace_id !== workspaceId) return;
      setNotifications((prev) => [newNotif, ...prev].slice(0, 10));
      setUnreadCount((c) => c + 1);
    },
    onUpdate(payload) {
      const updated = payload.new as unknown as Notification;
      setNotifications((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      );
      // Recount
      fetchNotifications();
    },
    onDelete(payload) {
      const old = payload.old as { id?: string };
      if (old.id) {
        setNotifications((prev) => prev.filter((n) => n.id !== old.id));
        fetchNotifications();
      }
    },
  });

  async function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await markAsRead(id);
  }

  async function handleMarkAllRead() {
    if (!workspaceId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await markAllRead(workspaceId);
  }

  function handleClickNotification(notification: Notification) {
    if (!notification.is_read) handleMarkRead(notification.id);
    const href = getEntityHref(notification);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 animate-in fade-in-0 zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-sm text-zinc-500 dark:text-zinc-400">
                <Bell className="mb-2 h-8 w-8 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClickNotification(n)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800",
                    !n.is_read &&
                      "border-l-2 border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {typeIcons[n.type] ?? <Bell className="h-4 w-4 text-zinc-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm leading-tight",
                        n.is_read
                          ? "text-zinc-600 dark:text-zinc-400"
                          : "font-semibold text-zinc-900 dark:text-zinc-50"
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-500">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              View all notifications
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
