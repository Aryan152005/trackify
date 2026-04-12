"use client";

import { useMemo, useState } from "react";
import { addDays, format, subDays } from "date-fns";
import {
  GanttChart as GanttChartIcon,
  Map,
  Clock,
  Filter,
  X,
} from "lucide-react";

import { AnimatedPage } from "@/components/ui/animated-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { GanttChart } from "@/components/timeline/gantt-chart";
import { RoadmapView } from "@/components/timeline/roadmap-view";
import { TimelineView } from "@/components/timeline/timeline-view";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/lib/types/database";
import type { TimelineFilters } from "@/lib/timeline/types";

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

type TabId = "gantt" | "roadmap" | "timeline";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "gantt",
    label: "Gantt Chart",
    icon: <GanttChartIcon className="h-4 w-4" />,
  },
  { id: "roadmap", label: "Roadmap", icon: <Map className="h-4 w-4" /> },
  { id: "timeline", label: "Timeline", icon: <Clock className="h-4 w-4" /> },
];

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in-progress",
  "done",
  "cancelled",
];

const PRIORITY_OPTIONS: TaskPriority[] = ["high", "medium", "low"];

// ---------------------------------------------------------------------------
// TimelinePage
// ---------------------------------------------------------------------------

export default function TimelinePage() {
  const workspaceId = useWorkspaceId();
  const [activeTab, setActiveTab] = useState<TabId>("gantt");
  const [showFilters, setShowFilters] = useState(false);

  // Date range
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 14), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    format(addDays(new Date(), 90), "yyyy-MM-dd")
  );

  // Filters
  const [statusFilter, setStatusFilter] = useState<TaskStatus[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority[]>([]);

  const filters: TimelineFilters = useMemo(
    () => ({
      status: statusFilter.length > 0 ? statusFilter : undefined,
      priority: priorityFilter.length > 0 ? priorityFilter : undefined,
    }),
    [statusFilter, priorityFilter]
  );

  const hasActiveFilters = statusFilter.length > 0 || priorityFilter.length > 0;

  function toggleStatus(s: TaskStatus) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function togglePriority(p: TaskPriority) {
    setPriorityFilter((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function clearFilters() {
    setStatusFilter([]);
    setPriorityFilter([]);
  }

  if (!workspaceId) {
    return (
      <AnimatedPage>
        <div className="flex h-96 items-center justify-center text-sm text-zinc-500">
          Select a workspace to view the timeline.
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Timeline"
          actions={
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">
                  {statusFilter.length + priorityFilter.length}
                </span>
              )}
            </Button>
          }
        />

        {/* Toolbar */}
        <Card className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Tabs */}
            <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  )}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 dark:text-zinc-400">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              />
              <label className="text-xs text-zinc-500 dark:text-zinc-400">
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              />
            </div>
          </div>
        </Card>

        {/* Filters panel */}
        {showFilters && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Filters
              </h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row">
              {/* Status */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Status
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleStatus(s)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        statusFilter.includes(s)
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {/* Priority */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Priority
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITY_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePriority(p)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        priorityFilter.includes(p)
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Content */}
        <div>
          {activeTab === "gantt" && (
            <GanttChart
              workspaceId={workspaceId}
              startDate={new Date(startDate)}
              endDate={new Date(endDate)}
              filters={filters}
            />
          )}
          {activeTab === "roadmap" && (
            <RoadmapView workspaceId={workspaceId} filters={filters} />
          )}
          {activeTab === "timeline" && (
            <TimelineView
              workspaceId={workspaceId}
              startDate={new Date(startDate)}
              endDate={new Date(endDate)}
              filters={filters}
            />
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
