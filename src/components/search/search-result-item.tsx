"use client";

import { forwardRef } from "react";
import {
  FileText,
  CheckSquare,
  Clock,
  Columns,
  GitBranch,
  CalendarDays,
  Bell,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/lib/search/types";

// Map icon name strings to actual Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  CheckSquare,
  Clock,
  Columns,
  GitBranch,
  CalendarDays,
  Bell,
  MessageSquare,
};

const TYPE_LABELS: Record<string, string> = {
  page: "Page",
  task: "Task",
  entry: "Entry",
  board: "Board",
  mindmap: "Mind Map",
  calendar_event: "Event",
  reminder: "Reminder",
  comment: "Comment",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-indigo-100 px-0.5 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  isActive: boolean;
  query: string;
  onClick: () => void;
}

export const SearchResultItem = forwardRef<HTMLButtonElement, SearchResultItemProps>(
  function SearchResultItem({ result, isActive, query, onClick }, ref) {
    const Icon = ICON_MAP[result.icon] ?? FileText;

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
          isActive
            ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100"
            : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
        )}
        role="option"
        aria-selected={isActive}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            isActive
              ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-400"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {highlightMatch(result.title, query)}
          </div>
          {result.subtitle && (
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {result.subtitle}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {TYPE_LABELS[result.type] ?? result.type}
          </span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {relativeTime(result.updatedAt)}
          </span>
        </div>
      </button>
    );
  }
);
