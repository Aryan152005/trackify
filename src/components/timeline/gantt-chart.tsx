"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  format,
  addDays,
  differenceInDays,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isToday,
  isSameMonth,
  parseISO,
  isBefore,
  isAfter,
} from "date-fns";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTimelineData, updateTaskDates } from "@/lib/timeline/actions";
import type {
  TimelineItem,
  TimelineFilters,
  GanttRow,
  GanttDependencyLine,
  ZoomLevel,
} from "@/lib/timeline/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_WIDTH: Record<ZoomLevel, number> = {
  day: 40,
  week: 120,
  month: 180,
};

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 56;
const LEFT_PANEL_WIDTH = 260;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: string | null): string {
  switch (status) {
    case "pending":
      return "bg-amber-400 dark:bg-amber-500";
    case "in-progress":
      return "bg-blue-500 dark:bg-blue-400";
    case "done":
      return "bg-emerald-500 dark:bg-emerald-400";
    case "cancelled":
      return "bg-zinc-400 dark:bg-zinc-500";
    default:
      return "bg-indigo-500";
  }
}

function statusBarColor(status: string | null): string {
  switch (status) {
    case "pending":
      return "#f59e0b";
    case "in-progress":
      return "#3b82f6";
    case "done":
      return "#10b981";
    case "cancelled":
      return "#a1a1aa";
    default:
      return "#6366f1";
  }
}

// ---------------------------------------------------------------------------
// GanttChart component
// ---------------------------------------------------------------------------

interface GanttChartProps {
  workspaceId: string;
  startDate?: Date;
  endDate?: Date;
  filters?: TimelineFilters;
}

export function GanttChart({
  workspaceId,
  startDate: propStart,
  endDate: propEnd,
  filters,
}: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("day");
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    taskId: string;
    edge: "start" | "end";
    startX: number;
    originalDate: string;
  } | null>(null);

  const chartRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Date range
  const rangeStart = useMemo(
    () => propStart ?? addDays(new Date(), -14),
    [propStart]
  );
  const rangeEnd = useMemo(
    () => propEnd ?? addDays(new Date(), 90),
    [propEnd]
  );

  // Fetch data
  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await getTimelineData(
        workspaceId,
        rangeStart.toISOString(),
        rangeEnd.toISOString(),
        filters
      );
      setItems(data);
    } catch (e) {
      console.error("Failed to load timeline data:", e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, rangeStart, rangeEnd, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build rows
  const rows: GanttRow[] = useMemo(() => {
    return items
      .filter((item) => item.type === "task")
      .map((item) => {
        const start = item.startDate;
        const end = item.endDate ?? item.startDate;
        const isMilestone = !item.endDate || start === end;
        return {
          id: item.id,
          title: item.title,
          startDate: start,
          endDate: end,
          status: item.status,
          priority: item.priority,
          assigneeName: item.assigneeName,
          progress: item.progress,
          isSubtask: !!item.parentTaskId,
          parentTaskId: item.parentTaskId,
          isMilestone,
        };
      });
  }, [items]);

  // Build dependency lines
  const dependencyLines: GanttDependencyLine[] = useMemo(() => {
    const lines: GanttDependencyLine[] = [];
    for (const item of items) {
      for (const dep of item.dependencies) {
        lines.push({
          fromTaskId: dep.dependsOn,
          toTaskId: item.id,
          type: dep.dependencyType,
        });
      }
    }
    return lines;
  }, [items]);

  // Timeline columns
  const cellWidth = CELL_WIDTH[zoom];
  const columns = useMemo(() => {
    switch (zoom) {
      case "day":
        return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      case "week":
        return eachWeekOfInterval(
          { start: rangeStart, end: rangeEnd },
          { weekStartsOn: 1 }
        );
      case "month":
        return eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
    }
  }, [zoom, rangeStart, rangeEnd]);

  const totalWidth = columns.length * cellWidth;

  // Position helpers
  function dateToX(date: string | Date): number {
    const d = typeof date === "string" ? parseISO(date) : date;
    const days = differenceInDays(startOfDay(d), startOfDay(rangeStart));
    const totalDays = differenceInDays(rangeEnd, rangeStart);
    if (totalDays <= 0) return 0;
    return (days / totalDays) * totalWidth;
  }

  function barWidth(start: string, end: string): number {
    const s = parseISO(start);
    const e = parseISO(end);
    const days = Math.max(differenceInDays(startOfDay(e), startOfDay(s)), 1);
    const totalDays = differenceInDays(rangeEnd, rangeStart);
    if (totalDays <= 0) return cellWidth;
    return (days / totalDays) * totalWidth;
  }

  // Today line
  const todayX = dateToX(new Date());
  const showTodayLine =
    !isBefore(new Date(), rangeStart) && !isAfter(new Date(), rangeEnd);

  // Row position map (for dependency arrows)
  const rowIndexMap = new Map<string, number>();
  rows.forEach((r, i) => rowIndexMap.set(r.id, i));

  // Resize handler
  function handleResizeStart(
    e: React.MouseEvent,
    taskId: string,
    edge: "start" | "end",
    originalDate: string
  ) {
    e.stopPropagation();
    e.preventDefault();
    setResizing({ taskId, edge, startX: e.clientX, originalDate });
  }

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // We track delta pixels and convert to days
    };

    const handleMouseUp = async (e: MouseEvent) => {
      if (!resizing) return;
      const deltaX = e.clientX - resizing.startX;
      const totalDays = differenceInDays(rangeEnd, rangeStart);
      const deltaDays = Math.round((deltaX / totalWidth) * totalDays);

      if (deltaDays !== 0) {
        const row = rows.find((r) => r.id === resizing.taskId);
        if (row) {
          const origDate = parseISO(resizing.originalDate);
          const newDate = addDays(origDate, deltaDays);
          const newEnd =
            resizing.edge === "end"
              ? format(newDate, "yyyy-MM-dd")
              : row.endDate;
          try {
            await updateTaskDates(
              resizing.taskId,
              row.startDate,
              newEnd
            );
            await loadData();
          } catch (err) {
            console.error("Failed to update task dates:", err);
          }
        }
      }
      setResizing(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, rows, rangeStart, rangeEnd, totalWidth, loadData]);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current && showTodayLine) {
      const scrollTo = todayX - scrollRef.current.clientWidth / 3;
      scrollRef.current.scrollLeft = Math.max(0, scrollTo);
    }
  }, [loading, todayX, showTodayLine]);

  // Zoom handlers
  function zoomIn() {
    setZoom((z) => (z === "month" ? "week" : z === "week" ? "day" : "day"));
  }
  function zoomOut() {
    setZoom((z) => (z === "day" ? "week" : z === "week" ? "month" : "month"));
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        Loading Gantt chart...
      </div>
    );
  }

  if (rows.length === 0 && !loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <p>No tasks found for this date range.</p>
        <p className="text-xs">Try adjusting filters or date range.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={zoomOut} disabled={zoom === "month"}>
          <ZoomOut className="mr-1 h-3.5 w-3.5" />
          Zoom out
        </Button>
        <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {zoom}
        </span>
        <Button variant="outline" size="sm" onClick={zoomIn} disabled={zoom === "day"}>
          <ZoomIn className="mr-1 h-3.5 w-3.5" />
          Zoom in
        </Button>
      </div>

      {/* Chart container */}
      <div
        ref={chartRef}
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex">
          {/* Left panel — task names */}
          <div
            className="flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800"
            style={{ width: LEFT_PANEL_WIDTH }}
          >
            {/* Header */}
            <div
              className="flex items-center border-b border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
              style={{ height: HEADER_HEIGHT }}
            >
              Task
            </div>
            {/* Rows */}
            <div>
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-center border-b border-zinc-100 px-3 text-sm dark:border-zinc-800/50",
                    selectedTaskId === row.id &&
                      "bg-indigo-50 dark:bg-indigo-900/20",
                    row.isSubtask && "pl-7"
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 flex-shrink-0 rounded-full",
                        statusColor(row.status)
                      )}
                    />
                    <span className="truncate text-zinc-800 dark:text-zinc-200">
                      {row.title}
                    </span>
                  </div>
                  {row.assigneeName && (
                    <span className="ml-2 flex-shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                      {row.assigneeName}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right panel — timeline chart */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
            <div style={{ width: totalWidth, position: "relative" }}>
              {/* Header — date columns */}
              <div
                className="flex border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50"
                style={{ height: HEADER_HEIGHT }}
              >
                {columns.map((col, i) => {
                  let label = "";
                  let subLabel = "";
                  switch (zoom) {
                    case "day":
                      label = format(col, "d");
                      subLabel = format(col, "EEE");
                      break;
                    case "week":
                      label = format(col, "MMM d");
                      break;
                    case "month":
                      label = format(col, "MMM yyyy");
                      break;
                  }
                  const today = isToday(col);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex flex-col items-center justify-center border-r border-zinc-100 text-center dark:border-zinc-800/50",
                        today && "bg-indigo-50 dark:bg-indigo-900/20"
                      )}
                      style={{ width: cellWidth, minWidth: cellWidth }}
                    >
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          today
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-zinc-700 dark:text-zinc-300"
                        )}
                      >
                        {label}
                      </span>
                      {subLabel && (
                        <span
                          className={cn(
                            "text-[10px]",
                            today
                              ? "text-indigo-500 dark:text-indigo-400"
                              : "text-zinc-400 dark:text-zinc-500"
                          )}
                        >
                          {subLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Grid background + bars */}
              <div className="relative">
                {/* Grid lines */}
                {columns.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 border-r border-zinc-50 dark:border-zinc-800/30"
                    style={{
                      left: i * cellWidth,
                      width: cellWidth,
                      height: rows.length * ROW_HEIGHT,
                    }}
                  />
                ))}

                {/* Row background stripes */}
                {rows.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "absolute w-full",
                      i % 2 === 1 && "bg-zinc-25 dark:bg-zinc-800/10"
                    )}
                    style={{
                      top: i * ROW_HEIGHT,
                      height: ROW_HEIGHT,
                    }}
                  />
                ))}

                {/* Today line */}
                {showTodayLine && (
                  <div
                    className="absolute top-0 z-20 w-0.5 bg-red-500"
                    style={{
                      left: todayX,
                      height: rows.length * ROW_HEIGHT,
                    }}
                  >
                    <div className="absolute -left-1.5 -top-1 h-3 w-3 rounded-full bg-red-500" />
                  </div>
                )}

                {/* Task bars */}
                {rows.map((row, rowIndex) => {
                  const x = dateToX(row.startDate);
                  const w = row.isMilestone
                    ? 16
                    : barWidth(row.startDate, row.endDate);
                  const y = rowIndex * ROW_HEIGHT + (ROW_HEIGHT - 24) / 2;

                  if (row.isMilestone) {
                    // Diamond milestone marker
                    return (
                      <div
                        key={row.id}
                        className="absolute z-10 cursor-pointer"
                        style={{ left: x - 8, top: y + 4 }}
                        onClick={() => setSelectedTaskId(row.id)}
                      >
                        <div
                          className={cn(
                            "h-4 w-4 rotate-45 rounded-sm",
                            statusColor(row.status)
                          )}
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "group absolute z-10 flex cursor-pointer items-center overflow-hidden rounded-md shadow-sm transition-shadow hover:shadow-md",
                        selectedTaskId === row.id && "ring-2 ring-indigo-500"
                      )}
                      style={{
                        left: Math.max(0, x),
                        top: y,
                        width: Math.max(w, 4),
                        height: 24,
                        backgroundColor: statusBarColor(row.status),
                      }}
                      onClick={() => setSelectedTaskId(row.id)}
                    >
                      {/* Progress fill */}
                      {row.progress > 0 && row.progress < 100 && (
                        <div
                          className="absolute inset-y-0 left-0 bg-black/10"
                          style={{ width: `${row.progress}%` }}
                        />
                      )}

                      {/* Label */}
                      {w > 60 && (
                        <span className="relative z-10 truncate px-2 text-[11px] font-medium text-white">
                          {row.title}
                        </span>
                      )}

                      {/* Resize handle (end) */}
                      <div
                        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) =>
                          handleResizeStart(e, row.id, "end", row.endDate)
                        }
                      >
                        <div className="absolute right-0.5 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-white/60" />
                      </div>
                    </div>
                  );
                })}

                {/* Dependency arrows (SVG overlay) */}
                <svg
                  className="pointer-events-none absolute left-0 top-0 z-30"
                  width={totalWidth}
                  height={rows.length * ROW_HEIGHT}
                  style={{ overflow: "visible" }}
                >
                  {dependencyLines.map((dep, i) => {
                    const fromIdx = rowIndexMap.get(dep.fromTaskId);
                    const toIdx = rowIndexMap.get(dep.toTaskId);
                    if (fromIdx === undefined || toIdx === undefined) return null;

                    const fromRow = rows[fromIdx];
                    const toRow = rows[toIdx];

                    const fromX =
                      dateToX(fromRow.endDate) +
                      (fromRow.isMilestone ? 8 : barWidth(fromRow.startDate, fromRow.endDate));
                    const fromY = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const toX = Math.max(0, dateToX(toRow.startDate));
                    const toY = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                    const midX = fromX + 12;

                    return (
                      <g key={i}>
                        <path
                          d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`}
                          fill="none"
                          stroke={dep.type === "blocks" ? "#f59e0b" : "#a1a1aa"}
                          strokeWidth={1.5}
                          strokeDasharray={dep.type === "related" ? "4 3" : "none"}
                        />
                        {/* Arrow head */}
                        <polygon
                          points={`${toX},${toY} ${toX - 5},${toY - 3} ${toX - 5},${toY + 3}`}
                          fill={dep.type === "blocks" ? "#f59e0b" : "#a1a1aa"}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-6 rounded-sm bg-amber-400" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-6 rounded-sm bg-blue-500" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-6 rounded-sm bg-emerald-500" />
          <span>Done</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-6 rounded-sm bg-zinc-400" />
          <span>Cancelled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rotate-45 rounded-sm bg-indigo-500" />
          <span>Milestone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-6 bg-red-500" />
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}
