"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import type { Task } from "@/lib/types/database";

interface TaskListProps {
  tasks: Pick<Task, "id" | "title" | "status" | "priority" | "due_date" | "due_time">[];
}

export function TaskList({ tasks }: TaskListProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 dark:text-red-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      default:
        return "text-zinc-600 dark:text-zinc-400";
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>No pending tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/tasks">
            <Button variant="outline" className="w-full">
              View All Tasks
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Tasks</CardTitle>
        <CardDescription>{tasks.length} pending</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.slice(0, 5).map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="block rounded-lg border border-zinc-200 bg-zinc-50 p-3 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{task.title}</p>
                  {task.due_date && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      Due: {format(parseISO(task.due_date), "MMM d, yyyy")}
                      {task.due_time && ` at ${task.due_time}`}
                    </p>
                  )}
                </div>
                <span className={`ml-2 text-xs font-medium ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/tasks" className="mt-4 block">
          <Button variant="outline" className="w-full">
            View All Tasks
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
