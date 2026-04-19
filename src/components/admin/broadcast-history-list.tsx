"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Users,
  UserIcon,
  Moon,
  Send as SendIcon,
  MessageSquare,
  Smile,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BroadcastThreadPanel } from "@/components/notifications/broadcast-thread-panel";
import type { BroadcastHistoryRow } from "@/lib/admin/push-actions";

interface Props {
  initial: BroadcastHistoryRow[];
}

const TARGET_LABEL: Record<BroadcastHistoryRow["target"], { label: string; icon: React.ReactNode }> = {
  all: { label: "Everyone", icon: <Users className="h-3 w-3" /> },
  selected: { label: "Selected users", icon: <UserIcon className="h-3 w-3" /> },
  inactive_24h: { label: "Inactive 24h+", icon: <Moon className="h-3 w-3" /> },
};

/**
 * Past-broadcasts list for /admin/push. Each row shows headline stats
 * (targeted / delivered / reaction count / comment count). Clicking
 * opens the full thread (reactions grouped by emoji + individual
 * comments) via the same BroadcastThreadPanel that end-users see,
 * so admin moderation and user engagement share one UI.
 */
export function BroadcastHistoryList({ initial }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (initial.length === 0) return null;

  return (
    <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {initial.map((b) => {
        const isOpen = expanded === b.id;
        const target = TARGET_LABEL[b.target] ?? TARGET_LABEL.all;
        return (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : b.id)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <SendIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {b.title}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {target.icon}
                    {target.label}
                  </span>
                </div>
                {b.body && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {b.body}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>{b.sender_email}</span>
                  <span>·</span>
                  <span>
                    {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-zinc-700 dark:text-zinc-200">{b.delivered_count}</strong>/{b.targeted_count} delivered
                  </span>
                  {b.reaction_count > 0 && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Smile className="h-3 w-3" />
                        {b.reaction_count}
                      </span>
                    </>
                  )}
                  {b.comment_count > 0 && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" />
                        {b.comment_count}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "mt-1 shrink-0 text-zinc-400 transition",
                  isOpen && "rotate-180",
                )}
              >
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                <Card>
                  <CardContent className="pt-4">
                    <BroadcastThreadPanel broadcastId={b.id} />
                  </CardContent>
                </Card>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
