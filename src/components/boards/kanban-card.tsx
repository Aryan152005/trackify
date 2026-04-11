"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskCard } from "@/lib/types/board";

interface KanbanCardProps {
  task: TaskCard;
  onClick: (taskId: string) => void;
}

const priorityConfig: Record<string, { bg: string; text: string; label: string }> = {
  high: {
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-700 dark:text-red-300",
    label: "High",
  },
  medium: {
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    text: "text-yellow-700 dark:text-yellow-300",
    label: "Medium",
  },
  low: {
    bg: "bg-zinc-100 dark:bg-zinc-700/40",
    text: "text-zinc-600 dark:text-zinc-300",
    label: "Low",
  },
};

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isDueDateOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

export function KanbanCard({ task, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = priorityConfig[task.priority] ?? priorityConfig.low;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800",
        "hover:shadow-md transition-shadow duration-150",
        "min-h-[60px] cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 shadow-lg ring-2 ring-indigo-500/30"
      )}
      onClick={() => onClick(task.id)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute right-1 top-1 rounded p-0.5 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label.name}
              className="inline-block h-1.5 w-6 rounded-full"
              style={{ backgroundColor: label.color }}
              title={label.name}
            />
          ))}
        </div>
      )}

      {/* Title */}
      <p className="pr-5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {task.title}
      </p>

      {/* Footer row: priority, due date, assignee */}
      <div className="mt-2 flex items-center gap-2">
        {/* Priority badge */}
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            priority.bg,
            priority.text
          )}
        >
          {priority.label}
        </span>

        {/* Due date */}
        {task.due_date && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px]",
              isDueDateOverdue(task.due_date)
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-500 dark:text-zinc-400"
            )}
          >
            <Calendar className="h-3 w-3" />
            {formatDueDate(task.due_date)}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Assigned user avatar */}
        {task.assigned_profile && (
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
            title={task.assigned_profile.name}
          >
            {task.assigned_profile.avatar_url ? (
              <img
                src={task.assigned_profile.avatar_url}
                alt={task.assigned_profile.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              task.assigned_profile.name.charAt(0)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** A non-interactive version of the card for use in the DragOverlay. */
export function KanbanCardOverlay({ task }: { task: TaskCard }) {
  const priority = priorityConfig[task.priority] ?? priorityConfig.low;

  return (
    <div className="w-64 rotate-2 rounded-lg border border-indigo-300 bg-white p-3 shadow-xl dark:border-indigo-600 dark:bg-zinc-800">
      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label.name}
              className="inline-block h-1.5 w-6 rounded-full"
              style={{ backgroundColor: label.color }}
            />
          ))}
        </div>
      )}
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {task.title}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            priority.bg,
            priority.text
          )}
        >
          {priority.label}
        </span>
      </div>
    </div>
  );
}
