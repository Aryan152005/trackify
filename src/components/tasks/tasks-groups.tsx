"use client";

import { useMemo, useState } from "react";
import { Search, AlertTriangle, Calendar, CalendarDays, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskRow } from "@/components/tasks/task-row";
import type { Task } from "@/lib/types/database";

type Bucket = { key: string; label: string; desc: string; icon: React.ReactNode; tasks: Task[]; danger?: boolean };

function isoDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function TasksGroups({ tasks }: { tasks: Task[] }) {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"all" | "low" | "medium" | "high">("all");
  const [status, setStatus] = useState<"all" | "pending" | "in-progress" | "done">("all");
  const [showCompleted, setShowCompleted] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (status !== "all" && t.status !== status) return false;
      return true;
    });
  }, [tasks, search, priority, status]);

  // Partition pending/in-progress by due date. Completed goes into its own bucket.
  const buckets = useMemo<Bucket[]>(() => {
    const today = isoDateOnly(new Date());
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(now.getDate() + 7);
    const in7Iso = isoDateOnly(in7);

    const overdue: Task[] = [];
    const dueToday: Task[] = [];
    const thisWeek: Task[] = [];
    const later: Task[] = [];
    const noDate: Task[] = [];
    const completed: Task[] = [];

    for (const t of filtered) {
      if (t.status === "done") { completed.push(t); continue; }
      if (!t.due_date) { noDate.push(t); continue; }
      if (t.due_date < today) overdue.push(t);
      else if (t.due_date === today) dueToday.push(t);
      else if (t.due_date <= in7Iso) thisWeek.push(t);
      else later.push(t);
    }

    return [
      { key: "overdue", label: "Overdue", desc: "Past their due date — handle first.", icon: <AlertTriangle className="h-4 w-4 text-red-500" />, tasks: overdue, danger: true },
      { key: "today", label: "Due today", desc: "On your plate for today.", icon: <Calendar className="h-4 w-4 text-orange-500" />, tasks: dueToday },
      { key: "week", label: "This week", desc: "Due in the next 7 days.", icon: <CalendarDays className="h-4 w-4 text-indigo-500" />, tasks: thisWeek },
      { key: "later", label: "Later", desc: "Further out.", icon: <CalendarDays className="h-4 w-4 text-zinc-400" />, tasks: later },
      { key: "nodate", label: "No due date", desc: "Uncheduled — pick a day.", icon: <Calendar className="h-4 w-4 text-zinc-400" />, tasks: noDate },
      { key: "completed", label: "Completed", desc: "Finished — nice work.", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, tasks: completed },
    ];
  }, [filtered]);

  const activeBuckets = buckets.filter((b) => b.key !== "completed" ? b.tasks.length > 0 : showCompleted && b.tasks.length > 0);
  const anyActiveFilter = search || priority !== "all" || status !== "all";
  const completedCount = buckets.find((b) => b.key === "completed")?.tasks.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In progress</option>
          <option value="done">Done</option>
        </select>
        {anyActiveFilter && (
          <button
            type="button"
            onClick={() => { setSearch(""); setPriority("all"); setStatus("all"); }}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Clear
          </button>
        )}
        {completedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="ml-auto text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {showCompleted ? "Hide" : "Show"} completed ({completedCount})
          </button>
        )}
      </div>

      {/* Buckets */}
      {activeBuckets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-zinc-500">
            {tasks.length === 0 ? "No tasks yet." : "No tasks match these filters."}
          </CardContent>
        </Card>
      ) : (
        activeBuckets.map((b) => (
          <Card key={b.key} className={b.danger ? "border-red-200 dark:border-red-900/40" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {b.icon}
                {b.label}
                <span className="ml-1 text-xs font-normal text-zinc-400">({b.tasks.length})</span>
              </CardTitle>
              <CardDescription>{b.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {b.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} completed={b.key === "completed"} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
