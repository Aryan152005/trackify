"use client";

import {
  Bell,
  ClipboardList,
  Clock,
  FileText,
  MessageSquare,
  AtSign,
  Megaphone,
  Check,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { Notification, NotificationType } from "@/lib/types/notification";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const typeIcons: Record<NotificationType, React.ReactNode> = {
  mention: <AtSign className="h-5 w-5 text-purple-500" />,
  assignment: <ClipboardList className="h-5 w-5 text-indigo-500" />,
  reminder: <Clock className="h-5 w-5 text-orange-500" />,
  request: <FileText className="h-5 w-5 text-amber-500" />,
  nudge: <Megaphone className="h-5 w-5 text-pink-500" />,
  comment: <MessageSquare className="h-5 w-5 text-sky-500" />,
};

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export function NotificationList({
  notifications,
  onMarkRead,
  onDelete,
}: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900">
        <Bell className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          No notifications
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          You are all caught up!
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white overflow-hidden dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      <AnimatePresence initial={false}>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className={cn(
                "flex items-start gap-4 px-5 py-4 transition",
                !n.is_read &&
                  "border-l-3 border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
              )}
            >
              <div className="mt-0.5 shrink-0">
                {typeIcons[n.type] ?? <Bell className="h-5 w-5 text-zinc-500" />}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm leading-snug",
                    n.is_read
                      ? "text-zinc-600 dark:text-zinc-400"
                      : "font-semibold text-zinc-900 dark:text-zinc-50"
                  )}
                >
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {n.body}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                  {formatDistanceToNow(new Date(n.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!n.is_read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Mark as read"
                    onClick={() => onMarkRead(n.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                  title="Delete"
                  onClick={() => onDelete(n.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
