"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Check, Pencil, Trash2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { updateTaskStatus, updateTask, deleteTask } from "@/lib/tasks/actions";
import { TaskLabels } from "@/components/tasks/task-labels";
import type { Task, TaskPriority } from "@/lib/types/database";
import type { Label } from "@/lib/types/board";

interface Props {
  task: Task;
  completed?: boolean;
  /** When defined, shows a selection checkbox for bulk actions. */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function TaskRow({ task, completed = false, selected, onToggleSelect }: Props) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | "toggle" | "save" | "delete">(null);
  const [optimisticDone, setOptimisticDone] = useState(completed);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Edit-form state
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState<string | undefined>(task.due_date ?? undefined);
  const initialLabels = (task as Task & { labels?: Label[] }).labels ?? [];
  const [labels, setLabels] = useState<Label[]>(initialLabels);

  function handleToggle() {
    if (busy) return;
    const next = !optimisticDone;
    setOptimisticDone(next);
    setBusy("toggle");
    startTransition(async () => {
      try {
        await updateTaskStatus(task.id, next ? "done" : "pending");
        toast.success(next ? "Marked as done" : "Reopened");
      } catch (err) {
        setOptimisticDone(!next);
        toast.error(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setBusy(null);
      }
    });
  }

  function handleSaveEdit() {
    if (!title.trim() || busy) return;
    setBusy("save");
    startTransition(async () => {
      try {
        await updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          due_date: dueDate || null,
          labels,
        });
        toast.success("Task updated");
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setBusy(null);
      }
    });
  }

  function handleDelete() {
    setBusy("delete");
    startTransition(async () => {
      try {
        await deleteTask(task.id);
        toast.success("Task deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete");
      } finally {
        setBusy(null);
      }
    });
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-white p-4 shadow-sm dark:border-indigo-900 dark:bg-zinc-900">
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
          />
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Due date</label>
              <DatePicker value={dueDate} onChange={setDueDate} placeholder="No due date" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Labels</label>
            <TaskLabels labels={labels} onChange={setLabels} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={pending || !title.trim()}>
              {busy === "save" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`group flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 ${
          optimisticDone ? "opacity-70" : ""
        } ${selected ? "ring-2 ring-indigo-500" : ""}`}
      >
        {/* Selection checkbox for bulk ops (only when onToggleSelect is provided) */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect(task.id)}
            aria-label={`Select ${task.title}`}
            className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
          />
        )}

        {/* Done checkbox */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
            optimisticDone
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-zinc-300 bg-white hover:border-indigo-400 dark:border-zinc-600 dark:bg-zinc-900"
          }`}
          aria-label={optimisticDone ? "Mark as pending" : "Mark as done"}
        >
          {busy === "toggle" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : optimisticDone ? (
            <Check className="h-3 w-3" strokeWidth={3} />
          ) : null}
        </button>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`font-medium text-zinc-900 dark:text-zinc-100 ${
                optimisticDone ? "line-through text-zinc-500 dark:text-zinc-500" : ""
              }`}
            >
              {task.title}
            </h3>
            {!optimisticDone && <TaskStatusBadge status={task.status} />}
            {!optimisticDone && <TaskPriorityBadge priority={task.priority} />}
          </div>
          {task.description && (
            <p className="mt-0.5 truncate text-sm text-zinc-600 dark:text-zinc-400">{task.description}</p>
          )}
          {task.due_date && !optimisticDone && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Due: {format(parseISO(task.due_date), "MMM d, yyyy")}
              {task.due_time && ` at ${task.due_time}`}
            </p>
          )}
          {optimisticDone && task.completed_at && (
            <p className="mt-1 text-xs text-zinc-400">
              Completed {format(parseISO(task.completed_at), "MMM d, yyyy")}
            </p>
          )}
          {initialLabels.length > 0 && (
            <div className="mt-1.5">
              <TaskLabels labels={initialLabels} onChange={() => {}} readOnly small />
            </div>
          )}
        </div>

        {/* Actions (visible on hover / always on touch) */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <Link
            href={`/tasks/${task.id}`}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            title="Open task"
            aria-label="Open task"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            title="Edit"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40"
            title="Delete"
            aria-label="Delete"
          >
            {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description={`"${task.title}" will be permanently removed. This can't be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={handleDelete}
      />
    </>
  );
}
