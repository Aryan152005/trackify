import type { Challenge, HabitDay, KanbanDay, RoadmapDay } from "./types";

export function currentDayIndex(c: Challenge): number {
  const start = new Date(c.started_at);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now.getTime() - start.getTime()) / (24 * 3600 * 1000));
  return Math.max(0, Math.min(c.duration_days - 1, diff));
}

export function computeStats(c: Challenge): { done: number; total: number; streak: number } {
  const total = c.duration_days;
  let done = 0;
  for (const d of c.days) {
    if (c.mode === "habit" && (d as HabitDay).done) done++;
    else if (c.mode === "roadmap" && (d as RoadmapDay).done) done++;
    else if (c.mode === "kanban") {
      const tasks = (d as KanbanDay).tasks ?? [];
      if (tasks.length > 0 && tasks.every((t) => t.done)) done++;
    }
  }
  let streak = 0;
  const today = currentDayIndex(c);
  for (let i = today; i >= 0; i--) {
    const d = c.days[i];
    const dayDone =
      c.mode === "habit" ? (d as HabitDay).done
      : c.mode === "roadmap" ? (d as RoadmapDay).done
      : c.mode === "kanban" ? ((d as KanbanDay).tasks?.length ?? 0) > 0 && (d as KanbanDay).tasks.every((t) => t.done)
      : false;
    if (dayDone) streak++;
    else break;
  }
  return { done, total, streak };
}
