"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  ArrowRight,
} from "lucide-react";
import type {
  RequestWithProfiles,
  RequestType,
  RequestStatus,
} from "@/lib/types/notification";

interface RequestCardProps {
  request: RequestWithProfiles;
  isReceived: boolean;
  onRespond?: (
    requestId: string,
    status: "accepted" | "declined" | "completed"
  ) => Promise<void>;
}

const TYPE_COLORS: Record<RequestType, string> = {
  task: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  review:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  approval:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  info: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  nudge:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  custom: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const STATUS_STYLES: Record<
  RequestStatus,
  { className: string; label: string }
> = {
  pending: {
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    label: "Pending",
  },
  accepted: {
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    label: "Accepted",
  },
  declined: {
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    label: "Declined",
  },
  completed: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    label: "Completed",
  },
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function AvatarInitial({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs";
  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-zinc-200 font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function RequestCard({ request, isReceived, onRespond }: RequestCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const otherUser = isReceived ? request.from_profile : request.to_profile;
  const otherLabel = isReceived ? "From" : "To";
  const status = STATUS_STYLES[request.status];

  async function handleRespond(newStatus: "accepted" | "declined" | "completed") {
    if (!onRespond) return;
    setLoading(newStatus);
    try {
      await onRespond(request.id, newStatus);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Left: badges + content */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Type + Status badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[request.type]}`}
            >
              {request.type}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
            >
              {status.label}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {request.title}
          </h3>

          {/* Description preview */}
          {request.description && (
            <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
              {request.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            {/* From/To user */}
            {otherUser && (
              <span className="inline-flex items-center gap-1.5">
                <AvatarInitial name={otherUser.name} />
                <span>
                  {otherLabel} <span className="font-medium text-zinc-700 dark:text-zinc-300">{otherUser.name}</span>
                </span>
              </span>
            )}

            {/* Due date */}
            {request.due_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(request.due_date).toLocaleDateString()}
              </span>
            )}

            {/* Relative time */}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {relativeTime(request.created_at)}
            </span>
          </div>
        </div>

        {/* Right: action buttons */}
        <AnimatePresence mode="wait">
          {isReceived && request.status === "pending" && (
            <motion.div
              key="pending-actions"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex flex-shrink-0 items-center gap-2"
            >
              <Button
                size="sm"
                variant="outline"
                disabled={loading !== null}
                onClick={() => handleRespond("accepted")}
                className="gap-1"
              >
                {loading === "accepted" ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                )}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loading !== null}
                onClick={() => handleRespond("declined")}
                className="gap-1"
              >
                {loading === "declined" ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                )}
                Decline
              </Button>
            </motion.div>
          )}

          {isReceived && request.status === "accepted" && (
            <motion.div
              key="accepted-actions"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex-shrink-0"
            >
              <Button
                size="sm"
                disabled={loading !== null}
                onClick={() => handleRespond("completed")}
                className="gap-1"
              >
                {loading === "completed" ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                Complete
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
