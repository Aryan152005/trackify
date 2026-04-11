import type { TaskStatus, TaskPriority } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Timeline Item — unified representation of a task or calendar event
// ---------------------------------------------------------------------------

export interface TimelineItem {
  id: string;
  type: "task" | "event";
  title: string;
  description: string | null;
  startDate: string; // ISO date
  endDate: string | null; // ISO date — null means milestone (no duration)
  status: TaskStatus | null;
  priority: TaskPriority | null;
  assignedTo: string | null;
  assigneeName: string | null;
  parentTaskId: string | null;
  boardId: string | null;
  color: string | null; // event color
  progress: number; // 0–100
  dependencies: TaskDependency[];
}

export interface TaskDependency {
  id: string;
  dependsOn: string; // task id this depends on
  dependencyType: "blocks" | "related";
}

// ---------------------------------------------------------------------------
// Gantt Chart
// ---------------------------------------------------------------------------

export type ZoomLevel = "day" | "week" | "month";

export interface GanttRow {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  assigneeName: string | null;
  progress: number;
  isSubtask: boolean;
  parentTaskId: string | null;
  isMilestone: boolean; // true when startDate === endDate or no endDate
}

export interface GanttDependencyLine {
  fromTaskId: string;
  toTaskId: string;
  type: "blocks" | "related";
}

// ---------------------------------------------------------------------------
// Roadmap
// ---------------------------------------------------------------------------

export interface RoadmapGroup {
  key: string; // "2026-04" etc.
  label: string; // "April 2026"
  tasks: TimelineItem[];
  stats: RoadmapStats;
}

export interface RoadmapStats {
  total: number;
  done: number;
  inProgress: number;
  pending: number;
  cancelled: number;
  completionPercent: number;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface TimelineFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assignedTo?: string | null;
  boardId?: string | null;
}
