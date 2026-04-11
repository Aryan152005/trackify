"use client";

import { useCallback, useEffect, useState } from "react";
import { format, isToday, isYesterday, isTomorrow, parseISO } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTimelineData } from "@/lib/timeline/actions";
import type { TimelineItem, TimelineFilters } from "@/lib/timeline/types";
import type { TaskStatus } from "@/lib/types/database";
import { addDays } from "date-fns";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMMM d, yyyy");
}

function statusConfig(status: TaskStatus | null) {
  switch (status) {
    case "done":
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        color: "text-emerald-500",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        ring: "ring-emerald-500",
      };
    case "in-progress":
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        color: "text-blue-500",
        bg: "bg-blue-50 dark:bg-blue-900/20",
        ring: "ring-blue-500",
      };
    case "cancelled":
      return {
        icon: <XCircle className="h-4 w-4" />,
        color: "text-zinc-400",
        bg: "bg-zinc-50 dark:bg-zinc-800/50",
        ring: "ring-zinc-400",
      };
    default:
      return {
        icon: <Clock className="h-4 w-4" />,
        color: "text-amber-500",
        bg: "bg-amber-50 dark:bg-amber-900/20",
        ring: "ring-amber-500",
      };
  }
}

const PRIORITY_BORDER: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-emerald-500",
};

// ---------------------------------------------------------------------------
// TimelineView component
// ---------------------------------------------------------------------------

interface TimelineViewProps {
  workspaceId: string;
  startDate?: Date;
  endDate?: Date;
  filters?: TimelineFilters;
}

export function TimelineView({
  workspaceId,
  startDate: propStart,
  endDate: propEnd,
  filters,
}: TimelineViewProps) {
  const PAGE_SIZE = 30;
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [daysLoaded, setDaysLoaded] = useState(60);
  const [hasMore, setHasMore] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const rangeStart = propStart ?? addDays(new Date(), -30);

  const loadData = useCallback(
    async (extendDays?: number) => {
      if (!workspaceId) return;
      const isExtend = !!extendDays;
      if (isExtend) setLoadingMore(true);
      else setLoading(true);

      try {
        const days = extendDays ?? daysLoaded;
        const end = propEnd ?? addDays(rangeStart, days);
        const data = await getTimelineData(
          workspaceId,
          rangeStart.toISOString(),
          end.toISOString(),
          filters
        );
        setItems(data);
        if (extendDays) setDaysLoaded(days);
        // If we got fewer items than the extension might provide, we're done
        if (data.length < PAGE_SIZE && isExtend) setHasMore(false);
      } catch (e) {
        console.error("Failed to load timeline data:", e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [workspaceId, rangeStart, propEnd, daysLoaded, filters]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  function loadMore() {
    loadData(daysLoaded + 60);
  }

  // Group items by date
  const grouped = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const dateKey = format(
      parseISO(item.endDate ?? item.startDate),
      "yyyy-MM-dd"
    );
    const existing = grouped.get(dateKey) ?? [];
    existing.push(item);
    grouped.set(dateKey, existing);
  }
  const dateKeys = [...grouped.keys()].sort();

  if (loading && items.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        Loading timeline...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Calendar className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p>No items found for this date range.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Central timeline line */}
      <div className="absolute left-1/2 top-0 hidden h-full w-0.5 -translate-x-1/2 bg-zinc-200 dark:bg-zinc-700 md:block" />
      <div className="absolute left-5 top-0 h-full w-0.5 bg-zinc-200 dark:bg-zinc-700 md:hidden" />

      <div className="space-y-6">
        {dateKeys.map((dateKey, groupIdx) => {
          const dateItems = grouped.get(dateKey) ?? [];
          return (
            <div key={dateKey}>
              {/* Date marker */}
              <div className="relative mb-3 flex items-center justify-center">
                <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
                  <div className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                    {formatDateLabel(dateKey)}
                  </div>
                </div>
                <div className="ml-0 md:hidden">
                  <div className="ml-10 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                    {formatDateLabel(dateKey)}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <AnimatePresence>
                  {dateItems.map((item, i) => {
                    const isLeft = i % 2 === 0;
                    const cfg = statusConfig(item.status);
                    const priorityBorder =
                      item.priority
                        ? PRIORITY_BORDER[item.priority] ?? ""
                        : "";
                    const isHovered = hoveredId === item.id;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="relative"
                        onMouseEnter={() => setHoveredId(item.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        {/* Desktop layout: alternating left/right */}
                        <div className="hidden md:block">
                          <div
                            className={cn(
                              "flex items-start gap-4",
                              isLeft ? "flex-row" : "flex-row-reverse"
                            )}
                          >
                            {/* Card */}
                            <div
                              className={cn(
                                "w-[calc(50%-24px)] rounded-lg border-l-4 bg-white p-3 shadow-sm transition-all dark:bg-zinc-900",
                                priorityBorder || "border-l-indigo-500",
                                isHovered && "shadow-md ring-1 ring-indigo-200 dark:ring-indigo-800"
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <div className={cn("mt-0.5", cfg.color)}>
                                  {item.type === "event" ? (
                                    <Calendar className="h-4 w-4 text-indigo-500" />
                                  ) : (
                                    cfg.icon
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                    {item.title}
                                  </p>
                                  {isHovered && item.description && (
                                    <motion.p
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
                                    >
                                      {item.description}
                                    </motion.p>
                                  )}
                                  <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-400">
                                    {item.assigneeName && (
                                      <span>{item.assigneeName}</span>
                                    )}
                                    {item.type === "task" && item.status && (
                                      <span className="capitalize">
                                        {item.status}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Center dot */}
                            <div className="relative flex-shrink-0">
                              <div
                                className={cn(
                                  "h-3 w-3 rounded-full ring-4 ring-white dark:ring-zinc-950",
                                  item.type === "event"
                                    ? "bg-indigo-500"
                                    : cfg.color.replace("text-", "bg-")
                                )}
                              />
                            </div>

                            {/* Spacer for opposite side */}
                            <div className="w-[calc(50%-24px)]" />
                          </div>
                        </div>

                        {/* Mobile layout: single column */}
                        <div className="md:hidden">
                          <div className="flex items-start gap-3">
                            {/* Dot on line */}
                            <div className="relative flex-shrink-0" style={{ marginLeft: 14 }}>
                              <div
                                className={cn(
                                  "h-3 w-3 rounded-full ring-4 ring-white dark:ring-zinc-950",
                                  item.type === "event"
                                    ? "bg-indigo-500"
                                    : cfg.color.replace("text-", "bg-")
                                )}
                              />
                            </div>
                            {/* Card */}
                            <div
                              className={cn(
                                "flex-1 rounded-lg border-l-4 bg-white p-3 shadow-sm dark:bg-zinc-900",
                                priorityBorder || "border-l-indigo-500"
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <div className={cn("mt-0.5", cfg.color)}>
                                  {item.type === "event" ? (
                                    <Calendar className="h-4 w-4 text-indigo-500" />
                                  ) : (
                                    cfg.icon
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                    {item.title}
                                  </p>
                                  {item.description && (
                                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                                      {item.description}
                                    </p>
                                  )}
                                  <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-400">
                                    {item.assigneeName && (
                                      <span>{item.assigneeName}</span>
                                    )}
                                    {item.type === "task" && item.status && (
                                      <span className="capitalize">
                                        {item.status}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
