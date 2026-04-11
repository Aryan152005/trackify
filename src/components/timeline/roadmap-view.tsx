"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getRoadmapData } from "@/lib/timeline/actions";
import type {
  RoadmapGroup,
  TimelineFilters,
  TimelineItem,
} from "@/lib/timeline/types";
import type { TaskPriority, TaskStatus } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Priority config
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { bg: string; text: string; dot: string; label: string }
> = {
  high: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
    label: "High",
  },
  medium: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "Medium",
  },
  low: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    label: "Low",
  },
};

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5 text-amber-500" />,
  "in-progress": <AlertCircle className="h-3.5 w-3.5 text-blue-500" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  cancelled: <XCircle className="h-3.5 w-3.5 text-zinc-400" />,
};

// ---------------------------------------------------------------------------
// RoadmapView component
// ---------------------------------------------------------------------------

interface RoadmapViewProps {
  workspaceId: string;
  filters?: TimelineFilters;
}

export function RoadmapView({ workspaceId, filters }: RoadmapViewProps) {
  const [groups, setGroups] = useState<RoadmapGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await getRoadmapData(workspaceId, filters);
      setGroups(data);
    } catch (e) {
      console.error("Failed to load roadmap data:", e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading && groups.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        Loading roadmap...
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Target className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p>No tasks with due dates found.</p>
        <p className="text-xs">Add due dates to your tasks to see them on the roadmap.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.key);
        const { stats } = group;

        return (
          <div
            key={group.key}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Month header */}
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              onClick={() => toggleCollapse(group.key)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              )}
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {group.label}
              </h3>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {stats.total} task{stats.total !== 1 ? "s" : ""}
              </span>
              {/* Progress bar */}
              <div className="ml-auto flex items-center gap-3">
                <div className="hidden items-center gap-2 text-[10px] text-zinc-400 sm:flex">
                  <span className="text-emerald-500">{stats.done} done</span>
                  <span className="text-blue-500">{stats.inProgress} active</span>
                  <span className="text-amber-500">{stats.pending} pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${stats.completionPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {stats.completionPercent}%
                  </span>
                </div>
              </div>
            </button>

            {/* Tasks */}
            {!isCollapsed && (
              <div className="border-t border-zinc-100 dark:border-zinc-800">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {(["high", "medium", "low"] as TaskPriority[]).map((p) => (
          <div key={p} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-2.5 rounded-full", PRIORITY_CONFIG[p].dot)} />
            <span>{PRIORITY_CONFIG[p].label} priority</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskRow
// ---------------------------------------------------------------------------

function TaskRow({ task }: { task: TimelineItem }) {
  const priority = task.priority ?? "medium";
  const config = PRIORITY_CONFIG[priority];
  const status = task.status ?? "pending";

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-zinc-50 px-4 py-2.5 last:border-b-0 dark:border-zinc-800/50",
        config.bg
      )}
    >
      {STATUS_ICON[status]}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium text-zinc-800 dark:text-zinc-200",
            status === "done" && "line-through opacity-60",
            status === "cancelled" && "line-through opacity-40"
          )}
        >
          {task.title}
        </p>
      </div>
      {task.assigneeName && (
        <span className="hidden text-[11px] text-zinc-400 dark:text-zinc-500 sm:block">
          {task.assigneeName}
        </span>
      )}
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium",
          config.text,
          config.bg
        )}
      >
        {config.label}
      </span>
      {task.endDate && (
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
          {format(new Date(task.endDate), "MMM d")}
        </span>
      )}
    </div>
  );
}
