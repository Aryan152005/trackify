"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecentItems } from "@/lib/smart/actions";
import { FileText, CheckSquare, Columns3, StickyNote, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TYPE_ICONS: Record<string, typeof FileText> = {
  page: StickyNote,
  entry: FileText,
  task: CheckSquare,
  board: Columns3,
};

const TYPE_COLORS: Record<string, string> = {
  page: "text-purple-500",
  entry: "text-indigo-500",
  task: "text-emerald-500",
  board: "text-amber-500",
};

interface RecentItem {
  id: string;
  type: string;
  title: string;
  url: string;
  updatedAt: string;
}

export function RecentItems() {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentItems(8)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-zinc-400">No recent activity yet</p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const Icon = TYPE_ICONS[item.type] ?? FileText;
        const color = TYPE_COLORS[item.type] ?? "text-zinc-500";
        return (
          <Link
            key={`${item.type}-${item.id}`}
            href={item.url}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            <span className="min-w-0 flex-1 truncate font-medium text-zinc-700 dark:text-zinc-300">
              {item.title}
            </span>
            <span className="shrink-0 text-xs text-zinc-400">
              {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
