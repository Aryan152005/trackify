"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  updateReminder,
  deleteReminder,
} from "@/lib/reminders/actions";
import {
  formatIST,
  utcISOToIstLocalInput,
} from "@/lib/utils/datetime";
import { PrivateToggle } from "@/components/personal/private-toggle";
import type { Reminder } from "@/lib/types/database";

interface Props {
  reminders: Reminder[];
  readOnly?: boolean;
}

export function RemindersList({ reminders, readOnly = false }: Props) {
  return (
    <div className="space-y-3">
      {reminders.map((r) => (
        <ReminderRow key={r.id} reminder={r} readOnly={readOnly} />
      ))}
    </div>
  );
}

function ReminderRow({ reminder, readOnly }: { reminder: Reminder; readOnly: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "delete" | "toggle">(null);

  const [title, setTitle] = useState(reminder.title);
  const [description, setDescription] = useState(reminder.description ?? "");
  const [timeLocal, setTimeLocal] = useState(utcISOToIstLocalInput(reminder.reminder_time));
  const [isRecurring, setIsRecurring] = useState(reminder.is_recurring);
  const [recurrencePattern, setRecurrencePattern] = useState(reminder.recurrence_pattern ?? "daily");

  function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy("save");
    startTransition(async () => {
      try {
        await updateReminder(reminder.id, {
          title,
          description,
          reminder_time_local: timeLocal,
          is_recurring: isRecurring,
          recurrence_pattern: isRecurring ? recurrencePattern : null,
        });
        toast.success("Reminder updated");
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setBusy(null);
      }
    });
  }

  function handleToggleDone() {
    setBusy("toggle");
    startTransition(async () => {
      try {
        await updateReminder(reminder.id, { is_completed: !reminder.is_completed });
        toast.success(reminder.is_completed ? "Reopened" : "Marked done");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setBusy(null);
      }
    });
  }

  function handleDelete() {
    setBusy("delete");
    startTransition(async () => {
      try {
        await deleteReminder(reminder.id);
        toast.success("Reminder deleted");
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
            className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Reminder time (IST)
              </label>
              <input
                type="datetime-local"
                value={timeLocal}
                onChange={(e) => setTimeLocal(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Repeat
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  id={`recur-${reminder.id}`}
                />
                <label htmlFor={`recur-${reminder.id}`} className="text-sm text-zinc-700 dark:text-zinc-300">
                  Recurring
                </label>
                {isRecurring && (
                  <div className="flex-1">
                    <Select value={recurrencePattern} onValueChange={setRecurrencePattern}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={pending}>
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={pending || !title.trim()}>
              {busy === "save" ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
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
        className={`group flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800 ${
          reminder.is_completed ? "opacity-60" : ""
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`font-medium text-zinc-900 dark:text-zinc-100 ${
                reminder.is_completed ? "line-through" : ""
              }`}
            >
              {reminder.title}
            </h3>
            {reminder.is_recurring && (
              <span className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                <RefreshCw className="h-2.5 w-2.5" />
                {reminder.recurrence_pattern}
              </span>
            )}
          </div>
          {reminder.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{reminder.description}</p>
          )}
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {formatIST(reminder.reminder_time)} IST
          </p>
        </div>
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <PrivateToggle
              entityType="reminders"
              entityId={reminder.id}
              isPrivate={!!(reminder as unknown as { is_private?: boolean }).is_private}
            />
            <button
              type="button"
              onClick={handleToggleDone}
              disabled={pending}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-emerald-600 dark:hover:bg-zinc-700"
              title={reminder.is_completed ? "Reopen" : "Mark done"}
              aria-label={reminder.is_completed ? "Reopen reminder" : "Mark reminder done"}
            >
              {busy === "toggle" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              title="Edit"
              aria-label="Edit reminder"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40"
              title="Delete"
              aria-label="Delete reminder"
            >
              {busy === "delete" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this reminder?"
        description={`"${reminder.title}" will be permanently removed.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={handleDelete}
      />
    </>
  );
}
