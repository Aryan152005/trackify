"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  TimelineItem,
  TimelineFilters,
  RoadmapGroup,
  RoadmapStats,
  TaskDependency,
} from "./types";
import { format, startOfMonth, endOfMonth, addMonths, parseISO } from "date-fns";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return { supabase, user };
}

function taskProgress(status: string | null): number {
  switch (status) {
    case "done":
      return 100;
    case "in-progress":
      return 50;
    case "cancelled":
      return 0;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// getTimelineData — fetch tasks + events in a date range with dependencies
// ---------------------------------------------------------------------------

export async function getTimelineData(
  workspaceId: string,
  startDate: string,
  endDate: string,
  filters?: TimelineFilters
): Promise<TimelineItem[]> {
  const { supabase } = await getAuthenticatedUser();

  // Build tasks query
  let taskQuery = supabase
    .from("tasks")
    .select(
      "id, title, description, due_date, status, priority, assigned_to, parent_task_id, board_id, created_at, completed_at"
    )
    .eq("workspace_id", workspaceId)
    .or(`due_date.gte.${startDate},created_at.gte.${startDate}`)
    .or(`due_date.lte.${endDate},created_at.lte.${endDate}`)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filters?.status?.length) {
    taskQuery = taskQuery.in("status", filters.status);
  }
  if (filters?.priority?.length) {
    taskQuery = taskQuery.in("priority", filters.priority);
  }
  if (filters?.assignedTo) {
    taskQuery = taskQuery.eq("assigned_to", filters.assignedTo);
  }
  if (filters?.boardId) {
    taskQuery = taskQuery.eq("board_id", filters.boardId);
  }

  const { data: tasks, error: tasksError } = await taskQuery;
  if (tasksError) throw new Error(`Failed to fetch tasks: ${tasksError.message}`);

  // Fetch calendar events in range
  const { data: events, error: eventsError } = await supabase
    .from("calendar_events")
    .select("id, title, description, start_time, end_time, color")
    .eq("workspace_id", workspaceId)
    .gte("start_time", startDate)
    .lte("end_time", endDate)
    .order("start_time", { ascending: true });

  if (eventsError) throw new Error(`Failed to fetch events: ${eventsError.message}`);

  // Fetch all dependencies for the relevant tasks
  const taskIds = (tasks ?? []).map((t) => t.id);

  // Fetch assignee names
  const assigneeIds = [
    ...new Set((tasks ?? []).map((t) => t.assigned_to).filter(Boolean)),
  ];
  let profileMap: Record<string, string> = {};
  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, name")
      .in("user_id", assigneeIds);
    profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.user_id, p.name])
    );
  }

  // Build dependency map (task_id -> deps[])
  const depMap = new Map<string, TaskDependency[]>();
  if (taskIds.length > 0) {
    const { data: deps } = await supabase
      .from("task_dependencies")
      .select("id, task_id, depends_on, dependency_type")
      .eq("workspace_id", workspaceId)
      .in("task_id", taskIds);

    for (const d of deps ?? []) {
      const dep: TaskDependency = {
        id: d.id,
        dependsOn: d.depends_on,
        dependencyType: d.dependency_type as "blocks" | "related",
      };
      const existing = depMap.get(d.task_id) ?? [];
      existing.push(dep);
      depMap.set(d.task_id, existing);
    }
  }

  // Map tasks to TimelineItem
  const taskItems: TimelineItem[] = (tasks ?? []).map((t) => ({
    id: t.id,
    type: "task" as const,
    title: t.title,
    description: t.description,
    startDate: t.created_at,
    endDate: t.due_date,
    status: t.status,
    priority: t.priority,
    assignedTo: t.assigned_to,
    assigneeName: t.assigned_to ? profileMap[t.assigned_to] ?? null : null,
    parentTaskId: t.parent_task_id,
    boardId: t.board_id,
    color: null,
    progress: taskProgress(t.status),
    dependencies: depMap.get(t.id) ?? [],
  }));

  // Map events to TimelineItem
  const eventItems: TimelineItem[] = (events ?? []).map((e) => ({
    id: e.id,
    type: "event" as const,
    title: e.title,
    description: e.description,
    startDate: e.start_time,
    endDate: e.end_time,
    status: null,
    priority: null,
    assignedTo: null,
    assigneeName: null,
    parentTaskId: null,
    boardId: null,
    color: e.color,
    progress: 0,
    dependencies: [],
  }));

  const all = [...taskItems, ...eventItems];
  all.sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  return all;
}

// ---------------------------------------------------------------------------
// updateTaskDates — for Gantt drag-resize
// ---------------------------------------------------------------------------

export async function updateTaskDates(
  taskId: string,
  startDate: string,
  endDate: string
) {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("tasks")
    .update({ due_date: endDate })
    .eq("id", taskId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update task dates: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// getRoadmapData — tasks grouped by month with progress stats
// ---------------------------------------------------------------------------

export async function getRoadmapData(
  workspaceId: string,
  filters?: TimelineFilters
): Promise<RoadmapGroup[]> {
  const { supabase } = await getAuthenticatedUser();

  let query = supabase
    .from("tasks")
    .select(
      "id, title, description, due_date, status, priority, assigned_to, parent_task_id, board_id, created_at"
    )
    .eq("workspace_id", workspaceId)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true });

  if (filters?.status?.length) {
    query = query.in("status", filters.status);
  }
  if (filters?.priority?.length) {
    query = query.in("priority", filters.priority);
  }
  if (filters?.assignedTo) {
    query = query.eq("assigned_to", filters.assignedTo);
  }

  const { data: tasks, error } = await query;
  if (error) throw new Error(`Failed to fetch roadmap data: ${error.message}`);

  // Fetch assignee names
  const assigneeIds = [
    ...new Set((tasks ?? []).map((t) => t.assigned_to).filter(Boolean)),
  ];
  let profileMap: Record<string, string> = {};
  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, name")
      .in("user_id", assigneeIds);
    profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.user_id, p.name])
    );
  }

  // Group by month
  const groups = new Map<string, TimelineItem[]>();

  for (const t of tasks ?? []) {
    const monthKey = format(parseISO(t.due_date), "yyyy-MM");
    const item: TimelineItem = {
      id: t.id,
      type: "task",
      title: t.title,
      description: t.description,
      startDate: t.created_at,
      endDate: t.due_date,
      status: t.status,
      priority: t.priority,
      assignedTo: t.assigned_to,
      assigneeName: t.assigned_to ? profileMap[t.assigned_to] ?? null : null,
      parentTaskId: t.parent_task_id,
      boardId: t.board_id,
      color: null,
      progress: taskProgress(t.status),
      dependencies: [],
    };
    const existing = groups.get(monthKey) ?? [];
    existing.push(item);
    groups.set(monthKey, existing);
  }

  // Build result
  const result: RoadmapGroup[] = [];
  for (const [key, items] of groups.entries()) {
    const stats = computeStats(items);
    result.push({
      key,
      label: format(parseISO(`${key}-01`), "MMMM yyyy"),
      tasks: items,
      stats,
    });
  }

  return result;
}

function computeStats(items: TimelineItem[]): RoadmapStats {
  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const inProgress = items.filter((i) => i.status === "in-progress").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const cancelled = items.filter((i) => i.status === "cancelled").length;
  return {
    total,
    done,
    inProgress,
    pending,
    cancelled,
    completionPercent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}
